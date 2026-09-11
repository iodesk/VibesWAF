package model

import "testing"

func TestProtocolAnomalyDefaultsMergeMissingRules(t *testing.T) {
	stored := ProtocolAnomalyConfig{Rules: map[string]int{"http2_connection_header": 99}}

	merged := stored.WithDefaults()

	if merged.Rules["http2_connection_header"] != 99 {
		t.Fatalf("stored value = %d, want 99 to win", merged.Rules["http2_connection_header"])
	}
	if merged.Rules["ja4_old_tls"] <= 0 {
		t.Fatal("new default rule must be merged into stored config")
	}
}

func TestProtocolAnomalyDefaultsRespectExplicitDisable(t *testing.T) {
	stored := ProtocolAnomalyConfig{Rules: map[string]int{"ja4_old_tls": 0}}

	merged := stored.WithDefaults()

	if merged.Rules["ja4_old_tls"] != 0 {
		t.Fatalf("explicit 0 must be kept, got %d", merged.Rules["ja4_old_tls"])
	}
}
