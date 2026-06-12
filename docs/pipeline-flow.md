# Pipeline Flow

Request processing flow for the Wafer WAF engine.

---

## Diagram

```
                          ┌─────────────────────────┐
   HTTP Request  ───────► │   WAFHandler.ServeHTTP   │
                          └────────────┬────────────┘
                                       │
              resolve app (cache) ─────┤  HTTPS redirect / body limit / CORS preflight
              geo lookup (MaxMind) ────┤  static asset bypass → proxy
              fingerprint ─────────────┤  under-attack mode → force challenge
                                       │
                                       ▼
                          ┌─────────────────────────┐
                          │   pipeline.Execute       │
                          └────────────┬────────────┘
                                       │ Normalize + RiskScore + Trace init
                                       ▼
        ┌──────────────────────── PHASE 1: HARD RULES ────────────────────────┐
        │ (deterministic, early-exit)                                          │
        │                                                                      │
        │  ChallengeValidator → IPAccess → Flood → RateLimit → Cache → Rules    │
        │                                                                      │
        │  Any hard decision (allow/block/challenge) → HardDecision = true     │
        │  → skip remaining Phase 1 + skip Phase 2 entirely                    │
        └──────────────────────────────────┬───────────────────────────────────┘
                                            │ NO hard decision
                                            ▼
        ┌──────────────────────── PHASE 2: SCORING ───────────────────────────┐
        │ (cumulative, no per-stage decision)                                  │
        │                                                                      │
        │  IPReputation → BotDetection → WAFEngine → ProtocolAnomaly → Trust   │
        │                                                                      │
        │  each handler: ctx.AddScore(category, rule, points)                  │
        │  handlers respect ShouldSkipModule for granular bypass               │
        └──────────────────────────────────┬───────────────────────────────────┘
                                            │ apply weights (cap + multiplier) → ClampTotal
                                            ▼
        ┌──────────────────────── PHASE 3: DECISION ──────────────────────────┐
        │  total ≥ Block(80)      → block                                      │
        │  total ≥ Challenge(50)  → challenge                                  │
        │  else                   → allow                                      │
        └──────────────────────────────────┬───────────────────────────────────┘
                                            ▼
        ┌──────────────────────── PHASE 4: RESPONSE ──────────────────────────┐
        │  BlockHandler (403 page)  /  ChallengeHandler (slider page)          │
        └──────────────────────────────────┬───────────────────────────────────┘
                                            │
                ┌───────────────────────────┴───────────────────────────┐
                ▼                                                       ▼
         block / challenge                                   allow → proxyToUpstream
         (response written)                                  (pooled transport + buffer pool)
                │                                                       │
                └────────────────────────┬──────────────────────────────┘
                                          ▼
                               Log (async, non-blocking)
                               → ClickHouse batch worker
```

---

## Rule Actions

### IP Access Rules (Phase 1, position 2)

IP access rules are **coarse, absolute, and terminal**. All actions set
`HardDecision = true` — the pipeline short-circuits immediately.

| Action | Behavior |
|--------|----------|
| **Allow** | Full bypass. No remaining Phase 1, no Phase 2 scoring, no Phase 3 decision. Straight to proxy. |
| **Block** | 403 immediately. No further processing. |
| **Challenge** | Challenge page immediately. No further processing. |

No granular skip is available — for per-module control, use custom rules.

### Custom Rules (Phase 1, position 6)

Custom rules support expression-based matching with fine-grained actions.

| Action | Behavior |
|--------|----------|
| **Allow** | `HardDecision = true`. Full bypass — same as IP access allow. |
| **Block** | `HardDecision = true`. 403 immediately. |
| **Challenge** | `HardDecision = true`. Challenge page immediately. |
| **Log** | Record the match, continue processing. No decision change. |
| **Skip** | Mark specific modules to bypass. Remaining pipeline runs; only skipped modules are exempted. |

### Skip Modules

When a custom rule has action `skip`, it specifies which modules to bypass:

| Module name | Handler bypassed |
|-------------|-----------------|
| `waf` | WAF Managed Rules (Coraza/CRS) |
| `bot` | Bot Detection |
| `rate_limit` | Rate Limiting |
| `ip_reputation` | IP Reputation Scoring |
| `protocol_anomaly` | Protocol Anomaly Detection |
| `flood` | Flood Protection |

Skip does NOT set `HardDecision` — other modules and the scoring engine still run.
The final decision is still made by Phase 3 based on the total score from non-skipped modules.

---

## Phase Details

### Phase 1 — Hard Rules (deterministic, early-exit)

Order: `ChallengeValidator → IPAccess → Flood → RateLimit → Cache → Rules`

- Target: < 3ms, no blocking IO (all config from memory).
- Any handler that makes a terminal decision sets `HardDecision = true`.
- Once set, remaining Phase 1 handlers and Phase 2 scoring are skipped entirely.
- ChallengeValidator with valid cookie → `ChallengePassed = true`, downstream handlers skip.
- Handlers respect `IPRuleTerminal` and `ChallengePassed` flags to skip gracefully.
- **Full reference:** [phase1-hard-rules.md](phase1-hard-rules.md)

### Phase 2 — Scoring (cumulative)

Order: `IPReputation → BotDetection → WAFEngine → ProtocolAnomaly → TrustedHistory → Trust`

- Each handler only **contributes score** via `ctx.AddScore(category, rule, points)`.
- No handler makes a block/challenge decision (AGENTS.md: no per-stage action).
- Trust = negative score (reduction for verified users).
- TrustedHistory = negative score for IPs with N consecutive clean requests (configurable threshold).
- Handlers check `ShouldSkipModule` for granular bypass from skip rules.
- After all handlers: multiplier → cap per category applied, then `ClampTotal` (0–100).
- **Full reference:** [phase2-scoring.md](phase2-scoring.md)

### Phase 3 — Decision + Phase 4 — Response

Single decision point based on total score vs thresholds (from dashboard config):
- `score ≥ block_threshold` → block → 403 page
- `score ≥ challenge_threshold` → challenge → slider page
- otherwise → allow → proxy to upstream
- **Full reference:** [phase3-decision.md](phase3-decision.md)

### Logging (side effect)

All requests are logged regardless of decision (action is a side effect, not a decision).
Logging is async via buffered channel + ClickHouse batch worker — non-blocking on request path.

---

## Performance Architecture

- **Zero DB queries on request path.** All config (scoring, app, rate limit, IP reputation)
  served from memory via atomic-swap preloaded caches with background reload.
- **Sharded flood protector.** 256 independently-locked partitions — requests for different
  IPs don't serialize.
- **Typed context fields.** No per-request map allocation or boxing. Dynamic extras via
  lazy-allocated `Extra` map only when needed (rule matches, JA4).
- **Buffer pool proxy.** Reusable 32KB buffers for upstream body copy.
- **Lock-free debug guard.** `IsDebug()` via atomic, no mutex on the hot path.
- **Transport pooling.** HTTP keep-alive + connection reuse per upstream.
- **OpenResty.** Dynamic SSL via `ssl_certificate_by_lua` with shared dict cache (no reload needed for new certs).
