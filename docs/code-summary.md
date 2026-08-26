# Code Summary — VibesWAF

A comprehensive summary of what each module in VibesWAF does, as a guide for
future development. VibesWAF is a reverse proxy + WAF written in **Go** (backend
pipeline) and **React + Vite** (dashboard), processing traffic through a
deterministic 4-phase pipeline.

---

## 1. High-Level Architecture

```
Internet ─▶ OpenResty (TLS + JA4 fingerprint) ─▶ Go WAF Pipeline
   └─ Phase 1 (Hard Rules: ChallengeValidator → IPAccess → Flood → RateLimit → Cache → Rules)
   └─ Phase 2 (Scoring: IPReputation → BotDetection → WAFEngine → ProtocolAnomaly → Trust)
   └─ Phase 3 (Decision: Score ≥70 BLOCK / ≥35 CHALLENGE / <35 ALLOW)
   └─ Phase 4 (Response: Block page / Challenge slider / Proxy upstream)
```

**Core principles (from AGENTS.md):**
- FINAL decision only comes from Phase 3 (DecisionEngine), except when Phase 1
  sets `HardDecision`, which short-circuits straight to Phase 4.
- No hardcoded scores/thresholds in handlers — everything comes from the DB
  (atomic swap into memory).
- Zero DB queries on the request path (config loaded via `unsafe.Pointer` +
  `atomic.LoadPointer`).
- Logging is an async side-effect (not a decision).

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Core proxy + pipeline | Go 1.25+, `net/http` |
| Managed WAF rules | Coraza + OWASP CRS |
| Config storage | PostgreSQL 14+ (`lib/pq`) |
| Request logs + analytics | ClickHouse |
| State (rate limit, challenge, trust) | Redis (graceful degrade) |
| TLS termination + stream | OpenResty 1.29.2.3 (lua-resty-ja4) |
| Dashboard | React 18 + TypeScript + Vite 8 + Tailwind v4 |
| Data fetching | @tanstack/react-query v5 |

---

## 3. Backend (Go) — `internal/`

### 3.1 Entry & Boot
- **`main.go`** — Bootstrap: load `.env` → connect PostgreSQL (+auto-migrate) →
  ClickHouse (degrades if down) → Redis (if `ENABLE_REDIS`) → build all
  services → construct pipeline Phase 1–4 → `v1.NewRouter` → `ListenAndServe`
  (`HTTP_PORT`, default `127.0.0.1:3044`) + `appService.StartStreamApps()`.
  Graceful 10s shutdown on SIGINT/TERM.
- **`ui.go`** — Embeds `frontend/dist` as a SPA, falling back to `index.html`
  for client-side routing. (Note: `internal/ui/dist` is empty — the build
  source lives at root `frontend/dist`.)

### 3.2 Pipeline Core — `internal/pipeline/`
The brain of the system. A single `Context` holds shared state (typed hot-path
fields + a lazily-allocated `Extra` map).

| File | Function |
|------|----------|
| `pipeline.go` | Orchestrator. `Execute()` runs the Phase 1 loop → if `HardDecision` skip to Phase 4 → else Phase 2 → apply caps/multipliers → `ClampTotal()` → Phase 3 → Phase 4. `ExecuteWebSocketChecks()` = Phase 1 subset for WS upgrades. |
| `context.go` | `Context` = shared state. `AddDecision` (rank-resolve), `AddScore`, `GetMetadata()` (lazy map only for the rule engine), phase flags (`HardDecision`, `IPRuleTerminal`, `ChallengePassed`, `SkipModules`). |
| `decision.go` | `Decision{Action,Source,Reason}` + `ResolveDecision` (rank: block=4 > challenge=3 > allow=2 > log=1). |
| `decision_engine.go` | **Phase 3.** Reads total score, compares `Block`/`Challenge` thresholds, sets action. |
| `block_handler.go` | **Phase 4.** If action=block → serve blocked page, return `ErrResponseWritten`. |
| `normalize.go` | `Normalize()` once per request: URL-decode + lowercase path/query/host, strip null bytes. All handlers read from here. |
| `risk_score.go` | `RiskScore` accumulates score per category (`ip_reputation`, `bot_detection`, `waf_anomaly`, `protocol_anomaly`, `trust`). `ApplyCap`/`ApplyMultiplier`/`ClampTotal(0–100)`. |
| `trace.go` | `PipelineTrace` + `StageTrace` for ClickHouse audit (JSON-serialized). |
| `handlers/` | See section 3.3. |

