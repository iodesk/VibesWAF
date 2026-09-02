package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/iodesk/VibesWAF/internal/api/v1/dto"
	cfg "github.com/iodesk/VibesWAF/internal/config"
	"github.com/iodesk/VibesWAF/internal/model"
	"github.com/iodesk/VibesWAF/internal/repository"
)

type BotPatternHandler struct {
	repo *repository.BotPatternRepository
}

func NewBotPatternHandler(repo *repository.BotPatternRepository) *BotPatternHandler {
	return &BotPatternHandler{repo: repo}
}

func (h *BotPatternHandler) List(w http.ResponseWriter, r *http.Request) {
	patterns, err := h.repo.GetAllPatterns()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch bot patterns")
		return
	}

	response := make([]dto.BotPatternResponse, len(patterns))
	for i, p := range patterns {
		response[i] = dto.BotPatternResponse{
			ID:          p.ID,
			PatternType: p.PatternType,
			Pattern:     p.Pattern,
			Score:       p.Score,
			VerifyIP:    p.VerifyIP,
			Enabled:     p.Enabled,
			Description: p.Description,
			CreatedAt:   p.CreatedAt.Format(time.RFC3339),
			UpdatedAt:   p.UpdatedAt.Format(time.RFC3339),
		}
	}

	respondJSON(w, http.StatusOK, response)
}

func (h *BotPatternHandler) Create(w http.ResponseWriter, r *http.Request) {
	if cfg.GetAppConfig().DemoMode {
		respondError(w, http.StatusForbidden, "Restrict Demo Only")
		return
	}

	var req dto.CreateBotPatternRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}


	if req.PatternType == "" || req.Pattern == "" {
		respondError(w, http.StatusBadRequest, "PatternType and Pattern are required")
		return
	}


	if req.PatternType == "good_bot" {
		if req.Score > 0 {
			respondError(w, http.StatusBadRequest, fmt.Sprintf("Invalid score for good_bot: %d. Must be 0 or negative (e.g., -100)", req.Score))
			return
		}
	} else {
		if req.Score < 0 || req.Score > 50 {
			respondError(w, http.StatusBadRequest, fmt.Sprintf("Invalid score for %s: %d. Must be between 0-50", req.PatternType, req.Score))
			return
		}
	}

	pattern := &model.BotPattern{
		PatternType: req.PatternType,
		Pattern:     req.Pattern,
		Score:       req.Score,
		VerifyIP:    req.VerifyIP,
		Enabled:     req.Enabled,
		Description: req.Description,
	}

	if err := h.repo.AddPattern(pattern); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create bot pattern")
		return
	}

	resp := dto.BotPatternResponse{
		ID:          pattern.ID,
		PatternType: pattern.PatternType,
		Pattern:     pattern.Pattern,
		Score:       pattern.Score,
		VerifyIP:    pattern.VerifyIP,
		Enabled:     pattern.Enabled,
		Description: pattern.Description,
		CreatedAt:   pattern.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   pattern.UpdatedAt.Format(time.RFC3339),
	}

	respondJSON(w, http.StatusCreated, resp)
}

func (h *BotPatternHandler) Update(w http.ResponseWriter, r *http.Request) {
	if cfg.GetAppConfig().DemoMode {
		respondError(w, http.StatusForbidden, "Restrict Demo Only")
		return
	}

	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 5 {
		respondError(w, http.StatusBadRequest, "Invalid URL")
		return
	}
	idStr := parts[4]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var req dto.UpdateBotPatternRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.PatternType == "" || req.Pattern == "" {
		respondError(w, http.StatusBadRequest, "PatternType and Pattern are required")
		return
	}


	if req.PatternType == "good_bot" {
		if req.Score > 0 {
			respondError(w, http.StatusBadRequest, fmt.Sprintf("Invalid score for good_bot: %d. Must be 0 or negative (e.g., -100)", req.Score))
			return
		}
	} else {
		if req.Score < 0 || req.Score > 50 {
			respondError(w, http.StatusBadRequest, fmt.Sprintf("Invalid score for %s: %d. Must be between 0-50", req.PatternType, req.Score))
			return
		}
	}

	pattern := &model.BotPattern{
		ID:          id,
		PatternType: req.PatternType,
		Pattern:     req.Pattern,
		Score:       req.Score,
		VerifyIP:    req.VerifyIP,
		Enabled:     req.Enabled,
		Description: req.Description,
	}

	if err := h.repo.UpdatePattern(pattern); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update bot pattern")
		return
	}

	resp := dto.BotPatternResponse{
		ID:          pattern.ID,
		PatternType: pattern.PatternType,
		Pattern:     pattern.Pattern,
		Score:       pattern.Score,
		VerifyIP:    pattern.VerifyIP,
		Enabled:     pattern.Enabled,
		Description: pattern.Description,
		UpdatedAt:   time.Now().Format(time.RFC3339),
	}

	respondJSON(w, http.StatusOK, resp)
}

