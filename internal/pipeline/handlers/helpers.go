package handlers

import "strings"

func toResult(action string) string {
	switch action {
	case "block":
		return "BLOCK"
	case "challenge":
		return "CHALLENGE"
	case "allow":
		return "ALLOW"
	default:
		return "MATCH"
	}
}

func joinReasons(reasons []string) string {
	return strings.Join(reasons, "; ")
}
