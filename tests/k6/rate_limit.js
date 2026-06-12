import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Counter, Trend } from "k6/metrics";

// Custom metrics
const blockedRate = new Rate("blocked_requests");
const blockedCount = new Counter("blocked_total");
const allowedCount = new Counter("allowed_total");

// Status code counters
const status2xx = new Counter("status_2xx");
const status3xx = new Counter("status_3xx");
const status4xx = new Counter("status_4xx");
const status5xx = new Counter("status_5xx");

// Configuration
const TARGET_URL = __ENV.TARGET_URL || "https://k6-test.fio.link/";
const MAX_RPS = parseInt(__ENV.MAX_RPS || "200");
const VUS = parseInt(__ENV.VUS || "500");

export const options = {
  scenarios: {
    ramping_load: {
      executor: "ramping-arrival-rate",
      startRate: Math.max(1, Math.floor(MAX_RPS * 0.1)),
      timeUnit: "1s",
      preAllocatedVUs: VUS,
      maxVUs: VUS * 2,
      stages: [
        { duration: "10s", target: Math.floor(MAX_RPS * 0.3) },
        { duration: "10s", target: Math.floor(MAX_RPS * 0.6) },
        { duration: "10s", target: MAX_RPS },
        { duration: "15s", target: MAX_RPS },
        { duration: "10s", target: Math.floor(MAX_RPS * 1.5) },
        { duration: "10s", target: Math.floor(MAX_RPS * 0.5) },
        { duration: "5s", target: 0 },
      ],
    },
  },
  thresholds: {
    blocked_requests: ["rate>0.3"],
  },
};

export default function () {
  const res = http.get(TARGET_URL, {
    headers: {
      "User-Agent": "k6-rate-limit-test/1.0",
    },
    timeout: "5s",
  });

  // Status code tracking
  if (res.status >= 200 && res.status < 300) {
    status2xx.add(1);
  } else if (res.status >= 300 && res.status < 400) {
    status3xx.add(1);
  } else if (res.status >= 400 && res.status < 500) {
    status4xx.add(1);
  } else if (res.status >= 500) {
    status5xx.add(1);
  }

  const isBlocked = res.status === 403 || res.status === 429;
  const isChallenged = res.status === 503;

  blockedRate.add(isBlocked || isChallenged);

  if (isBlocked || isChallenged) {
    blockedCount.add(1);
  } else {
    allowedCount.add(1);
  }

  check(res, {
    "status is expected": (r) =>
      r.status === 200 || r.status === 403 || r.status === 429 || r.status === 503,
  });
}

export function handleSummary(data) {
  const total =
    (data.metrics.blocked_total ? data.metrics.blocked_total.values.count : 0) +
    (data.metrics.allowed_total ? data.metrics.allowed_total.values.count : 0);
  const blocked = data.metrics.blocked_total
    ? data.metrics.blocked_total.values.count
    : 0;
  const allowed = data.metrics.allowed_total
    ? data.metrics.allowed_total.values.count
    : 0;

  const s2xx = data.metrics.status_2xx ? data.metrics.status_2xx.values.count : 0;
  const s3xx = data.metrics.status_3xx ? data.metrics.status_3xx.values.count : 0;
  const s4xx = data.metrics.status_4xx ? data.metrics.status_4xx.values.count : 0;
  const s5xx = data.metrics.status_5xx ? data.metrics.status_5xx.values.count : 0;

  const pct = (n) => (total > 0 ? ((n / total) * 100).toFixed(2) + "%" : "0%");

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║       Rate Limit Test Summary            ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(`║  Total Requests : ${String(total).padStart(8)}              ║`);
  console.log(`║  Allowed        : ${String(allowed).padStart(8)}              ║`);
  console.log(`║  Blocked        : ${String(blocked).padStart(8)}              ║`);
  console.log(`║  Block Rate     : ${pct(blocked).padStart(8)}              ║`);
  console.log("╠══════════════════════════════════════════╣");
  console.log("║  Status Code Breakdown                   ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(`║  2xx (Success)  : ${String(s2xx).padStart(8)} (${pct(s2xx).padStart(7)})  ║`);
  console.log(`║  3xx (Redirect) : ${String(s3xx).padStart(8)} (${pct(s3xx).padStart(7)})  ║`);
  console.log(`║  4xx (Client)   : ${String(s4xx).padStart(8)} (${pct(s4xx).padStart(7)})  ║`);
  console.log(`║  5xx (Server)   : ${String(s5xx).padStart(8)} (${pct(s5xx).padStart(7)})  ║`);
  console.log("╚══════════════════════════════════════════╝\n");

  const summary = {
    total_requests: total,
    blocked: blocked,
    allowed: allowed,
    block_rate: pct(blocked),
    status_codes: {
      "2xx": s2xx,
      "3xx": s3xx,
      "4xx": s4xx,
      "5xx": s5xx,
    },
  };

  return {
    stdout: JSON.stringify(summary, null, 2),
  };
}
