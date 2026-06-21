package handlers

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/vibeswaf/waf/internal/challenge"
	"github.com/vibeswaf/waf/internal/config"
	"github.com/vibeswaf/waf/internal/pages"
	"github.com/vibeswaf/waf/internal/pipeline"
	"github.com/vibeswaf/waf/internal/service"
)

type ChallengeHandler struct {
	registry *challenge.Registry
	store    *challenge.Store
	botSvc   *service.BotDetectionService
	appCfg   *config.AppConfig
}

func NewChallengeHandler(registry *challenge.Registry, store *challenge.Store, botSvc *service.BotDetectionService) *ChallengeHandler {
	return &ChallengeHandler{
		registry: registry,
		store:    store,
		botSvc:   botSvc,
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

	botCfg := h.botSvc.GetConfig()
	rayID := generateRayID()

	pages.ServeChallengePage(ctx.Writer, pages.ChallengePageData{
		ChallengeID: data.ID,
		Type:        data.Type,
		Target:      target,
		MaxAttempts: h.store.MaxRetries(),
		Timeout:     h.store.TTLSeconds(),
		Host:        ctx.Request.Host,
		Title:       botCfg.Challenge.Title,
		Description: botCfg.Challenge.Description,
		Footer:      botCfg.Challenge.Footer,
		CustomHTML:  botCfg.Challenge.CustomHTML,
		ShowRayID:   botCfg.Challenge.ShowRayID,
		RayID:       rayID,
	})
}

func generateRayID() string {
	id := uuid.New()
	return id.String()[:13]
}