### 3.3 Phase Handlers — `internal/pipeline/handlers/`
**Phase 1 (Hard Rules):**
- `challenge_validator.go` — Checks the `ok` cookie (HMAC over `IP:UA:ts[:level]`
  with `WAF_SECRET`). Valid → `ChallengePassed=true`, skips many handlers.
- `ip_access_handler.go` — `ipAccessService.CheckIPInMemory` (in-memory CIDR lookup, zero DB query). Match → decision +
  `IPRuleTerminal=true` + `HardDecision=true` (skips Rate/Flood/Cache/Rules/WAF).
- `flood_handler.go` — `FloodProtector` (attack/error/basic limits). Breach →
  `HardDecision` + penalty window.
- `rate_limit_handler.go` — `rateLimitService.Allow()`. Deny → `HardDecision`.
- `cache_check_handler.go` — `decisionCache.Get()`. HIT → apply cached decision.
- `rules_engine_handler.go` — `ruleService.LoadMergedRules(appID)`, evaluates
  each rule. Actions: allow/block/challenge (HardDecision + cache), log (record
  only), skip (adds `SkipModules`). `evaluateChallengePassed` variant for
  already-verified users (ignores terminal actions).

**Phase 2 (Scoring):**
- `ip_reputation_scorer.go` — Manual IP/ASN override → else MaxMind
  (datacenter/cloud). Capped at `MaxScore`.
- `bot_detection_handler.go` — `botService.AnalyzeRequest` → `bot_detection` score.
- `waf_engine_handler.go` — `wafService.DetectOnly` (Coraza/CRS, NO blocking) →
  `waf_anomaly` score.
- `protocol_anomaly_handler.go` — Self-reloading (atomic pointer, 30s ticker).
  Checks header inconsistency, cookie anomaly, JA4 anomaly (HTTP/1.0 browser UA,
  old TLS, UA↔JA4H hash mismatch).
- `trust_scorer.go` — Only if `ChallengePassed`. Negative reduction from
  `TrustLevels.Reductions[level]` (0/-5/-10/-15).
- `stable_session_scorer.go` — Redis `ss:<ip>` (JA4+FP, 4h TTL). Match →
  negative `trust` reduction.
- `trusted_history_scorer.go` — Redis `th:<ip>` counter. N clean requests →
  reduction. `RecordCleanRequest()` (on allow) / `ResetHistory()` (on block/challenge).
- `challenge_handler.go` — **Phase 4.** block → 403; challenge → serve slider
  page (maxAttempts/TTL from store); allow → proxy. Skipped if `ChallengePassed`.
- `helpers.go` — `toResult()`, `joinReasons()`.

### 3.4 WAF Engine & Rules — `internal/waf/`, `internal/rules/`
- **`waf/coraza_engine.go`** — Wraps Coraza + OWASP CRS. Extracts CRS to
  `data/coraza-crs`, builds directives (paranoia level, thresholds, disabled
  rules, custom rules). `ProcessRequest()` returns `WAFResult{AnomalyScore,
  MatchedRules}` (categorized by ID range, skips correlation-only 949110–949113).
- **`rules/`** — Custom Security Rule DSL:
  - `fields.go` — FieldRegistry (ip.src, http.host/path/ua, asn, country, ...).
    *(TODO: `client.os`/`client.browser` extractors stubbed to `""`, `req.rate`
    returns 0.)*
  - `operators.go` — OperatorRegistry (eq/neq/in/contains/regex/gt/exists).
  - `lexer.go` — Tokenizes expressions.
  - `parser.go` — Parses into an AST (precedence OR < AND < NOT < parens).
  - `evaluator.go` — Evaluates AST (regex LRU-cached at 500).
  - `validator.go` — Validates field/op/type + ReDoS safety.

### 3.5 Challenge System — `internal/challenge/`
Server-side slider CAPTCHA.
- `challenge.go` — `ChallengeType` interface, `ChallengeData`, `Registry`.
- `slider.go` — target random 20–80, tolerance 4, min solve 1500ms.
- `store.go` — In-memory map (cap 100k), per-IP rate limit (5/hour), cleanup.
- `trajectory.go` — `AnalyzeTrajectory`/`AnalyzeSignals` → trust level 0–3
  (reductions [0,-5,-10,-15]).

### 3.6 Bot & Rate Limit
- **`bot/fingerprint.go`** — `GenerateFingerprint(r)` = SHA-1 of 7 key headers
  → `ctx.HTTPFingerprint`.
- **`ratelimit/`** — `flood.go` (256 lock-free shards, basic/attack/error/
  challenged), `token_bucket.go` (per-key, cap 500k), `memory.go` (sliding
  window), `key.go` (SHA-1(ip+ua)).

