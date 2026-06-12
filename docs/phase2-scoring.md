# Phase 2 — Adaptive Scoring

Cumulative scoring. No handler makes a decision. All contribute points to the total score which Phase 3 evaluates.

Only runs when Phase 1 did NOT set `HardDecision = true`.

---

## Handler Order

```
IPReputation → BotDetection → WAFEngine → ProtocolAnomaly → Trust
```

Each handler: `ctx.AddScore(category, rule, points)`

---

## Score Categories

| Category | Handler | Direction | Notes |
|----------|---------|-----------|-------|
| `ip_reputation` | IPReputationScorer | Positive | Manual IP/ASN or MaxMind |
| `bot_detection` | BotDetectionHandler | Positive | Header + behavioral analysis |
| `waf_anomaly` | WAFEngineHandler | Positive | OWASP CRS anomaly score |
| `protocol_anomaly` | ProtocolAnomalyHandler | Positive | HTTP/cookie/JA4 inconsistencies |
| `trust` | TrustScorer | **Negative** | Reduction for verified challenge solvers |

---

## Category Weights

Applied **after** all handlers run, **before** Phase 3.

Each category has 3 controls (dashboard: Scoring Engine):

| Control | Effect | Range |
|---------|--------|-------|
| Enabled | Off → score zeroed | bool |
| Multiplier | Scales raw score | 0.1–3.0 |
| MaxScore (Cap) | Hard ceiling after multiplier | 0–100 |

### Application Order

```
raw_score → × multiplier → cap(max_score) → contribute to total
```

### Defaults

| Category | Enabled | MaxScore | Multiplier |
|----------|---------|----------|------------|
| ip_reputation | ✓ | 25 | 1.0 |
| bot_detection | ✓ | 30 | 1.0 |
| waf_anomaly | ✓ | 40 | 1.0 |
| protocol_anomaly | ✓ | 25 | 1.0 |

### Display Format in Logs

```
Bot Detection     +45 = 35
                  ↑raw  ↑after cap
```

- `+45` = raw score from rules
- `= 35` = final after multiplier × cap

---

## 1. IP Reputation

**Source priority:** Manual entry > MaxMind auto-detect

### Manual entries (dashboard: IP Reputation)
- Per-IP: direct score value
- Per-ASN: score applied to all IPs in that ASN
- Score capped at category MaxScore

### MaxMind auto-detect (fallback if no manual entry)
- Datacenter IP → `maxmind_dc_score` (configurable)
- Cloud provider ASN → `maxmind_asn_score` (configurable)
- Detected: AWS, Google Cloud, Azure, DigitalOcean, Linode, Vultr, OVH, Hetzner

---

## 2. Bot Detection

Single composite score from header analysis + behavioral signals + UA patterns.

### Header Rules (dashboard: Bot Detector → Rules)

| Rule | Default | Trigger |
|------|---------|---------|
| missing_user_agent | 10 | No UA |
| short_user_agent | 6 | UA < 20 chars |
| missing_accept | 4 | No Accept header |
| wildcard_accept_browser_ua | 5 | `*/*` Accept with browser UA |
| missing_accept_language | 8 | No Accept-Language |
| missing_accept_encoding | 6 | No Accept-Encoding |
| missing_sec_fetch | 8 | No Sec-Fetch-* with browser UA |
| incomplete_sec_fetch | 6 | Partial Sec-Fetch set |
| no_browser_indicators | 5 | No referer + no XHR + wildcard accept |
| chromium_missing_sec_ch_ua | 8 | Chrome UA without Sec-CH-UA |
| chromium_missing_sec_fetch | 8 | Chrome UA without Sec-Fetch |
| firefox_has_sec_ch_ua | 8 | Firefox with Sec-CH-UA (impossible) |
| no_gzip_or_br | 6 | Accept-Encoding without gzip/br |
| geo_lang_mismatch | 6 | Geo vs Accept-Language mismatch |
| repeat_no_cookie | 10 | Repeat visitor without cookies |
| burst_rate | 8 | Burst request pattern |
| regular_interval | 6 | Machine-like intervals |
| unknown_browser_bot | 20 | Unknown browser-like bot |
| headless_browser | 20 | PhantomJS/Puppeteer/Selenium/Playwright |

### UA Pattern Rules (dashboard: Bot Detector → Patterns)

| Type | Score cap | Notes |
|------|-----------|-------|
| good_bot | 0 | Optional IP verification |
| bad_bot | 10 | Known malicious bots |
| suspicious_ua | 5 | Suspicious but not confirmed |
| bad_referer | 10 | Spam/malicious referers |

---

## 3. WAF / OWASP CRS

Coraza engine scans request against OWASP Core Rule Set. Returns `anomaly_score` = sum of matched rule severities.

### Configuration (dashboard: WAF Settings)

