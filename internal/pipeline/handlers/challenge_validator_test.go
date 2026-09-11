package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
	"time"

	"github.com/iodesk/VibesWAF/internal/model"
)

type stubBotConfig struct {
	cfg model.BotConfig
}

func (s stubBotConfig) GetConfig() model.BotConfig { return s.cfg }

const testChallengeSecret = "test-secret"

func testValidator(maxAge int) *ChallengeValidator {
	return newChallengeValidator(
		stubBotConfig{cfg: model.BotConfig{ChallengeDuration: maxAge}},
		testChallengeSecret,
	)
}

func signTestCookie(secret, ip, ua string, ts int64, level int) string {
	mac := hmac.New(sha256.New, []byte(secret))
	fmt.Fprintf(mac, "%s:%s:%d:%d", ip, ua, ts, level)
	return fmt.Sprintf("%s.%d.%d", hex.EncodeToString(mac.Sum(nil)), ts, level)
}

func TestVerifyCookieAcceptsCurrentFormat(t *testing.T) {
	const ip, ua = "1.2.3.4", "Mozilla/5.0"
	now := time.Now().Unix()
	cookie := signTestCookie(testChallengeSecret, ip, ua, now, 2)

	level, ok := testValidator(3600).verifyCookie(cookie, ip, ua)
	if !ok {
		t.Fatal("valid cookie must be accepted")
	}
	if level != 2 {
		t.Fatalf("trust level = %d, want 2", level)
	}
}

func TestVerifyCookieRejectsTruncatedSignature(t *testing.T) {
	const ip, ua = "1.2.3.4", "Mozilla/5.0"
	now := time.Now().Unix()
	full := signTestCookie(testChallengeSecret, ip, ua, now, 3)
	truncated := full[:32] + full[len(full)-len(fmt.Sprintf(".%d.%d", now, 3)):]

	if _, ok := testValidator(3600).verifyCookie(truncated, ip, ua); ok {
		t.Fatal("32-character truncated signature must be rejected (downgrade attack)")
	}
}

func TestVerifyCookieRejectsLegacyTwoPartFormat(t *testing.T) {
	const ip, ua = "1.2.3.4", "Mozilla/5.0"
	now := time.Now().Unix()
	mac := hmac.New(sha256.New, []byte(testChallengeSecret))
	fmt.Fprintf(mac, "%s:%s:%d", ip, ua, now)
	legacy := fmt.Sprintf("%s.%d", hex.EncodeToString(mac.Sum(nil)), now)

	if _, ok := testValidator(3600).verifyCookie(legacy, ip, ua); ok {
		t.Fatal("legacy two-part cookie format must be rejected")
	}
}

func TestVerifyCookieRejectsFutureTimestamp(t *testing.T) {
	const ip, ua = "1.2.3.4", "Mozilla/5.0"
	cookie := signTestCookie(testChallengeSecret, ip, ua, time.Now().Add(time.Hour).Unix(), 3)

	if _, ok := testValidator(3600).verifyCookie(cookie, ip, ua); ok {
		t.Fatal("cookie from the future must be rejected")
	}
}

func TestVerifyCookieRejectsExpiredCookie(t *testing.T) {
	const ip, ua = "1.2.3.4", "Mozilla/5.0"
	cookie := signTestCookie(testChallengeSecret, ip, ua, time.Now().Add(-2*time.Hour).Unix(), 3)

	if _, ok := testValidator(3600).verifyCookie(cookie, ip, ua); ok {
		t.Fatal("expired cookie must be rejected")
	}
}

func TestVerifyCookieRejectsOutOfRangeTrustLevel(t *testing.T) {
	const ip, ua = "1.2.3.4", "Mozilla/5.0"
	cookie := signTestCookie(testChallengeSecret, ip, ua, time.Now().Unix(), 4)

	if _, ok := testValidator(3600).verifyCookie(cookie, ip, ua); ok {
		t.Fatal("trust level outside 0-3 must be rejected")
	}
}

func TestVerifyCookieBindsToIPAndUserAgent(t *testing.T) {
	now := time.Now().Unix()
	cookie := signTestCookie(testChallengeSecret, "1.2.3.4", "Mozilla/5.0", now, 3)

	if _, ok := testValidator(3600).verifyCookie(cookie, "5.6.7.8", "Mozilla/5.0"); ok {
		t.Fatal("cookie must not verify for another IP")
	}
	if _, ok := testValidator(3600).verifyCookie(cookie, "1.2.3.4", "curl/8.0"); ok {
		t.Fatal("cookie must not verify for another User-Agent")
	}
}
