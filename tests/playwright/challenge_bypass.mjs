/**
 * Playwright challenge bypass test
 * 
 * Tests whether the WAF challenge slider can be bypassed.
 * If #handle is NOT found → challenge not triggered (request allowed).
 * If #handle IS found → attempts to solve the slider challenge.
 *
 * Usage: node challenge_bypass.mjs [url] [mode]
 * 
 * Modes:
 *   normal   - Standard browser request (may not trigger challenge)
 *   trigger  - Suspicious request to force challenge trigger
 *   bot      - Obvious bot-like request (empty UA, no headers)
 *
 * Default URL: https://bb.tailgo.com
 * Default mode: trigger
 *
 * Examples:
 *   node challenge_bypass.mjs https://bb.tailgo.com trigger
 *   node challenge_bypass.mjs https://bb.tailgo.com bot
 */

import { chromium } from "playwright";

// Smart arg parsing: if arg looks like a URL use it, otherwise treat as mode
const arg2 = process.argv[2] || "";
const arg3 = process.argv[3] || "";

let TARGET_URL, MODE;
if (arg2.startsWith("http")) {
  TARGET_URL = arg2;
  MODE = arg3 || "trigger";
} else if (arg2) {
  TARGET_URL = "https://ro.fio.link/";
  MODE = arg2;
} else {
  TARGET_URL = "https://ro.fio.link/.env";
  MODE = "trigger";
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Profiles to trigger different WAF scoring
const PROFILES = {
  // Normal browser - unlikely to trigger challenge from clean IP
  normal: {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    extraHeaders: {},
    locale: "en-US",
  },
  // Suspicious: mismatched geo/lang, no referer, datacenter-like behavior
  // This should score higher on bot_detection (geo_lang_mismatch, datacenter ASN)
  trigger: {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    extraHeaders: {
      "Accept-Language": "zh-CN,zh;q=0.9",  // Chinese lang from non-CN server → geo_lang_mismatch
      "Accept": "*/*",                        // Generic accept (browsers send specific)
    },
    locale: "zh-CN",
  },
  // Bot-like: stripped headers, empty/weird UA
  bot: {
    userAgent: "python-requests/2.31.0",
    extraHeaders: {
      "Accept": "*/*",
    },
    locale: "en-US",
  },
};

async function main() {
  const profile = PROFILES[MODE] || PROFILES.trigger;
  console.log(`[*] Mode: ${MODE}`);
  console.log(`[*] UA: ${profile.userAgent}`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
    ],
  });

  const context = await browser.newContext({
    userAgent: profile.userAgent,
    viewport: { width: 1920, height: 1080 },
    locale: profile.locale,
    timezoneId: "Asia/Jakarta",
    extraHTTPHeaders: profile.extraHeaders,
  });

  // Anti-detection patches (only useful for normal/trigger modes)
  if (MODE !== "bot") {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "platform", { get: () => "Win32" });
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
      Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (params) =>
        params.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(params);
    });
  }

  const page = await context.newPage();

  // Intercept response to check status
  let responseStatus = 0;
  page.on("response", (resp) => {
    if (resp.url() === TARGET_URL || resp.url() === TARGET_URL + "/") {
      responseStatus = resp.status();
    }
  });

  console.log(`[*] Navigating to ${TARGET_URL}`);

  // If trigger mode, send rapid requests first to build up rate_anomaly score
  if (MODE === "trigger") {
    console.log("[*] Sending rapid pre-requests to build rate_anomaly score...");
    for (let i = 0; i < 8; i++) {
      await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
      await sleep(rand(100, 300));
    }
    console.log("[*] Pre-requests done, sending final request...");
  }

  await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 30000 });
  console.log(`[i] Response status: ${responseStatus}`);

  // Wait a bit for page to fully render
  await sleep(rand(1500, 2500));

  // ─── CHECK: Is challenge page displayed? ───────────────────────────
  const handle = page.locator("#handle");
  const track = page.locator("#track");
  const targetZone = page.locator("#target-zone");

  const handleVisible = await handle.isVisible().catch(() => false);
  const title = await page.title();
  const currentUrl = page.url();

  console.log(`[i] Page title: "${title}"`);
  console.log(`[i] Current URL: ${currentUrl}`);

  if (!handleVisible) {
    console.log("[✓] Challenge NOT triggered — request went through without challenge.");
    console.log("");
    console.log("[TIP] Challenge only triggers when risk_score >= challenge threshold (default 50).");
    console.log("[TIP] Your VPS IP might be scoring low. Options:");
    console.log("  1. Lower challenge threshold in dashboard Scoring Engine (e.g. set to 10)");
    console.log("  2. Run with 'bot' mode: node challenge_bypass.mjs <url> bot");
    console.log("  3. Add your VPS IP to a bad reputation list");
    console.log("  4. Send multiple rapid requests first (triggers rate_anomaly scoring)");

    // Debug: dump page content snippet to help understand what was served
    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (bodyText.length > 0) {
      console.log(`[i] Page body preview: "${bodyText.substring(0, 200)}..."`);
    }

    await page.screenshot({ path: "challenge_not_triggered.png", fullPage: true });
    console.log("[i] Screenshot saved: challenge_not_triggered.png");
    await browser.close();
    return;
  }

  console.log("[!] Challenge page detected — attempting to solve slider...");

  // ─── READ TARGET ZONE POSITION ─────────────────────────────────────
  // The server sets target-zone left as CSS style: (target - 4)%
  // We need to slide the handle to that target percentage
  const targetStyle = await targetZone.getAttribute("style");
  console.log(`[i] Target zone style: ${targetStyle}`);

  const trackBox = await track.boundingBox();
  const handleBox = await handle.boundingBox();

  if (!trackBox || !handleBox) {
    console.log("[✗] Could not get bounding boxes for track/handle");
    await browser.close();
    return;
  }

  // Parse target percentage from inline style "left: XX%"
  const leftMatch = targetStyle?.match(/left:\s*([\d.]+)%/);
  if (!leftMatch) {
    console.log("[✗] Could not parse target zone position");
    await browser.close();
    return;
  }

  const targetPercent = parseFloat(leftMatch[1]);
  // The actual target is targetPercent + 4 (because CSS sets left = target - 4)
  const actualTarget = targetPercent + 4;
  console.log(`[i] Target position: ${actualTarget}%`);

  // Calculate pixel position to drag to
  const trackWidth = trackBox.width;
  const handleWidth = handleBox.width;
  const maxX = trackWidth - handleWidth;
  const targetPixelX = (actualTarget / 100) * maxX;

  // ─── SIMULATE HUMAN SIGNALS ────────────────────────────────────────
  // Server checks: mousemove_before_drag > 0, first_interaction_ms >= 200ms

  // Move mouse around page randomly before touching slider (builds signals)
  console.log("[*] Generating pre-drag mouse movements...");
  for (let i = 0; i < Math.floor(rand(5, 12)); i++) {
    await page.mouse.move(
      rand(200, 1700),
      rand(200, 800)
    );
    await sleep(rand(50, 200));
  }

  // Wait to satisfy first_interaction_ms >= 200ms
  await sleep(rand(300, 800));

  // ─── DRAG THE SLIDER ───────────────────────────────────────────────
  // Server checks:
  // - duration >= 1500ms (total time from page load to submit)
  // - trajectory points >= 10
  // - speed variance >= 0.5
  // - straightness < 0.99 (must not be perfectly straight)
  // - Y jitter >= 0.5 (must have vertical movement)
  // - direction changes > 0 (must have at least 1 X reversal)
  // - timing variance >= 2.0 (intervals between points must vary)

  const startX = trackBox.x + handleBox.width / 2;
  const startY = trackBox.y + handleBox.height / 2;

  // Move to handle
  await page.mouse.move(startX + rand(-3, 3), startY + rand(-2, 2));
  await sleep(rand(100, 300));

  // Mouse down on handle
  await page.mouse.down();
  await sleep(rand(30, 80));

  let currentX = startX;
  const totalDistance = targetPixelX - (handleBox.x - trackBox.x);
  const steps = Math.floor(rand(25, 45));
  const baseStep = totalDistance / steps;

  console.log(`[*] Dragging slider: ${steps} steps, ~${totalDistance.toFixed(0)}px total`);

  for (let i = 0; i < steps; i++) {
    // Variable speed: slow start, fast middle, slow end (human-like)
    let progress = i / steps;
    let speedMult;
    if (progress < 0.15) speedMult = rand(0.3, 0.6);        // slow start
    else if (progress < 0.75) speedMult = rand(0.8, 1.5);   // fast middle
    else speedMult = rand(0.3, 0.7);                         // slow end

    currentX += baseStep * speedMult;

    // Add Y jitter (satisfies jitterMin >= 0.5)
    const yOffset = rand(-5, 5);

    await page.mouse.move(
      currentX,
      startY + yOffset
    );

    // Variable timing between moves (satisfies timingVarianceMin >= 2.0)
    const delay = rand(8, 60);
    await sleep(delay);
  }

  // Add direction change: overshoot then correct back (satisfies directionChanges > 0)
  const overshoot = rand(12, 25);
  currentX += overshoot;
  await page.mouse.move(currentX, startY + rand(-3, 3));
  await sleep(rand(60, 150));

  // Correct back
  currentX -= overshoot * rand(0.5, 0.8);
  await page.mouse.move(currentX, startY + rand(-3, 3));
  await sleep(rand(40, 120));

  // Small oscillation
  currentX += rand(-5, 5);
  await page.mouse.move(currentX, startY + rand(-2, 2));
  await sleep(rand(30, 80));

  // Release
  await page.mouse.up();

  console.log("[*] Slider released — waiting for server response...");

  // ─── CHECK RESULT ──────────────────────────────────────────────────
  await sleep(3000);

  const statusEl = page.locator("#status");
  const statusText = await statusEl.textContent().catch(() => "");
  const metaStatusEl = page.locator("#meta-status");
  const metaStatus = await metaStatusEl.textContent().catch(() => "");

  console.log(`[i] Status message: "${statusText}"`);
  console.log(`[i] Meta status: "${metaStatus}"`);

  if (statusText.includes("Verified") || metaStatus === "Verified") {
    console.log("[✓] BYPASS SUCCESSFUL — Challenge solved!");
    // Wait for redirect
    await sleep(1500);
    const finalUrl = page.url();
    const finalTitle = await page.title();
    console.log(`[i] Redirected to: ${finalUrl}`);
    console.log(`[i] Final page title: "${finalTitle}"`);
  } else if (statusText.includes("Incorrect")) {
    console.log("[✗] BYPASS FAILED — Wrong position. Challenge not solved.");
  } else if (statusText.includes("expired")) {
    console.log("[✗] BYPASS FAILED — Challenge expired.");
  } else if (statusText.includes("Too many")) {
    console.log("[✗] BYPASS FAILED — Max attempts exceeded.");
  } else {
    console.log("[?] Unknown state — check output above.");
  }

  // Take screenshot for debugging
  await page.screenshot({ path: "challenge_result.png", fullPage: true });
  console.log("[i] Screenshot saved: challenge_result.png");

  await browser.close();
}

main().catch((err) => {
  console.error("[✗] Error:", err.message);
  process.exit(1);
});