| Setting | Default | Notes |
|---------|---------|-------|
| paranoia_level | 1 | Higher = more rules, more FP |
| anomaly_threshold | 5 | CRS internal threshold |
| allowed_methods | GET, HEAD, POST, OPTIONS | Others flagged |
| disabled_rules | 920274, 942421 | Suppress specific rules |
| custom_rules | (empty) | Additional SecRules |

### Rule categories
- REQUEST-911: Method enforcement
- REQUEST-913: Scanner detection
- REQUEST-920: Protocol enforcement
- REQUEST-921: Protocol attack
- REQUEST-930: LFI
- REQUEST-931: RFI
- REQUEST-932: RCE
- REQUEST-933: PHP injection
- REQUEST-941: XSS
- REQUEST-942: SQLi
- REQUEST-943: Session fixation
- REQUEST-944: Java attack

---

## 4. Protocol Anomaly

Detects HTTP protocol inconsistencies, cookie manipulation, and TLS fingerprint mismatches.

### Rules (dashboard: Scoring Engine → Protocol Anomaly)

| Rule | Default | Trigger |
|------|---------|---------|
| http2_connection_header | 8 | Connection header on HTTP/2 |
| content_type_no_body | 5 | Content-Type on GET/HEAD |
| accept_path_mismatch | 5 | text/html on API path |
| sec_fetch_dest_mismatch | 6 | document dest on asset/API |
| upgrade_non_navigate | 4 | Upgrade-Insecure-Requests on non-navigate |
| te_cl_conflict | 10 | TE + CL (request smuggling) |
| multiple_host_headers | 10 | Multiple Host headers (smuggling) |
| malformed_challenge_cookie | 8 | Invalid HMAC format in `ok` cookie |
| future_cookie_timestamp | 8 | Cookie timestamp in future |
| excessive_cookies_no_referer | 5 | >10 cookies on root without referer |
| ja4_old_tls_browser_ua | 15 | TLS 1.0/1.1 with browser UA |
| browser_ua_http10 | 10 | Browser UA with HTTP/1.0 |
| browser_ua_ja4_empty | 3 | TLS + browser UA + no JA4 |
| bot_ua_browser_ja4 | 10 | Bot UA with browser JA4 |
| browser_ua_simple_ja4 | 10 | Browser UA with simple JA4 |

### JA4 fingerprinting
- JA4 passed via `X-JA4` header (from OpenResty)
- Format encodes TLS version, cipher count, extensions
- Cross-referenced with UA to detect spoofing

---

## 5. Trust (Negative Score)

Applied **only** when `ChallengePassed = true`.

Uses trust level from challenge trajectory analysis (level 0–3):

| Level | Confidence | Reduction | Meaning |
|-------|-----------|-----------|---------|
| 0 | 0.00–0.39 | 0 | Solved but suspicious |
| 1 | 0.40–0.59 | -5 | Basic verification |
| 2 | 0.60–0.79 | -10 | Natural interaction |
| 3 | 0.80–1.00 | -15 | High confidence human |

Configurable from dashboard (Bot Detector → Trust Levels).

Trust reduction can bring total below challenge threshold → effectively "passing" a suspicious request.

---

## After All Handlers

```
Apply weights per category:
  for each category:
    if !enabled → zero out
    else → multiply → cap

ClampTotal(0–100)

→ Pass to Phase 3
```

---

## Calculation Example

Request from datacenter IP, Chrome UA without Sec-Fetch, CRS rule hit:

```
IP Reputation:      +20 (Manual ASN: 9009)
                    × 1.0 → cap 25 → final: 20

Bot Detection:      +45 (missing_sec_fetch:15 + chromium_missing_sec_ch_ua:15 + chromium_missing_sec_fetch:15)
                    × 1.0 → cap 35 → final: 35

WAF Anomaly:        +5 (Rule #920280)
                    × 1.5 → 7 → cap 40 → final: 7

Protocol Anomaly:   +0

Trust:              +0 (no challenge cookie)

─────────────────────────────
Total:              20 + 35 + 7 = 62
Clamp:              62 (0–100)
→ Phase 3
```

---

## Tuning Guide

### Reduce false positives
- Lower multiplier (e.g. bot_detection: 0.7)
- Lower cap (e.g. bot_detection max_score: 20)
- Raise Phase 3 thresholds (challenge: 60, block: 90)
- Set noisy rules to score 0

### Increase protection
- Raise multiplier (e.g. waf_anomaly: 2.0)
- Lower thresholds (challenge: 40, block: 70)
- Higher paranoia level in WAF

### Per-rule tuning
- Bot rules: dashboard → Bot Detector → per-rule score
- Protocol rules: dashboard → Scoring Engine → Protocol Anomaly
- WAF: `disabled_rules` in WAF Settings (disable false-positive rules)
- Trust: adjust reductions or confidence thresholds
