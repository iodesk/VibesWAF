package stream

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/iodesk/VibesWAF/internal/config"
	"github.com/iodesk/VibesWAF/internal/domain/app"
)

type NginxManager struct {
	streamDir string
	appCfg    *config.AppConfig
}

func NewNginxManager() *NginxManager {
	streamDir := getEnv("STREAM_CONF_DIR", "/etc/nginx/stream.d")
	return &NginxManager{
		streamDir: streamDir,
		appCfg:    config.GetAppConfig(),
	}
}

func (m *NginxManager) GenerateConf(a *app.App) error {
	if !a.IsStream() {
		return nil
	}

	if err := os.MkdirAll(m.streamDir, 0755); err != nil {
		return fmt.Errorf("failed to create stream dir: %w", err)
	}

	confPath := filepath.Join(m.streamDir, fmt.Sprintf("app-%s.conf", a.ID))

	if _, err := os.Stat(confPath); err == nil {
		m.appCfg.LogInfo("[STREAM] Conf already exists, skipping generation app=%s at %s (single source of truth)", a.ID, confPath)
		return nil
	}

	content := m.buildConf(a)

	if err := os.WriteFile(confPath, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to write stream conf: %w", err)
	}

	m.appCfg.LogInfo("[STREAM] Generated conf for app=%s listen=%d backend=%d at %s", a.ID, a.Config.ListenPort, a.Config.BackendPort, confPath)
	return nil
}

func (m *NginxManager) RemoveConf(appID string) error {
	confPath := filepath.Join(m.streamDir, fmt.Sprintf("app-%s.conf", appID))

	if err := os.Remove(confPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove stream conf: %w", err)
	}

	m.appCfg.LogInfo("[STREAM] Removed conf for app=%s", appID)
	return nil
}

// Reload calls a fixed wrapper script via sudo. No user-controlled args = no RCE.
func (m *NginxManager) Reload() error {
	script := getEnv("NGINX_RELOAD_SCRIPT", "/opt/vibeswaf/scripts/reload-nginx.sh")

	if _, err := os.Stat(script); os.IsNotExist(err) {
		m.appCfg.LogInfo("[STREAM] Reload script not found at %s, config written to disk, reload manually", script)
		return nil
	}

	cmd := exec.Command("sudo", script)
	output, err := cmd.CombinedOutput()
	if err != nil {
		m.appCfg.LogError("[STREAM] Nginx reload failed (non-fatal, config on disk): %v output=%s", err, string(output))
		return nil
	}

	m.appCfg.LogInfo("[STREAM] Nginx reloaded via %s", script)
	return nil
}

func (m *NginxManager) buildConf(a *app.App) string {
	certDir := getEnv("CERT_DIR", "/opt/certs")
	listenPort := a.Config.ListenPort
	backendPort := a.Config.BackendPort

	if a.Config.StreamConfig != "" {
		conf := a.Config.StreamConfig
		conf = m.injectListen(conf, listenPort)
		conf = m.injectSSL(conf, certDir, a.Domain)
		conf = m.injectProxyPass(conf, fmt.Sprintf("127.0.0.1:%d", backendPort))
		conf = m.injectProxyProtocol(conf)
		return conf
	}

	return m.defaultConf(a, certDir, listenPort, backendPort)
}

