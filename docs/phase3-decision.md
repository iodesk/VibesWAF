# Phase 3 — Decision Engine

Single decision point. Evaluates total score from Phase 2 against configurable thresholds. Then Phase 4 renders the response.

---

## Decision Logic

```go
switch {
case score >= thresholds.Block:     → "block"
case score >= thresholds.Challenge: → "challenge"
default:                            → allow (no action)
}
```

---

## Thresholds (dashboard: Scoring Engine)

| Threshold | Default | Result |
|-----------|---------|--------|
| Block | 80 | 403 Forbidden |
| Challenge | 50 | Slider challenge page |
| (below challenge) | — | Proxy to upstream |

---

## Preconditions

Decision engine is **skipped** when:
- `HardDecision = true` (Phase 1 already decided)
- `ctx.Action` already set to "block" or "challenge" (Phase 1 terminal action)

---

## Reason Format

Decision engine builds a reason string for logging:

```
total:<score>|<category>:<category_score>|<category>:<category_score>|...
```

Example:
```
total:62|ip_reputation:20|bot_detection:35|waf_anomaly:7
```

Only non-zero categories are included.

---

## Phase 4 — Response

After Phase 3 (or directly after Phase 1 if hard decision), Phase 4 handlers render the response.

### Handlers

| Handler | Trigger | Response |
|---------|---------|----------|
| BlockHandler | `ctx.Action == "block"` | 403 + block page HTML |
| ChallengeHandler | `ctx.Action == "challenge"` | Challenge page HTML |
| (none) | `ctx.Action == "" or "allow"` | Proxy to upstream |

### Block Page

- Custom HTML template with:
  - Client IP
  - Host
  - Reason (human-readable from `pages.go` mapping)
  - Ray ID (request trace ID)

### Challenge Page

- Slider challenge with obfuscated target
- Contains: challenge ID, type, max attempts, timeout
- Target position XOR'd with random key (not plaintext in DOM)
- After solve → POST `/__waf_verify` → cookie set → redirect

### Proxy

- If no block/challenge action → request proxied to upstream
- Pooled HTTP transport with keep-alive
- 32KB buffer pool for body copy

---

## Score → Decision Examples

| IP Rep | Bot | WAF | Protocol | Trust | Total | Decision |
|--------|-----|-----|----------|-------|-------|----------|
| 20 | 35 | 7 | 0 | 0 | 62 | CHALLENGE |
| 25 | 30 | 40 | 0 | 0 | 95 | BLOCK |
| 20 | 30 | 0 | 0 | -15 | 35 | ALLOW |
| 0 | 45→35 | 20 | 10 | 0 | 65 | CHALLENGE |
| 0 | 0 | 5 | 0 | 0 | 5 | ALLOW |
| 25 | 30 | 40 | 25 | -15 | 100→100 | BLOCK |

---

## Adjusting Thresholds

### More aggressive (catch more threats)
```json
{ "block": 70, "challenge": 40 }
```

### More permissive (reduce false positives)
```json
{ "block": 90, "challenge": 60 }
```

### Challenge-first posture (rarely block, mostly challenge)
```json
{ "block": 95, "challenge": 40 }
```

---

## Logging

All requests are logged regardless of decision. Log entry includes:
- Action (allow/block/challenge)
- Reason string (full category breakdown)
- Pipeline trace (per-stage scores and reasons)
- Pipeline duration (microseconds)

Logging is async via buffered channel → ClickHouse batch worker. Non-blocking on request path.

---

## Full Flow Summary

```
Request
  │
  ├─ Phase 1 HardDecision? ──YES──→ Phase 4 (render) → done
  │
  NO
  │
  ├─ Phase 2 (all handlers score)
  │
  ├─ Apply weights (multiplier → cap per category)
  │
  ├─ ClampTotal(0–100)
  │
  ├─ Phase 3: score vs thresholds → action
  │
  ├─ Phase 4: render response (block/challenge/proxy)
  │
  └─ Log (async)
```
