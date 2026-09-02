package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/iodesk/VibesWAF/internal/logger"
)

type FingerprintHandler struct {
	logger *logger.Clickhouse
}

func NewFingerprintHandler(logger *logger.Clickhouse) *FingerprintHandler {
	return &FingerprintHandler{logger: logger}
}

type JA4Entry struct {
	JA4  string `json:"ja4"`
	Count uint64 `json:"count"`
}

type JA4Response struct {
	Data  []JA4Entry `json:"data"`
	Total uint64     `json:"total"`
}

func (h *FingerprintHandler) GetJA4Fingerprints(w http.ResponseWriter, r *http.Request) {
	if h.logger == nil || h.logger.Conn() == nil {
		respondError(w, http.StatusServiceUnavailable, "ClickHouse not available")
		return
	}

	limit := 30
	offset := 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Count total unique JA4 fingerprints
	totalQuery := `SELECT uniqExact(ja4) FROM (SELECT JSONExtractString(pipeline_trace, 'request', 'ja4') AS ja4 FROM waf_events WHERE ja4 != '')`
	var total uint64
	row := h.logger.Conn().QueryRow(context.Background(), totalQuery)
	if err := row.Scan(&total); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to query fingerprint total")
		return
	}

	// Query JA4 with counts, paginated
	query := `SELECT ja4, cnt FROM (SELECT JSONExtractString(pipeline_trace, 'request', 'ja4') AS ja4, count() AS cnt FROM waf_events WHERE ja4 != '' GROUP BY ja4 ORDER BY cnt DESC) LIMIT ` + strconv.Itoa(limit) + ` OFFSET ` + strconv.Itoa(offset)

	rows, err := h.logger.Conn().Query(context.Background(), query)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to query fingerprints")
		return
	}
	defer rows.Close()

	var entries []JA4Entry
	for rows.Next() {
		var entry JA4Entry
		if rows.Scan(&entry.JA4, &entry.Count) == nil {
			entries = append(entries, entry)
		}
	}

	if entries == nil {
		entries = []JA4Entry{}
	}

	respondJSON(w, http.StatusOK, JA4Response{
		Data:  entries,
		Total: total,
	})
}

func (h *FingerprintHandler) ExportJA4Fingerprints(w http.ResponseWriter, r *http.Request) {
	if h.logger == nil || h.logger.Conn() == nil {
		respondError(w, http.StatusServiceUnavailable, "ClickHouse not available")
		return
	}

	format := r.URL.Query().Get("format")
	if format != "csv" && format != "json" {
		format = "json"
	}

	query := `SELECT ja4, cnt FROM (SELECT JSONExtractString(pipeline_trace, 'request', 'ja4') AS ja4, count() AS cnt FROM waf_events WHERE ja4 != '' GROUP BY ja4 ORDER BY cnt DESC)`

	rows, err := h.logger.Conn().Query(context.Background(), query)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to query fingerprints")
		return
	}
	defer rows.Close()

	var entries []JA4Entry
	for rows.Next() {
		var entry JA4Entry
		if rows.Scan(&entry.JA4, &entry.Count) == nil {
			entries = append(entries, entry)
		}
	}

	if entries == nil {
		entries = []JA4Entry{}
	}

	if format == "csv" {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=ja4_fingerprints.csv")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ja4,total\n"))
		for _, e := range entries {
			w.Write([]byte(`"` + e.JA4 + `",` + strconv.FormatUint(e.Count, 10) + "\n"))
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=ja4_fingerprints.json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(entries)
}