func (h *BotPatternHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if cfg.GetAppConfig().DemoMode {
		respondError(w, http.StatusForbidden, "Restrict Demo Only")
		return
	}

	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 5 {
		respondError(w, http.StatusBadRequest, "Invalid URL")
		return
	}
	idStr := parts[4]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	if err := h.repo.DeletePattern(id); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete bot pattern")
		return
	}

	respondJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *BotPatternHandler) BulkDelete(w http.ResponseWriter, r *http.Request) {
	if cfg.GetAppConfig().DemoMode {
		respondError(w, http.StatusForbidden, "Restrict Demo Only")
		return
	}
	var req struct {
		IDs []int `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	if len(req.IDs) == 0 {
		respondError(w, http.StatusBadRequest, "ids is required")
		return
	}
	if len(req.IDs) > 500 {
		respondError(w, http.StatusBadRequest, "Maximum 500 patterns per bulk delete")
		return
	}

	deleted, err := h.repo.BulkDeletePatterns(req.IDs)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to bulk delete bot patterns")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"deleted": deleted,
		"message": fmt.Sprintf("%d patterns deleted", deleted),
	})
}

func (h *BotPatternHandler) BulkCreate(w http.ResponseWriter, r *http.Request) {
	if cfg.GetAppConfig().DemoMode {
		respondError(w, http.StatusForbidden, "Restrict Demo Only")
		return
	}

	var req dto.BulkCreateBotPatternRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if len(req.Patterns) == 0 {
		respondError(w, http.StatusBadRequest, "patterns is required")
		return
	}
	if len(req.Patterns) > 500 {
		respondError(w, http.StatusBadRequest, "Maximum 500 patterns per bulk create")
		return
	}
	if req.PatternType == "" {
		respondError(w, http.StatusBadRequest, "pattern_type is required")
		return
	}

	if req.PatternType == "good_bot" {
		if req.Score > 0 {
			respondError(w, http.StatusBadRequest, fmt.Sprintf("Invalid score for good_bot: %d. Must be 0 or negative", req.Score))
			return
		}
	} else {
		if req.Score < 0 || req.Score > 50 {
			respondError(w, http.StatusBadRequest, fmt.Sprintf("Invalid score for %s: %d. Must be between 0-50", req.PatternType, req.Score))
			return
		}
	}

	patterns := make([]model.BotPattern, 0, len(req.Patterns))
	for _, p := range req.Patterns {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		patterns = append(patterns, model.BotPattern{
			PatternType: req.PatternType,
			Pattern:     p,
			Score:       req.Score,
			VerifyIP:    req.VerifyIP,
			Enabled:     req.Enabled,
			Description: req.Description,
		})
	}

	if len(patterns) == 0 {
		respondError(w, http.StatusBadRequest, "No valid patterns provided")
		return
	}

	created, err := h.repo.BulkCreatePatterns(patterns)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to bulk create bot patterns: "+err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"created": created,
		"message": fmt.Sprintf("%d patterns created", created),
	})
}

func (h *BotPatternHandler) BulkUpdate(w http.ResponseWriter, r *http.Request) {
	if cfg.GetAppConfig().DemoMode {
		respondError(w, http.StatusForbidden, "Restrict Demo Only")
		return
	}

	var req dto.BulkUpdateBotPatternRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if len(req.IDs) == 0 {
		respondError(w, http.StatusBadRequest, "ids is required")
		return
	}
	if len(req.IDs) > 500 {
		respondError(w, http.StatusBadRequest, "Maximum 500 patterns per bulk update")
		return
	}

	if req.PatternType == "" && req.Score == nil && req.VerifyIP == nil && req.Enabled == nil {
		respondError(w, http.StatusBadRequest, "At least one field to update is required")
		return
	}

	if req.PatternType != "" {
		validTypes := map[string]bool{"good_bot": true, "bad_bot": true, "suspicious_ua": true, "bad_referer": true}
		if !validTypes[req.PatternType] {
			respondError(w, http.StatusBadRequest, "Invalid pattern_type")
			return
		}
	}

	if req.Score != nil {
		if *req.Score < -200 || *req.Score > 50 {
			respondError(w, http.StatusBadRequest, "Score must be between -200 and 50")
			return
		}
	}

	updated, err := h.repo.BulkUpdatePatterns(req.IDs, req.PatternType, req.Score, req.VerifyIP, req.Enabled)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to bulk update bot patterns: "+err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"updated": updated,
		"message": fmt.Sprintf("%d patterns updated", updated),
	})
}
