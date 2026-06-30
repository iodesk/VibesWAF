# Changelog


## [1.0.3] - 2026-06-30

### Changed

- Enhanced pipeline trace with structured evidence for fingerprinting. Added `RequestMetadata` (ip, method, path, host, user_agent, ja4, ja4h, ja4h_ua_hash, actual_ua_hash, ua_match, http_fingerprint) to trace root. Each stage now captures structured evidence: BotDetection (signals array), WAF (matched rules with ID/category/severity), ProtocolAnomaly (violations array with type/score/detail), IPAccess (matched_rule, ip_range, action), CustomRules (id, name, action, scope), DecisionCache (action, source, reason). (`internal/pipeline/trace.go`, `internal/pipeline/pipeline.go`, handlers/)
- Frontend pipeline trace UI now shows only `reason` field; full JSON with `reason` + `evidence` available in Raw JSON toggle. (`frontend/src/pages/monitoring/Logs.tsx`)
- Added `FingerprintSection` to pipeline trace UI showing JA4, JA4H, JA4H_UA_Hash, ActualUA_Hash, and UA_Match comparison for admin observation. (`frontend/src/pages/monitoring/Logs.tsx`)
- Enhanced stable session scorer with IP+JA4+fingerprint matching. Stored format: `ja4|ja4h_ua_hash|fingerprint`. Evidence now includes `ja4_match`, `ja4h_match`, `fp_match` booleans. (`internal/pipeline/handlers/stable_session_scorer.go`)

### Internal

- `const Version = "1.0.3"` in `internal/config/app_config.go`.

---

## [1.0.2] - 2026-06-13

### Security

- Fix last remaining `{{.ObfKey}}` / `{{.ObfTarget}}` references in challenge HTML template that broke challenge page rendering (500 error).

### Changed

- Challenge-passed users now respect custom rule `skip` actions (skip_modules) so WAF bypass on known paths still works after solving a slider challenge. Previously the entire rules engine was skipped when a challenge cookie was present. (`internal/pipeline/handlers/rules_engine_handler.go`)
- Add `AUTO_MIGRATE` env flag (defaults to true). Set to false to skip automatic DB migration at startup.
- Fix PostgreSQL migration: `ADD CONSTRAINT IF NOT EXISTS` replaced with `DO $ ... EXCEPTION WHEN duplicate_table` blocks (PG compatible syntax).
- Fix performance percentile all showing identical values: wrong nearest-rank formula (N-1 instead of N), O(n^2) bubble sort blocking writers under read lock, and microsecond truncation losing sub-ms precision. (internal/metrics/performance.go)
- Fix percentile nearest-rank formula: replaced floor truncation with ceil-based index to avoid P95/P99 always returning the max value on small sample sizes. (internal/metrics/performance.go)
- Remove per-app security overrides (WAF/Bot/RateLimit profiles). Superseded by Security Rules (block/allow/challenge/skip per-app) and IP Access Rules (hard decision early-exit). (internal/domain/app/app.go, internal/model/app.go, internal/service/rate_limit_service.go, internal/config/postgres.go, frontend/src/)
- Render ChallengeConfig fields (Title, Description, Footer, CustomHTML, ShowRayID) from DB on challenge page instead of hardcoded text. (internal/pages/challenge.html, internal/pages/pages.go, internal/pipeline/handlers/challenge_handler.go)

### Internal

- `const Version = "1.0.2"` in `internal/config/app_config.go`.

---

## [1.0.1] - 2026-06-13

### Security

- Fix auth middleware X-User-ID header producing garbage via `string(rune(id))` -> `strconv.Itoa`.
- Add per-app trusted proxy CIDR configuration (`AdvancedConfig.TrustedProxies`) with right-to-left X-Forwarded-For walking.
- Close IP spoofing on dashboard API rate limiter via `TRUSTED_PROXIES` env var.
- Remove insecure inline IP extraction in challenge validator; now uses `ctx.ClientIP`.
- Fix race condition in `.env` write during setup (mutex + `0600` permissions).
- Remove XOR obfuscation from slider challenge; trajectory analysis unchanged.
- Use full 256-bit HMAC signature in challenge cookies with 32-char backward compat.
- Set session cookie `SameSite=Lax`.
- Cap regex cache at 500 entries with LRU eviction.
- Raise default bcrypt cost 10->12, fix `BCRYPT_COST` parsing bug.

### Changed

- Challenge cookie format check now accepts 2-part and 3-part cookies.
- `handleWAFVerify` IP extraction prioritises `CF-Connecting-IP`.
- Health endpoint returns version and identifies as `VibesWAF`.
- Frontend: Trusted Proxies section (textarea, one CIDR per line) in Advanced tab.

### Internal

- `ExtractClientIP()` / `ExtractClientIPStatic()` on `app.App`.