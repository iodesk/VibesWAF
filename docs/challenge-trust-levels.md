# Challenge Trust Levels

## Overview

After a user solves the slider challenge, the system analyzes their behavior (mouse trajectory, timing, interaction signals) to assign a **trust level** (0-3). This trust level determines how much score reduction they receive in the scoring engine.

## Trust Levels

| Level | Confidence Range | Reduction | Description |
|-------|-----------------|-----------|-------------|
| 0     | 0.00 - 0.39     | 0         | Solved but suspicious |
| 1     | 0.40 - 0.59     | -5        | Basic verification |
| 2     | 0.60 - 0.79     | -10       | Natural interaction |
| 3     | 0.80 - 1.00     | -15       | High confidence human |

All thresholds and reductions are configurable from the dashboard (Challenge Page → Trust Levels).

## How It Works

### Frontend (challenge.html)
- Collects raw data only, no logic:
  - `trajectory[]` — array of `{x, y, t}` points during slider drag
  - `signals` — focus/blur/scroll counts, mousemove before drag, first interaction time

### Backend (POST /__waf_verify)
1. Validates answer (position ±tolerance) and timing (min duration)
2. Analyzes trajectory: speed variance, straightness, Y-jitter, direction changes, timing regularity
3. Analyzes signals: first interaction time, mouse activity before drag
4. Computes confidence: `(trajectory_score × 0.7) + (signals_score × 0.3)`
5. Maps confidence to trust level (0-3)
6. Encodes trust level in HMAC cookie: `HMAC(IP:UA:timestamp:level).timestamp.level`

### Pipeline (per request)
1. **ChallengeValidator** (Phase 1): extracts trust_level from cookie, sets `ctx.Metadata["trust_level"]`
2. **TrustScorer** (Phase 2): looks up reduction for trust_level, adds to `ScoreCategoryTrust`
3. **DecisionEngine** (Phase 3): evaluates total score including trust reduction

## Cookie Format

```
<signature>.<timestamp>.<trust_level>
```

- Signature: HMAC-SHA256(IP + UA + timestamp + trust_level)[:32]
- Backward compatible: old cookies without trust_level are treated as level 0

## Trajectory Metrics

| Metric | Human Behavior | Bot Behavior |
|--------|---------------|--------------|
| Point count | 30-200+ | Exact step count (e.g. 20) |
| Speed variance | High (accelerate/decelerate) | Low (constant interpolation) |
| Straightness | 0.85-0.98 | ~1.0 (perfect line) |
| Y-axis jitter | 1-5px | 0 (no vertical deviation) |
| Direction changes | Multiple (overshoot/correct) | 0-1 |
| Timing regularity | Irregular intervals | Fixed intervals (16ms, 16ms...) |

## Configuration

Trust level settings are part of `BotConfig.TrustLevels`:

```json
{
  "trust_levels": {
    "level0_max": 0.40,
    "level1_max": 0.60,
    "level2_max": 0.80,
    "reductions": [0, -5, -10, -15]
  }
}
```

## Design Principles

- Challenge is a **sensor**, not a decision maker
- Output is a score that feeds into the existing scoring engine
- Level 0 = solved (no false positive), but no trust bonus
- Zero IO in request path — all computation in memory
- All thresholds configurable from dashboard
