# Changelog

## [1.0.6] - 2026-08-10

### Performance

- IPAccess: preload all rules into memory at startup with atomic swap; eliminates PostgreSQL query per request on hot path. (`internal/service/ip_access_service.go`, `internal/repository/ip_access_repository.go`)
- MaxMind: changed Lookup() from exclusive Lock to RLock; ASN/datacenter maps are now read-only during request processing, eliminating concurrent request serialization. (`internal/service/maxmind_service.go`)
- RateLimiter: sharded into 256 partitions with per-shard mutex; evictOldest() now scans only the target shard (~2K entries) instead of global 500K map. (`internal/ratelimit/token_bucket.go`)
- Bot fingerprint: pre-sorted static header list eliminates per-request sort; replaced SHA-256 with FNV-64a for faster hashing. (`internal/bot/fingerprint.go`)
- RiskScore: replaced ByCategory map with fixed CategoryScores struct; eliminates map allocation per request. (`internal/pipeline/risk_score.go`, `internal/pipeline/pipeline.go`, `internal/pipeline/decision_engine.go`)
- Decision.Metadata: lazy initialization (nil by default); eliminates map allocation per decision. (`internal/pipeline/decision.go`)
- WAF_SECRET: cached at startup in ChallengeValidator struct; eliminates os.Getenv syscall per cookie validation. (`internal/pipeline/handlers/challenge_validator.go`)
- enrichTraceWithWeights: replaced 2 map allocations with inline switch; zero allocation for trace weight enrichment. (`internal/pipeline/pipeline.go`)
- ChallengeValidator: HMAC hasher pooled via sync.Pool; eliminates hash allocation per cookie verification. (`internal/pipeline/handlers/challenge_validator.go`)
- Decision cache key: replaced SHA-256 with FNV-64a; eliminates heavy hash allocation per cache lookup. (`internal/cache/decision_cache.go`)
- Flood shardFor: inline FNV-1a replaces hash/fnv.New32a() allocation; zero-alloc shard selection. (`internal/ratelimit/flood.go`)
- RateLimiter GenerateKey: replaced SHA-256 with FNV-64a for internal key hashing. (`internal/ratelimit/key.go`)
- IP Reputation: replaced linear CIDR scan with prefix trie (bit-level); lookup is now O(k) where k=prefix length (max 32 for IPv4, 128 for IPv6) regardless of entry count. (`internal/service/ip_trie.go`, `internal/service/ip_reputation_service.go`)
- Bot UA detection: pre-indexed known bot patterns at load time; `isKnownBotUA()` now iterates only enabled good_bot/bad_bot patterns instead of all patterns. (`internal/service/bot_detection_service.go`)

### Internal

- ClickHouse auto-reconnects every 5s when down; worker retries connection until healthy, then re-runs idempotent migration. (`internal/logger/worker.go`, `internal/logger/clickhouse.go`, `main.go`)

### Changed

