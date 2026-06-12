package handlers

import (
	mrand "math/rand"
	"net/http"

	"github.com/yourapp/waf/internal/challenge"
	"github.com/yourapp/waf/internal/config"
	"github.com/yourapp/waf/internal/pages"
	"github.com/yourapp/waf/internal/pipeline"
)

type ChallengeHandler struct {
	registry *challenge.Registry
	store    *challenge.Store
	appCfg   *config.AppConfig
}

func NewChallengeHandler(registry *challenge.Registry, store *challenge.Store) *ChallengeHandler {
	return &ChallengeHandler{
		registry: registry,
		store:    store,
		appCfg:   config.GetAppConfig(),
	}
}

func (h *ChallengeHandler) Handle(ctx *pipeline.Context) error {
	h.appCfg.LogDebug("[CHALLENGE] Handler called for IP=%s action=%s", ctx.ClientIP, ctx.Action)

	if ctx.ChallengePassed {
		h.appCfg.LogDebug("[CHALLENGE] User already verified, proxying upstream")
		return nil
	}

	switch ctx.Action {
	case "", "allow", "log":
		h.appCfg.LogDebug("[CHALLENGE] Action=%q, proxying upstream", ctx.Action)
		return nil

	case "block":
		h.appCfg.LogInfo("[CHALLENGE] Blocking request for IP=%s", ctx.ClientIP)
		ctx.Writer.WriteHeader(http.StatusForbidden)
		ctx.Writer.Write([]byte("Access Denied"))
		return pipeline.ErrResponseWritten

	case "challenge":
		h.appCfg.LogInfo("[CHALLENGE] Displaying challenge page for IP=%s", ctx.ClientIP)
		h.serveChallenge(ctx)
		return pipeline.ErrResponseWritten
	}

	return nil
}

func (h *ChallengeHandler) serveChallenge(ctx *pipeline.Context) {
	ct := h.registry.Pick()
	if ct == nil {
		h.appCfg.LogError("[CHALLENGE] No challenge types registered")
		ctx.Writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	data := h.store.Create(ct)

	target, _ := data.Payload["target"].(int)

	// Obfuscate target: XOR with a random key so it's not plaintext in DOM
	obfKey := 50 + mrand.Intn(150) // random key 50-199
	obfTarget := target ^ obfKey

	pages.ServeChallengePage(ctx.Writer, pages.ChallengePageData{
		ChallengeID: data.ID,
		Type:        data.Type,
		Target:      0, // no longer used directly
		MaxAttempts: h.store.MaxRetries(),
		Timeout:     h.store.TTLSeconds(),
		Host:        ctx.Request.Host,
		ObfKey:      obfKey,
		ObfTarget:   obfTarget,
	})
}