func (m *NginxManager) defaultConf(a *app.App, certDir string, listenPort, backendPort int) string {
	var sb strings.Builder
	scheme := a.StreamScheme()
	domain := a.Domain
	upstreamName := sanitizeID(domain)

	certPath := fmt.Sprintf("%s/%s/fullchain.pem", certDir, domain)
	keyPath := fmt.Sprintf("%s/%s/key.pem", certDir, domain)
	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		certPath = fmt.Sprintf("%s/default/fullchain.pem", certDir)
		keyPath = fmt.Sprintf("%s/default/key.pem", certDir)
	}

	sb.WriteString(fmt.Sprintf("# app: %s (%s)\n", a.ID, domain))

	sb.WriteString(fmt.Sprintf("upstream %s {\n", upstreamName))
	if a.Config.LBMethod == "least-conn" || a.Config.LBMethod == "least_conn" {
		sb.WriteString("    least_conn;\n")
	}
	if a.Config.LBMethod == "ip-hash" || a.Config.LBMethod == "ip_hash" {
		sb.WriteString("    hash $remote_addr consistent;\n")
	}
	sb.WriteString(fmt.Sprintf("    server 127.0.0.1:%d;\n", backendPort))
	sb.WriteString("}\n\n")

	sb.WriteString("server {\n")
	if scheme == "udp" {
		sb.WriteString(fmt.Sprintf("    listen %d udp ssl;\n", listenPort))
	} else {
		sb.WriteString(fmt.Sprintf("    listen %d ssl;\n", listenPort))
	}
	sb.WriteString(fmt.Sprintf("    ssl_certificate     %s;\n", certPath))
	sb.WriteString(fmt.Sprintf("    ssl_certificate_key %s;\n", keyPath))
	sb.WriteString(fmt.Sprintf("    proxy_pass %s;\n", upstreamName))
	sb.WriteString("    proxy_protocol on;\n")
	sb.WriteString("    proxy_connect_timeout 10s;\n")
	sb.WriteString("    proxy_timeout 10s;\n")
	if scheme == "tcp" {
		sb.WriteString("    proxy_socket_keepalive on;\n")
	}
	sb.WriteString("}\n")

	return sb.String()
}

func (m *NginxManager) injectListen(conf string, listenPort int) string {
	listenLine := fmt.Sprintf("listen %d ssl;", listenPort)
	return m.replaceLine(conf, "listen ", listenLine)
}

func (m *NginxManager) injectSSL(conf, certDir, domain string) string {
	certPath := fmt.Sprintf("%s/%s/fullchain.pem", certDir, domain)
	keyPath := fmt.Sprintf("%s/%s/key.pem", certDir, domain)
	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		certPath = fmt.Sprintf("%s/default/fullchain.pem", certDir)
		keyPath = fmt.Sprintf("%s/default/key.pem", certDir)
	}

	certLine := fmt.Sprintf("ssl_certificate     %s;", certPath)
	keyLine := fmt.Sprintf("ssl_certificate_key %s;", keyPath)

	if strings.Contains(conf, "ssl_certificate") {
		conf = m.replaceLine(conf, "ssl_certificate     ", certLine)
		conf = m.replaceLine(conf, "ssl_certificate_key ", keyLine)
		return conf
	}

	idx := strings.Index(conf, "server {")
	if idx == -1 {
		return conf
	}
	insertAt := idx + len("server {")
	newlineIdx := strings.IndexByte(conf[insertAt:], '\n')
	if newlineIdx == -1 {
		conf += "\n    " + certLine + "\n    " + keyLine
		return conf
	}
	insertAt += newlineIdx + 1
	conf = conf[:insertAt] + "\n    " + certLine + "\n    " + keyLine + conf[insertAt:]
	return conf
}

func (m *NginxManager) injectProxyPass(conf, target string) string {
	lines := strings.Split(conf, "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "proxy_pass ") {
			lines[i] = fmt.Sprintf("    proxy_pass %s;", target)
			return strings.Join(lines, "\n")
		}
	}
	return conf
}

func (m *NginxManager) replaceLine(conf, prefix, replacement string) string {
	lines := strings.Split(conf, "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, prefix) {
			indent := line[:len(line)-len(strings.TrimLeft(line, " \t"))]
			lines[i] = indent + replacement
			return strings.Join(lines, "\n")
		}
	}
	return conf
}

func (m *NginxManager) injectProxyProtocol(conf string) string {
	lines := strings.Split(conf, "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "proxy_pass ") {
			lines[i] = line + "\n    proxy_protocol on;"
			return strings.Join(lines, "\n")
		}
	}
	return conf + "\n    proxy_protocol on;\n"
}

func sanitizeID(id string) string {
	return strings.ReplaceAll(id, "-", "_")
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