- Migrated from OpenResty to pure nginx: JA4/JA4S/JA4H computed by native nginx module instead of Lua (`resty.ja4`/`resty.ja4h`); dynamic certs via `ssl_dynamic_certificate_*` directives instead of `ssl_certificate_by_lua_file`; `X-JA4`/`X-JA4H` still forwarded so Go backend is unchanged. (`config/nginx.conf.SELF`)
- JA4H forwarded with `ja4h_` prefix (`proxy_set_header X-JA4H "ja4h_$http_ja4h"`) so Go parser (`extractUAHashFromJA4H`) keeps working without code changes. (`config/nginx.conf.SELF`)
- Flood exclude: basic flood protector now skips counting requests matching configured file extensions or path prefixes. (`internal/model/settings.go`, `internal/pipeline/handlers/flood_handler.go`)
- Rate Limiter dashboard: added Exclude section with CRUD for extensions and paths. (`frontend/src/pages/security/RateLimiter.tsx`)
- Default exclude extensions: `.js`, `.css`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.ico`, `.woff`, `.woff2`, `.webp`, `.map`. (`internal/migration/init_postgres.sql`)
- Bot DNS Verification: added global enable/disable toggle in Bot Detector dashboard settings. When disabled, good bot IP verification via DNS is skipped entirely. (`internal/model/settings.go`, `internal/service/bot_detection_service.go`, `frontend/src/pages/security/BotDetector.tsx`, `frontend/src/lib/api/types.ts`)

### Internal

- `const Version = "1.0.6"` in `internal/config/app_config.go`.

## [1.0.5] - 2026-07-07

### Internal

- HTTP fingerprint upgraded from SHA-1 to SHA-256, now includes JA4, JA4H, HTTP version, TLS version, and ALPN. (`internal/bot/fingerprint.go`)

### Changed

- Performance stats now show last-known P50/P95/P99 when window is empty instead of blank dash. (`internal/metrics/performance.go`)
- Demo banner now sticky top, full width, shows "Point your domain to IP: x.x.x.x" via `SERVER_IP` env. (`frontend/src/App.tsx`)
- Login page shows demo credentials (`DEMO_USER`/`DEMO_PASS`) when demo mode active. (`frontend/src/pages/auth/Login.tsx`)
- Added `DEMO_USER`, `DEMO_PASS`, `SERVER_IP` env vars to `.env`, `.env.demo`, `.env.example`. (`internal/config/app_config.go`)
- Health endpoint returns `demo_user`, `demo_pass`, `server_ip` when demo mode enabled. (`internal/api/v1/handler/health_handler.go`)
- DemoContext exposes `demoUser`, `demoPass`, `serverIP` from health response. (`frontend/src/contexts/DemoContext.tsx`)
- Domain-level `root_redirect` added — 302 redirect / to custom path (e.g. auto-login URL). (`internal/domain/app/app.go`, `internal/api/v1/handler/waf_handler.go`, `frontend/src/lib/api/types.ts`, `frontend/src/pages/applications/tabs/BasicTab.tsx`)
- `upstream_tls_sni` added to Advanced config — override TLS ServerName (SNI) for upstream HTTPS connections. Pool key includes SNI to prevent transport reuse conflicts. (`internal/domain/app/app.go`, `internal/transport/proxy_transport.go`, `internal/api/v1/handler/waf_handler.go`, `frontend/src/lib/api/types.ts`, `frontend/src/pages/applications/tabs/AdvancedTab.tsx`)
- CreateApp now syncs existing filesystem cert to DB or creates pending cert record and auto-issues via LE; no more manual sync needed for certs to appear in panel. (`internal/service/app_service.go`, `internal/service/certificate_service.go`, `main.go`)
- PerformanceMetrics shown always (no `return null` when empty); fallback `—` when no traffic data. (`frontend/src/components/shared/PerformanceMetrics.tsx`)
- Error toast on AppForm/Applications now shows actual API error message instead of generic fallback. (`frontend/src/pages/applications/AppForm.tsx`, `frontend/src/pages/applications/Applications.tsx`)
- SSL CertificateTable and SSLManager now show toast notifications on success/error instead of silent console.error. (`frontend/src/components/ssl/CertificateTable.tsx`, `frontend/src/pages/security/SSLManager.tsx`)

### Security

- Demo mode now blocks update/delete of immortal domain (`DEMO_DOMAIN_IMO`) via API guard in `AppService`. (`internal/service/app_service.go`)

### Internal

- Drop erroneous unique constraint `ip_access_rules_ip_range_key` on `ip_access_rules.ip_range` — app-level overlap check in service already prevents duplicates. (`internal/migration/init_postgres.sql`, `migrations/init_postgres.sql`)

---

## [1.0.4] - 2026-07-01

### Security

- SSL renew now forces re-issue via `--force` flag; previously `IssueAsync` skipped renewal if cert files existed on disk. (`internal/acme/service.go`, `internal/service/certificate_service.go`)

### Changed

- Added `POST /api/v1/certificates` endpoint to issue SSL certificates for new domains manually from the dashboard. (`internal/api/v1/handler/certificate_handler.go`, `internal/api/v1/router.go`, `internal/service/certificate_service.go`, `internal/api/v1/dto/certificate_dto.go`)
- SSL Manager: added "Add Domain" button that opens a dialog to issue a new Let's Encrypt certificate via acme.sh. (`frontend/src/pages/security/SSLManager.tsx`, `frontend/src/hooks/ssl/useSSLActions.ts`, `frontend/src/lib/api/client.ts`)
- ACME worker now serial (queue-based) so port 8080 is never contended; multiple renew/issue requests queue instead of erroring. (`internal/acme/service.go`)
- SSL auto-poll: frontend polls every 5s while any certificate is pending, stops after all resolved. (`frontend/src/hooks/ssl/useSSLCertificates.ts`)
- Bulk renew: "Renew Selected" button when certificates are selected in table. (`frontend/src/components/ssl/CertificateTable.tsx`)

### Internal

- Added `RenewAsync` method to `acme.Service` that calls `--issue --force`; `IssueAsync` retains original skip-if-exists behavior for auto-provisioning. (`internal/acme/service.go`)
- Added `IssueDomain(domain, appID)` to `CertificateService` creating a pending DB record then async-issuing. (`internal/service/certificate_service.go`)
- Added `IssueCertificateRequest` DTO. (`internal/api/v1/dto/certificate_dto.go`)
- Added `certificates.issue` to API client. (`frontend/src/lib/api/client.ts`)
- Certificate status auto-updated after async issue/renew via onComplete callback. (`internal/acme/service.go`, `internal/service/certificate_service.go`)
- Fixed `toCertificateInfo` marking pending certs as `IsExpiringSoon`. (`internal/service/certificate_service.go`)
- Fixed `CertificateDetailsDialog` using manual overlay instead of `DialogContent` component. (`frontend/src/components/ssl/CertificateDetailsDialog.tsx`)
- `const Version = "1.0.4"` in `internal/config/app_config.go`.

### Performance

- ACME serial worker avoids port 8080 contention; queue-based dedup prevents duplicate work. (`internal/acme/service.go`)

---

### Changed

- API `/api/v1/*` restricted to dashboard host only; requests from WAF-proxied domains go to WAF pipeline. CORS headers removed, no longer needed. (`internal/api/v1/router.go`)
- Removed `CORS_ALLOW_ORIGIN`, `CORS_ALLOW_METHODS`, `CORS_ALLOW_HEADERS`, `CORS_MAX_AGE` env vars. (`.env.example`, `.env`)
- Added demo mode: `DEMO=true` enables a shared demo instance where global config (bot, WAF, scoring, rate limit, protocol anomaly, IP reputation, certificates) is locked with a `403 Restrict Demo Only` response on any write attempt. (`internal/api/v1/handler/`)
- Demo mode exposes `demo` flag in `/health` response; frontend shows an amber banner when active. (`internal/api/v1/handler/health_handler.go`, `frontend/src/contexts/DemoContext.tsx`, `frontend/src/App.tsx`)
- Per-app config (domain, security rules, advanced settings, IP access rules) remains fully editable in demo mode.
- Auto-reset cron deletes all non-immortal apps and certificates on a configurable interval (`DEMO_AUTO_DEL` hours, 0 = disabled). Immortal domain set via `DEMO_DOMAIN_IMO`. ClickHouse analytics are never deleted. (`internal/service/demo_service.go`)
- First run seeds the immortal demo domain with a default app config if it does not exist. (`internal/service/demo_service.go`)
- All frontend API calls now use `apiBase` from `src/lib/api/client.ts` as single source of truth; removed inline `VITE_API_BASE_URL` fallbacks across 7 files. (`src/lib/api/client.ts`, `src/hooks/*`, `src/contexts/AuthContext.tsx`, `src/pages/auth/Setup.tsx`, `src/lib/field-metadata.ts`)

### Internal

- Embed frontend `dist/` into Go binary via `ui.go` at root; `//go:embed frontend/dist` reads build output directly without a copy step. (`ui.go`, `internal/api/v1/router.go`)
- Dashboard subdomain routing via `DASHBOARD_HOST` env var; loopback access always works as fallback. (`internal/api/v1/router.go`, `internal/config/app_config.go`)
- `deploy.sh` builds frontend with `VITE_API_BASE_URL=""` then `go build` embeds it directly. (`config/deploy.sh`)
- `frontend/dist/` excluded from git; embedded at compile time from source tree. (`.gitignore`)
- Added `DEMO`, `DEMO_DOMAIN_IMO`, `DEMO_AUTO_DEL` env vars to `.env` and `.env.example`.
- Added `DemoMode`, `DemoDomain`, `ResetIntervalH` fields to `AppConfig`; added `parseNonNegativeInt` helper. (`internal/config/app_config.go`)
- Added `DemoService` with scheduler goroutine and `DeleteAllExcept` repo methods. (`internal/service/demo_service.go`, `internal/repository/app_repository.go`, `internal/repository/certificate_repository.go`)
- Added `SettingsRepository.Update` generic key-value write for `last_demo_reset` tracking. (`internal/repository/settings_repository.go`)
- Added `DefaultAppConfig()` to `internal/domain/app/app.go` for seeding.
- `const Version = "1.0.4"` in `internal/config/app_config.go`.

---

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