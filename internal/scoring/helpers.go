package scoring

import "strings"

func looksLikeBrowserUA(ua string) bool {
	if ua == "" {
		return false
	}
	uaLower := strings.ToLower(ua)
	for _, kw := range []string{"mozilla", "chrome", "safari", "firefox", "edge", "opera", "msie", "trident", "webkit", "gecko"} {
		if strings.Contains(uaLower, kw) {
			return true
		}
	}
	return false
}

func looksLikeChromiumUA(ua string) bool {
	uaLower := strings.ToLower(ua)
	return strings.Contains(uaLower, "chrome") ||
		strings.Contains(uaLower, "chromium") ||
		strings.Contains(uaLower, "edg/") ||
		strings.Contains(uaLower, "brave") ||
		strings.Contains(uaLower, "opr/")
}

func looksLikeFirefoxUA(ua string) bool {
	uaLower := strings.ToLower(ua)
	return strings.Contains(uaLower, "firefox") || strings.Contains(uaLower, "fxios")
}

func isHeadlessUA(ua string) bool {
	if ua == "" {
		return false
	}
	uaLower := strings.ToLower(ua)
	for _, indicator := range []string{
		"headlesschrome",
		"headlessfirefox",
		"phantomjs",
		"selenium",
		"puppeteer",
		"playwright",
		"webdriver",
		"httrack",
		"chromium headless",
	} {
		if strings.Contains(uaLower, indicator) {
			return true
		}
	}
	return false
}
