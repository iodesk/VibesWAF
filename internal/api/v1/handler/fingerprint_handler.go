package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/iodesk/VibesWAF/internal/logger"
)

type FingerprintHandler struct {
	logger *logger.Clickhouse
}

func NewFingerprintHandler(logger *logger.Clickhouse) *FingerprintHandler {
	return &FingerprintHandler{logger: logger}
}

type JA4Entry struct {
	JA4       string `json:"ja4"`
	Count     uint64 `json:"count"`
	UniqueIPs uint64 `json:"unique_ips"`
	TopUA     string `json:"top_ua"`
	LastSeen  string `json:"last_seen"`
}

type JA4Response struct {
	Data  []JA4Entry `json:"data"`
	Total uint64     `json:"total"`
}

type JA4Detail struct {
	JA4             string   `json:"ja4"`
	JA4H            string   `json:"ja4h"`
	HTTPFingerprint string   `json:"http_fingerprint"`
	UAMatch         bool     `json:"ua_match"`
	Count           uint64   `json:"count"`
	UniqueIPs       uint64   `json:"unique_ips"`
	TopUA           []string `json:"top_ua"`
	TopPaths        []string `json:"top_paths"`
	TopIPs          []string `json:"top_ips"`
	TopHosts        []string `json:"top_hosts"`
	FirstSeen       string   `json:"first_seen"`
	LastSeen        string   `json:"last_seen"`
}

func (h *FingerprintHandler) GetJA4Fingerprints(w http.ResponseWriter, r *http.Request) {
	if h.logger == nil || h.logger.Conn() == nil {
		respondError(w, http.StatusServiceUnavailable, "ClickHouse not available")
		return
	}

	limit := 100
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

	// Main query: scalar columns only, toString(max(ts)) to avoid DateTime64 scan mismatch
	query := `SELECT ja4, cnt, unique_ips, top_ua, last_seen FROM (SELECT ` +
		`JSONExtractString(pipeline_trace, 'request', 'ja4') AS ja4, ` +
		`count() AS cnt, ` +
		`uniqExact(ip) AS unique_ips, ` +
		`any(ua) AS top_ua, ` +
		`toString(max(ts)) AS last_seen ` +
		`FROM waf_events WHERE ja4 != '' ` +
		`GROUP BY ja4 ORDER BY cnt DESC) ` +
		`LIMIT ` + strconv.Itoa(limit) + ` OFFSET ` + strconv.Itoa(offset)

	rows, err := h.logger.Conn().Query(context.Background(), query)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to query fingerprints")
		return
	}
	defer rows.Close()

	var entries []JA4Entry
	for rows.Next() {
		var entry JA4Entry
		if rows.Scan(&entry.JA4, &entry.Count, &entry.UniqueIPs, &entry.TopUA, &entry.LastSeen) == nil {
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

func (h *FingerprintHandler) GetJA4Detail(w http.ResponseWriter, r *http.Request, ja4 string) {
	if h.logger == nil || h.logger.Conn() == nil {
		respondError(w, http.StatusServiceUnavailable, "ClickHouse not available")
		return
	}

	if ja4 == "" {
		respondError(w, http.StatusBadRequest, "JA4 parameter required")
		return
	}

	query := `SELECT ` +
		`any(ja4) AS ja4, ` +
		`any(ja4h) AS ja4h, ` +
		`any(http_fingerprint) AS http_fp, ` +
		`max(ua_match_int) AS ua_match, ` +
		`count() AS total, ` +
		`uniqExact(ip) AS unique_ips, ` +
		`groupArray(5)(ua) AS top_uas, ` +
		`groupArray(5)(path) AS top_paths, ` +
		`groupArray(5)(ip) AS top_ips, ` +
		`groupArray(5)(host) AS top_hosts, ` +
		`toString(min(ts)) AS first_seen, ` +
		`toString(max(ts)) AS last_seen ` +
		`FROM (SELECT ` +
		`JSONExtractString(pipeline_trace, 'request', 'ja4') AS ja4, ` +
		`JSONExtractString(pipeline_trace, 'request', 'ja4h') AS ja4h, ` +
		`JSONExtractString(pipeline_trace, 'request', 'http_fingerprint') AS http_fingerprint, ` +
		`if(JSONExtractBool(pipeline_trace, 'request', 'ua_match'), 1, 0) AS ua_match_int, ` +
		`ip, ua, path, host, ts ` +
		`FROM waf_events ` +
		`WHERE JSONExtractString(pipeline_trace, 'request', 'ja4') = ?)`

	row := h.logger.Conn().QueryRow(context.Background(), query, ja4)
	var detail JA4Detail
	var uaMatchInt uint8
	if err := row.Scan(
		&detail.JA4, &detail.JA4H, &detail.HTTPFingerprint, &uaMatchInt,
		&detail.Count, &detail.UniqueIPs,
		&detail.TopUA, &detail.TopPaths, &detail.TopIPs, &detail.TopHosts,
		&detail.FirstSeen, &detail.LastSeen,
	); err != nil {
		respondError(w, http.StatusNotFound, "Fingerprint not found")
		return
	}
	detail.UAMatch = uaMatchInt == 1

	respondJSON(w, http.StatusOK, detail)
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

	query := `SELECT ja4, cnt, unique_ips, top_ua, last_seen FROM (SELECT ` +
		`JSONExtractString(pipeline_trace, 'request', 'ja4') AS ja4, ` +
		`count() AS cnt, ` +
		`uniqExact(ip) AS unique_ips, ` +
		`any(ua) AS top_ua, ` +
		`toString(max(ts)) AS last_seen ` +
		`FROM waf_events WHERE ja4 != '' ` +
		`GROUP BY ja4 ORDER BY cnt DESC)`

	rows, err := h.logger.Conn().Query(context.Background(), query)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to query fingerprints")
		return
	}
	defer rows.Close()

	var entries []JA4Entry
	for rows.Next() {
		var entry JA4Entry
		if rows.Scan(&entry.JA4, &entry.Count, &entry.UniqueIPs, &entry.TopUA, &entry.LastSeen) == nil {
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
		w.Write([]byte("ja4,total,unique_ips,top_ua,last_seen\n"))
		for _, e := range entries {
			ua := strings.ReplaceAll(e.TopUA, `"`, `""`)
			w.Write([]byte(`"` + e.JA4 + `",` + strconv.FormatUint(e.Count, 10) + "," + strconv.FormatUint(e.UniqueIPs, 10) + `,"` + ua + `",` + e.LastSeen + "\n"))
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=ja4_fingerprints.json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(entries)
}