### 3.7 ACME / SSL — `internal/acme/`
`service.go` — TLS provisioning via acme.sh (standalone :8080). Single-worker
queue, issues/renews/installs to `certDir/<domain>/`. Out of the WAF request path.

### 3.8 Config & State — `internal/config/`, `internal/store/`, `internal/cache/`
- **`config/`** — `app_config.go` (env singleton + logging), `config.go`
  (`Manager` per-domain TTL map), `postgres.go`, `waf_config.go`,
  `settings_service.go` (SettingsReader wrapper).
- **`store/memory.go`** — Generic TTL map + background cleanup.
- **`cache/`** — `decision_cache.go` (async single-goroutine writer, SHA256
  keys, Redis-backed, hit-rate history), `redis_client.go` (graceful degrade,
  `ErrCacheDisabled`, reconnect loop).

### 3.9 Services, Repositories, Models
- **`service/`** (15 files) — Owners of in-memory state using the **atomic swap**
  pattern (`unsafe.Pointer` + background autoReload every 10–30s): `SettingsCache`,
  `AppService` (appSnapshot), `BotDetectionService`, `RateLimitService`,
  `IPReputationService`, `WAFService` (engine swap via `ReloadWAFConfig`),
  `RuleService`, `IPAccessService`, `CertificateService`, `MaxMindService`,
  `BotIPRangeFetcher`, `SpamhausFetcher`, `AuthService`, `DemoService`,
  `HealthCheckService`, `PipelineAdapter`.
- **`repository/`** — `interface.go` (RuleRepository/AppRepository interfaces +
  `Repositories` struct) + 10 concrete repos (`database/sql`). `SettingsRepository`
  uses a key/value table with `ON CONFLICT` upserts + model defaults.
- **`model/`** — Entities: `app.go`, `bot_pattern.go`, `bot_ip_range.go`,
  `certificate.go`, `ip_reputation.go`, `scoring.go`, `settings.go`, `user.go`.
- **`domain/`** — `app/AppConfig` (full upstream/advanced config — a DIFFERENT
  type from `model.AppConfig`!), `rule/` (DSL types), `ip_access/`, `waf/` (empty).

### 3.10 API & Proxy — `internal/api/`, `internal/transport/`, `internal/stream/`
- **`api/v1/router.go`** — Host-based routing: `/health`, `/__waf_verify`
  (slider verify), dashboard host → `/api/v1/*` (RateLimitMiddleware +
  AuthMiddleware) or SPA; any other host → `wafHandler.ServeHTTP`.
- **`api/v1/handler/`** — All endpoints: Auth, Apps (CRUD + under-attack + per-app
  ip-access-rules & rules), Rules, Logs, RateLimit, BotPatterns, BotIPRanges,
  IPReputation, Settings (live-reload WAF + invalidate cache), Analytics (11
  ClickHouse aggregations), Certificates, performance, cache.
  *(TODO: `test_handler.go` is orphaned, not wired into the router.)*
- **`transport/proxy_transport.go`** — Pooled `http.Transport` (MaxIdle 256,
  per-host 64, HTTP/2) + 32KB buffer pool for streaming proxy bodies.
- **`stream/`** — `proxy.go` (native Go TCP/UDP listener per stream app) +
  `nginx.go` (NginxManager generates OpenResty `stream.d/app-{id}.conf` + reload).

### 3.11 Logging, Metrics, Pages
- **`logger/`** — `clickhouse.go` (buffered chan cap 10000, non-blocking drop),
  `worker.go` (batch ≤1000 / 5s ticker, INSERT `waf_events`),
  `retention_worker.go` (ALTER TABLE DELETE), `ua_parser.go` (device/OS parsing).
- **`metrics/`** — `performance.go` (5-min window P50/P90/P95/P99), `cpu.go`
  (no-op rusage).
- **`pages/`** — Embeds `*.html` (blocked/default/challenge), minifies, serves
  with `X-Robots-Tag noindex`.

---

## 4. Frontend (React) — `frontend/src/`

### 4.1 Tech & Structure
- React 18 + TS 5.6, Vite 8 (port 3000, proxies `/api → :8080`), React Router 7.
- **State:** React Query (server cache) + 3 contexts (`Auth`, `Theme`, `Demo`).
- **Rule:** Zero business logic in the UI — it only renders and sends/receives
  data. All scoring/thresholds/decisions live in the Go backend.

### 4.2 Routing — `App.tsx`
Auth → Theme → Demo providers wrap the app. Sidebar nav:
- **Overview:** Dashboard, Applications, SSL Manager
- **Security:** WAF Settings, Rate Limiter, Bot Detector, IP Reputation,
  Anomaly Behavior, Scoring Engine, Challenge Page
