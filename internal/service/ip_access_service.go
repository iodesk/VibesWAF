package service

import (
	"fmt"
	"net"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"github.com/iodesk/VibesWAF/internal/config"
	"github.com/iodesk/VibesWAF/internal/domain/ip_access"
	"github.com/iodesk/VibesWAF/internal/repository"
)

type compiledRule struct {
	rule     *ip_access.IPAccessRule
	network  *net.IPNet
	singleIP net.IP
}

type ipAccessSnapshot struct {
	rules map[string][]compiledRule
}

type IPAccessService struct {
	repo  repository.IPAccessRepository
	state unsafe.Pointer
	mu    sync.RWMutex
	stopCh chan struct{}
}

func NewIPAccessService(repo repository.IPAccessRepository) *IPAccessService {
	s := &IPAccessService{
		repo:   repo,
		stopCh: make(chan struct{}),
	}
	snap := s.loadSnapshot()
	atomic.StorePointer(&s.state, unsafe.Pointer(snap))
	go s.autoReload()
	return s
}


func (s *IPAccessService) List(appID string) ([]*ip_access.IPAccessRule, error) {
	return s.repo.ListByApp(appID)
}


func (s *IPAccessService) Create(req *ip_access.CreateRequest) (*ip_access.IPAccessRule, error) {
	if req.AppID == "" {
		return nil, fmt.Errorf("app_id is required")
	}

	if err := s.validateIPRange(req.IPRange); err != nil {
		return nil, err
	}

	if req.Action != "allow" && req.Action != "block" && req.Action != "challenge" {
		return nil, fmt.Errorf("invalid action: must be 'allow', 'block', or 'challenge'")
	}

	if err := s.checkOverlap(req.AppID, req.IPRange, 0); err != nil {
		return nil, err
	}

	return s.repo.Create(req)
}


func (s *IPAccessService) Update(appID string, id int, req *ip_access.UpdateRequest) (*ip_access.IPAccessRule, error) {
	existing, err := s.repo.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("ip access rule not found")
	}
	if existing.AppID != appID {
		return nil, fmt.Errorf("ip access rule not found")
	}

	if req.IPRange != "" {
		if err := s.validateIPRange(req.IPRange); err != nil {
			return nil, err
		}

		if err := s.checkOverlap(appID, req.IPRange, id); err != nil {
			return nil, err
		}
	}

	if req.Action != "" {
		if req.Action != "allow" && req.Action != "block" && req.Action != "challenge" {
			return nil, fmt.Errorf("invalid action: must be 'allow', 'block', or 'challenge'")
		}
	}

	return s.repo.Update(id, req)
}


func (s *IPAccessService) Delete(appID string, id int) error {
	existing, err := s.repo.GetByID(id)
	if err != nil {
		return fmt.Errorf("ip access rule not found")
	}
	if existing.AppID != appID {
		return fmt.Errorf("ip access rule not found")
	}

	return s.repo.Delete(id)
}


func (s *IPAccessService) CheckIP(appID string, ip string) (*ip_access.IPAccessRule, error) {
	return s.CheckIPInMemory(appID, ip)
}

func (s *IPAccessService) CheckIPInMemory(appID string, ip string) (*ip_access.IPAccessRule, error) {
	snap := (*ipAccessSnapshot)(atomic.LoadPointer(&s.state))
	if snap == nil {
		return nil, nil
	}

	clientIP := net.ParseIP(ip)
	if clientIP == nil {
		return nil, fmt.Errorf("invalid IP: %s", ip)
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	rules := snap.rules[appID]
	for _, cr := range rules {
		if cr.network != nil {
			if cr.network.Contains(clientIP) {
				return cr.rule, nil
			}
		} else if cr.singleIP != nil {
			if cr.singleIP.Equal(clientIP) {
				return cr.rule, nil
			}
		}
	}

	if appID != "default" {
		defaultRules := snap.rules["default"]
		for _, cr := range defaultRules {
			if cr.network != nil {
				if cr.network.Contains(clientIP) {
					return cr.rule, nil
				}
			} else if cr.singleIP != nil {
				if cr.singleIP.Equal(clientIP) {
					return cr.rule, nil
				}
			}
		}
	}

	return nil, nil
}

func (s *IPAccessService) loadSnapshot() *ipAccessSnapshot {
	rules, err := s.repo.ListAll()
	if err != nil {
		config.GetAppConfig().LogError("[IP_ACCESS] Failed to preload rules: %v", err)
		return &ipAccessSnapshot{rules: make(map[string][]compiledRule)}
	}

	snap := &ipAccessSnapshot{rules: make(map[string][]compiledRule)}
	for _, rule := range rules {
		cr := compiledRule{rule: rule}

		_, network, err := net.ParseCIDR(rule.IPRange)
		if err == nil {
			cr.network = network
		} else {
			ip := net.ParseIP(rule.IPRange)
			if ip != nil {
				cr.singleIP = ip
			} else {
				config.GetAppConfig().LogWarn("[IP_ACCESS] Skipping invalid IP range: %s", rule.IPRange)
				continue
			}
		}

		snap.rules[rule.AppID] = append(snap.rules[rule.AppID], cr)
	}

	config.GetAppConfig().LogDebug("[IP_ACCESS] Preloaded %d rules across %d apps", len(rules), len(snap.rules))
	return snap
}

func (s *IPAccessService) autoReload() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			snap := s.loadSnapshot()
			s.mu.Lock()
			atomic.StorePointer(&s.state, unsafe.Pointer(snap))
			s.mu.Unlock()
		}
	}
}

func (s *IPAccessService) Stop() {
	select {
	case <-s.stopCh:
	default:
		close(s.stopCh)
	}
}


func (s *IPAccessService) validateIPRange(ipRange string) error {

	_, _, err := net.ParseCIDR(ipRange)
	if err == nil {
		return nil
	}


	ip := net.ParseIP(ipRange)
	if ip == nil {
		return fmt.Errorf("invalid IP address or CIDR notation: %s", ipRange)
	}





	return nil
}


func (s *IPAccessService) checkOverlap(appID string, ipRange string, excludeID int) error {

	rules, err := s.repo.ListByApp(appID)
	if err != nil {
		return fmt.Errorf("failed to check overlap: %w", err)
	}


	_, newNet, err := net.ParseCIDR(ipRange)
	if err != nil {

		ip := net.ParseIP(ipRange)
		if ip == nil {
			return fmt.Errorf("invalid IP range")
		}

		if ip.To4() != nil {
			ipRange = ipRange + "/32"
		} else {
			ipRange = ipRange + "/128"
		}
		_, newNet, _ = net.ParseCIDR(ipRange)
	}


	for _, rule := range rules {
		if rule.ID == excludeID {
			continue
		}

		_, existingNet, err := net.ParseCIDR(rule.IPRange)
		if err != nil {
			continue
		}


		if newNet.Contains(existingNet.IP) || existingNet.Contains(newNet.IP) {
			return fmt.Errorf("IP range overlaps with existing rule: %s (ID: %d)", rule.IPRange, rule.ID)
		}
	}

	return nil
}
