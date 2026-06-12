# Phase 1 — Hard Rules

Deterministic, early-exit handlers. Any handler that makes a terminal decision sets `HardDecision = true` — remaining Phase 1, Phase 2, and Phase 3 are skipped. Response goes directly to Phase 4.

Target: **< 3ms**, zero blocking IO (all config from memory).

---

## Handler Order

```
ChallengeValidator → IPAccess → Flood → RateLimit → Cache → Rules
```

Each handler checks `ctx.HardDecision` at entry — if already set by a previous handler, it skips.

---

## 1. ChallengeValidator

**Purpose:** Validate the `ok` cookie from a previously solved challenge.

**Flow:**
1. Read `ok` cookie from request
2. Parse format: `<signature>.<timestamp>.<trust_level>`
3. Verify HMAC-SHA256(IP + UA + timestamp + level) against signature
4. Check expiry: `now - timestamp > ChallengeDuration` → expired
5. If valid: set `ctx.ChallengePassed = true`, `ctx.TrustLevel = 0-3`

**Outcomes:**
- Valid cookie → downstream handlers skip via `ChallengePassed` flag. Phase 2 still runs (trust reduction applied).
- No cookie / invalid → continues to next handler.

**Does NOT set HardDecision.** Just flags `ChallengePassed`.

**Cookie format:**
```
<hex_signature_32chars>.<unix_timestamp>.<trust_level>
```

**Config (dashboard: Bot Detector):**
- `challenge_duration`: cookie TTL in seconds (default: 36000 = 10h)
- Backward compatible: old cookies without trust_level treated as level 0

---

## 2. IPAccess

**Purpose:** Check IP against access rules (whitelist/blacklist per app).

**Flow:**
1. Resolve `appID` (per-app or default)
2. Call `ipAccessService.CheckIP(appID, clientIP)`
3. Match against CIDR ranges / single IPs

**Outcomes:**

| Action | Behavior |
|--------|----------|
| allow | `HardDecision = true`, `IPRuleTerminal = true`. Full bypass → proxy. |
| block | `HardDecision = true`, `IPRuleTerminal = true`. 403 immediately. |
| challenge | `HardDecision = true`, `IPRuleTerminal = true`. Challenge page. |

**All actions are terminal.** No further processing.

**Config (dashboard: IP Access Rules):**
- Per-app or global rules
- CIDR ranges (e.g. `192.168.0.0/16`) or single IPs
- Priority ordering
- Enable/disable per rule

---

## 3. Flood

**Purpose:** Sharded in-memory flood detection. Prevents sustained abuse with penalty period.

**Checks (in order):**
1. `IsChallenged(ip)` — is IP currently in penalty?
2. `CheckAttackLimit(ip)` — WAF violation repeat offender
3. `CheckErrorLimit(ip)` — upstream error repeat
4. `CheckBasicAccess(ip)` — raw request count per window

**Penalty mechanism:**
- When any limit exceeded → `SetChallenge(ip, penalty_duration)`
- During penalty: every request from that IP → immediate CHALLENGE/BLOCK
- After penalty expires: all counters for that IP are **cleared** → fresh start

**Config (dashboard: Rate Limiter):**

| Profile | What it counts | Defaults |
|---------|---------------|----------|
| basic | All requests per IP | 10 req / 60s window / 300s penalty |
| attack | WAF violations per IP | 5 / 300s / 300s |
| error | 4xx/5xx from upstream | 10 / 60s / 300s |

Each profile has:
- `count` — threshold
- `duration` — sliding window (seconds)
- `challenge_sec` — penalty duration after exceeded
- `action` — block or challenge
- `enabled` — on/off

**Architecture:**
- 256 independently-locked shards (FNV hash of IP)
- Zero contention between different IPs
- Cleanup goroutine every 2 minutes evicts expired entries
- No DB/Redis on hot path — pure in-memory

**Sets `HardDecision = true` when limit exceeded or penalty active.**

---

## 4. RateLimit

**Purpose:** Token bucket rate limiter per IP+UA (smoothing, not flood).

**Flow:**
1. Resolve rate limit profile: per-app config or global
2. Generate key: `appID:SHA256(IP:UA)`
3. Check token bucket: capacity = count, refill = count/duration per second
4. If tokens available → consume 1, allow
5. If empty → block/challenge

**Token bucket behavior:**
- First request creates bucket with full capacity
- Each request consumes 1 token
- Tokens refill continuously at `count/duration` per second
- After denial, tokens still refill — access resumes naturally when tokens available

**Config (dashboard: Rate Limiter or per-app):**
- Global: from `rate_limit` settings
- Per-app: `UseGlobalRateLimit = false` → app-specific limits
- `count`: max requests in window
- `duration`: window in seconds
- `action`: block/challenge

**Sets `HardDecision = true` when token bucket empty.**

---

## 5. Cache (Decision Cache)

**Purpose:** Replay cached decisions for recently-seen request fingerprints.

**Flow:**
1. Generate fingerprint from request (IP + path + method + host)
2. Look up in in-memory cache
3. If HIT → replay stored decision (action + source + reason)

**Skips if:** `IPRuleTerminal` or `ChallengePassed`

**Cache population:** Custom Rules handler sets cache on match (allow/block/challenge).

**Does NOT always set HardDecision** — depends on cached action.

---

## 6. Custom Rules

**Purpose:** Expression-based matching with fine-grained actions.

**Flow:**
1. Load merged rules (global + app-specific), ordered by priority
2. Evaluate each enabled rule's expression against request context
3. First match with terminal action wins

**Actions:**

| Action | Behavior | Sets HardDecision |
|--------|----------|-------------------|
| allow | Full bypass → proxy | ✓ |
| block | 403 immediately | ✓ |
| challenge | Challenge page | ✓ |
| log | Record match, continue | ✗ |
| skip | Mark modules to bypass | ✗ |

**Skip modules:**

| Module | Handler bypassed |
|--------|-----------------|
| `waf` | WAF Engine (Phase 2) |
| `bot` | Bot Detection (Phase 2) |
| `rate_limit` | Rate Limit (Phase 1) |
| `ip_reputation` | IP Reputation (Phase 2) |
| `protocol_anomaly` | Protocol Anomaly (Phase 2) |
| `flood` | Flood Protection (Phase 1) |

Skip does NOT stop pipeline. Other handlers still run; only skipped modules are exempted.

**Config (dashboard: Security Rules):**
- Expression fields: IP, path, method, host, UA, headers, country, ASN
- Operators: equals, contains, starts_with, regex, in_list, not_*
- Scope: global or per-app
- Priority: lower number = evaluated first

---

## Context Flags Set by Phase 1

| Flag | Set by | Effect on downstream |
|------|--------|---------------------|
| `HardDecision` | Any terminal action | Phase 2 + Phase 3 skipped |
| `IPRuleTerminal` | IPAccess (any action) | Rate/Flood/Cache/Rules skip |
| `ChallengePassed` | ChallengeValidator | Rate/Flood/Rules skip; Phase 2 trust applies |
| `SkipModules` | Custom Rules (skip) | Specific Phase 2 handlers skip |

---

## Pipeline Short-Circuit

```
Handler makes decision
    │
    ├─ HardDecision = true
    │     │
    │     └─ Skip remaining Phase 1
    │        Skip Phase 2 (scoring)
    │        Skip Phase 3 (decision engine)
    │        Go directly to Phase 4 (response)
    │
    └─ HardDecision = false
          │
          └─ Continue to next handler
```