- **Monitoring:** Logs, Threat Intelligence

All routes are protected (redirect to `/login`). Legacy `/rules-engine/*` →
redirect `/applications`.

### 4.3 Pages — `src/pages/`
| Folder | Contents |
|--------|----------|
| `dashboard/` | Dashboard (KPIs, traffic chart, WorldMap, device/OS doughnuts, top threats) |
| `applications/` | Applications (list + under-attack toggle), AppForm (Basic+Advanced tabs) |
| `auth/` | Login, Setup (first-run admin) |
| `monitoring/` | Logs (searchable table), ThreatIntelligence (threat IPs, WAF/custom-rule intel) |
| `security/` | WAFEngine, RateLimiter, BotDetector, IPReputation, AnomalyBehavior, ScoringEngine, Challenged, SSLManager |
| `settings/` | Settings (placeholder) |

### 4.4 Data Layer — `src/lib/` + `src/hooks/`
- **`lib/api/client.ts`** — `ApiClient` class + `wafApi` singleton (all REST
  endpoints, `ApiError`, base URL from `VITE_API_BASE_URL`).
- **`lib/api/types.ts`** — All TypeScript interfaces (single source of truth
  for API types).
- **`lib/ast-converter.ts`** — Backend AST → frontend `ConditionGroup` (ExpressionBuilder).
- **`lib/fields.ts`**, `field-metadata.ts` (fetches `/api/v1/rules/fields`),
  `countries.ts`, `utils.ts` (`cn()`).
- **`hooks/`** — Per-domain folders, all via `wafApi` + React Query:
  `apps/`, `rules/`, `logs/`, `rateLimit/`, `bot/`, `ipReputation/`,
  `settings/`, `analytics/`, `performance/`, `cache/`, `ssl/`.

### 4.5 Components — `src/components/`
`auth/` (ProtectedRoute), `dashboard/` (StatCard, LegendItem), `ip-access/`,
`rules/` (ExpressionBuilder, SortableRuleRow — @dnd-kit drag-reorder),
`shared/` (PerformanceMetrics, CacheMetrics, WorldMap, ThemeToggle), `ssl/`,
`ui/` (design primitives: button, card, dialog, table, tabs, toast, etc.).

### 4.6 Contexts — `src/contexts/`
- `AuthContext` — user/loading/needsSetup, login/logout/checkAuth/checkSetup.
- `ThemeContext` — light/dark, persisted to localStorage.
- `DemoContext` — `wafApi.health.check()` → isDemoMode, demoUser, demoPass, serverIP.

---

## 5. Data Flow (Config → Runtime)

```
PostgreSQL ──(SettingsRepository)──▶ Service atomic pointer
        │                                    │
        └──(preload at boot + autoReload)──▶ runtime memory (zero DB query)
                                                 │
                              ScoringConfig / BotConfig / WAFConfig / RateLimitConfig
                                                 │
                                      Pipeline handlers read via getter()
```

- **SettingsCache** → `ScoringConfig` (caps/multipliers/thresholds/trust).
- **WAFService.ReloadWAFConfig** → swaps the Coraza engine without restart.
- **AppService** → appSnapshot byDomain/byID (upstream routing).
- **Demo mode** (`DEMO=true`) → global config locked, per-app editable only.

---

## 6. Notes for Future Development

**Known gaps / TODOs:**
1. `rules/fields.go` — `client.os`/`client.browser` extractors stubbed to `""`,
   `req.rate` returns 0.
2. `api/v1/handler/test_handler.go` — orphaned, not wired into the router.
3. `internal/domain/waf/` — empty (domain type unused).
4. `model.AppConfig` vs `domain/app.AppConfig` — same name but different types,
   easy to confuse.
5. `internal/ui/dist` is empty — build source is at root `frontend/dist`
   (ui.go embeds `frontend/dist`).

**Conventions (follow for consistency):**
- 1 file = 1 responsibility.
- No hardcoded variables — everything dynamic from the dashboard/DB.
- Validation & messages come from the backend, not the frontend.
- Update `CHANGELOG.md` under the current version header after any change.
- Logs are an async side-effect, not a decision.
- Target <3ms per decision in Phase 1.

**How to extend:**
- **New scoring module** → add a handler in `pipeline/handlers/` + register it in
  `pipeline.New()` (main.go), add a category in `risk_score.go`, add a weight in
  `ScoringConfig`.
- **New API endpoint** → add a handler + route in `api/v1/router.go`.
- **New config** → add to the model + SettingsRepository + SettingsCache getter.
- **New frontend page** → create in `src/pages/`, register in `App.tsx`, add a
  hook + types in `lib/api/`.
