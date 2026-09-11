package challenge

import (
	"bytes"
	"testing"
)

func TestSecureRandomTargetUsesProvidedEntropy(t *testing.T) {
	target, err := secureRandomTarget(bytes.NewReader([]byte{0, 0, 0, 0}))
	if err != nil {
		t.Fatalf("secureRandomTarget returned error: %v", err)
	}
	if target != sliderMinTarget {
		t.Fatalf("target = %d, want %d", target, sliderMinTarget)
	}
}

func TestSecureRandomTargetRejectsEntropyFailure(t *testing.T) {
	if _, err := secureRandomTarget(bytes.NewReader(nil)); err == nil {
		t.Fatal("secureRandomTarget must fail when cryptographic entropy is unavailable")
	}
}
