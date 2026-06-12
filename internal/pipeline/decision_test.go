package pipeline

import "testing"

func TestGetActionRank(t *testing.T) {
	cases := map[string]int{
		"block":     ActionRankBlock,
		"challenge": ActionRankChallenge,
		"allow":     ActionRankAllow,
		"log":       ActionRankLog,
		"":          ActionRankNone,
		"unknown":   ActionRankNone,
	}
	for action, want := range cases {
		if got := GetActionRank(action); got != want {
			t.Errorf("GetActionRank(%q) = %d, want %d", action, got, want)
		}
	}
}

func TestResolveDecisionEscalates(t *testing.T) {
	current := NewDecision("challenge", "scoring", "score>=50")
	higher := NewDecision("block", "flood", "attack")

	got := ResolveDecision(current, higher)
	if got.Action != "block" {
		t.Fatalf("higher-rank action should win, got %q", got.Action)
	}
}

func TestResolveDecisionKeepsHigher(t *testing.T) {
	current := NewDecision("block", "ip_rule", "blacklist")
	lower := NewDecision("challenge", "scoring", "score")

	got := ResolveDecision(current, lower)
	if got.Action != "block" {
		t.Fatalf("lower-rank action must not downgrade, got %q", got.Action)
	}
}

func TestResolveDecisionSkipKeepsCurrent(t *testing.T) {
	current := NewDecision("challenge", "scoring", "score")
	skip := NewSkipDecision("rule", []string{"waf"})

	got := ResolveDecision(current, skip)
	if got.Action != "challenge" {
		t.Fatalf("skip must not change decision, got %q", got.Action)
	}
}

func TestResolveDecisionFromEmpty(t *testing.T) {
	var current Decision // zero value, Action ""
	newD := NewDecision("allow", "default", "")

	got := ResolveDecision(current, newD)
	if got.Action != "allow" {
		t.Fatalf("any ranked action beats none, got %q", got.Action)
	}
}

func TestContextAddDecisionEscalation(t *testing.T) {
	ctx := &Context{}
	ctx.AddDecision(NewDecision("challenge", "scoring", "score>=50"))
	if ctx.Action != "challenge" {
		t.Fatalf("Action = %q, want challenge", ctx.Action)
	}
	ctx.AddDecision(NewDecision("block", "flood", "attack"))
	if ctx.Action != "block" {
		t.Fatalf("Action = %q, want block after escalation", ctx.Action)
	}
	if ctx.Reason != "attack" {
		t.Fatalf("Reason = %q, want attack", ctx.Reason)
	}
}

func TestContextAddDecisionNoDowngrade(t *testing.T) {
	ctx := &Context{}
	ctx.AddDecision(NewDecision("block", "ip_rule", "blacklist"))
	ctx.AddDecision(NewDecision("challenge", "scoring", "score"))
	if ctx.Action != "block" {
		t.Fatalf("Action = %q, want block (no downgrade)", ctx.Action)
	}
}

func TestContextAddSkipDecisionSetsPhase(t *testing.T) {
	ctx := &Context{}
	ctx.AddDecision(NewSkipDecision("rule", []string{"waf", "bot_detection"}))

	if ctx.Action == "skip" {
		t.Fatal("skip decision must not set Action")
	}
	if !ctx.IsPhaseSkipped("waf") || !ctx.IsPhaseSkipped("bot_detection") {
		t.Fatal("skip phases not recorded")
	}
	if ctx.IsPhaseSkipped("flood") {
		t.Fatal("unrelated phase should not be skipped")
	}
}

func TestContextSkipModules(t *testing.T) {
	ctx := &Context{}
	ctx.AddSkipModules([]string{"flood"})
	if !ctx.ShouldSkipModule("flood") {
		t.Fatal("flood module should be skipped")
	}
	if ctx.ShouldSkipModule("waf") {
		t.Fatal("waf module should not be skipped")
	}
}
