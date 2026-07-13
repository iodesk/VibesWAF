package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/vibeswaf/waf/internal/config"
	"github.com/vibeswaf/waf/internal/service"
)

type HealthHandler struct{}

func NewHealthHandler() *HealthHandler {
	return &HealthHandler{}
}

func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	cfg := config.GetAppConfig()
	resp := map[string]interface{}{
		"service": "VibesWAF",
		"version": config.Version,
		"status":  "ok",
		"demo":    cfg.DemoMode,
	}
	if cfg.DemoMode {
		resp["demo_user"] = cfg.DemoUser
		resp["demo_pass"] = cfg.DemoPass
		resp["server_ip"] = cfg.ServerIP
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}

func (h *HealthHandler) HealthForApp(w http.ResponseWriter, r *http.Request, appService *service.AppService) {
	resp := map[string]interface{}{
		"service": "VibesWAF",
		"status":  "ok",
	}
	if appService != nil {
		host := r.Host
		if i := strings.LastIndex(host, ":"); i != -1 {
			host = host[:i]
		}
		if a, err := appService.GetAppByDomain(host); err == nil && a != nil {
			resp["service"] = a.ID
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}