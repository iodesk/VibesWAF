package logger

import "strings"


func ParseUserAgent(ua string) (deviceType string, os string) {
	uaLower := strings.ToLower(ua)


	switch {
	case strings.Contains(uaLower, "windows"):
		os = "windows"
	case strings.Contains(uaLower, "android"):
		os = "android"
	case strings.Contains(uaLower, "iphone") || strings.Contains(uaLower, "ipad"):
		os = "ios"
	case strings.Contains(uaLower, "mac os") || strings.Contains(uaLower, "macos"):
		os = "macos"
	case strings.Contains(uaLower, "linux"):
		os = "linux"
	default:
		os = "other"
	}


	switch {
	case strings.Contains(uaLower, "mobile") || strings.Contains(uaLower, "android") || strings.Contains(uaLower, "iphone"):
		deviceType = "mobile"
	case strings.Contains(uaLower, "tablet") || strings.Contains(uaLower, "ipad"):
		deviceType = "tablet"
	case strings.Contains(uaLower, "bot") || strings.Contains(uaLower, "crawler") || strings.Contains(uaLower, "spider"):
		deviceType = "bot"
	case os == "windows" || os == "macos" || os == "linux":
		deviceType = "desktop"
	default:
		deviceType = "other"
	}

	return deviceType, os
}
