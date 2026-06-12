package pipeline

import "testing"

func TestRiskScoreAdd(t *testing.T) {
	rs := NewRiskScore()
	rs.Add(ScoreCategoryWAFAnomaly, "sqli", 30)
	rs.Add(ScoreCategoryWAFAnomaly, "xss", 10)
	rs.Add(ScoreCategoryIPReputation, "datacenter", 15)

	if rs.Total != 55 {
		t.Fatalf("Total = %d, want 55", rs.Total)
	}
	if rs.ByCategory[ScoreCategoryWAFAnomaly] != 40 {
		t.Fatalf("WAF category = %d, want 40", rs.ByCategory[ScoreCategoryWAFAnomaly])
	}
	if rs.ByCategory[ScoreCategoryIPReputation] != 15 {
		t.Fatalf("IP category = %d, want 15", rs.ByCategory[ScoreCategoryIPReputation])
	}
	if len(rs.Entries) != 3 {
		t.Fatalf("Entries = %d, want 3", len(rs.Entries))
	}
}

func TestRiskScoreApplyCap(t *testing.T) {
	rs := NewRiskScore()
	rs.Add(ScoreCategoryWAFAnomaly, "many", 60)
	rs.ApplyCap(ScoreCategoryWAFAnomaly, 40)

	if rs.ByCategory[ScoreCategoryWAFAnomaly] != 40 {
		t.Fatalf("capped category = %d, want 40", rs.ByCategory[ScoreCategoryWAFAnomaly])
	}
	if rs.Total != 40 {
		t.Fatalf("Total after cap = %d, want 40 (overflow 20 removed)", rs.Total)
	}
}

func TestRiskScoreApplyCapNoOp(t *testing.T) {
	rs := NewRiskScore()
	rs.Add(ScoreCategoryBotDetection, "bot", 20)
	rs.ApplyCap(ScoreCategoryBotDetection, 30)

	if rs.Total != 20 || rs.ByCategory[ScoreCategoryBotDetection] != 20 {
		t.Fatalf("under-cap should be unchanged, got total=%d cat=%d", rs.Total, rs.ByCategory[ScoreCategoryBotDetection])
	}
}

func TestRiskScoreApplyMultiplier(t *testing.T) {
	rs := NewRiskScore()
	rs.Add(ScoreCategoryProtocolAnomaly, "anomaly", 20)
	rs.ApplyMultiplier(ScoreCategoryProtocolAnomaly, 1.5)

	if rs.ByCategory[ScoreCategoryProtocolAnomaly] != 30 {
		t.Fatalf("multiplied category = %d, want 30", rs.ByCategory[ScoreCategoryProtocolAnomaly])
	}
	if rs.Total != 30 {
		t.Fatalf("Total after multiplier = %d, want 30", rs.Total)
	}
}

func TestRiskScoreApplyMultiplierIdentity(t *testing.T) {
	rs := NewRiskScore()
	rs.Add(ScoreCategoryBotDetection, "bot", 25)
	rs.ApplyMultiplier(ScoreCategoryBotDetection, 1.0)

	if rs.Total != 25 {
		t.Fatalf("multiplier 1.0 should be no-op, total=%d", rs.Total)
	}
}

func TestRiskScoreClampTotal(t *testing.T) {
	cases := []struct {
		name string
		in   int
		want int
	}{
		{"negative clamps to 0", -30, 0},
		{"over 100 clamps to 100", 150, 100},
		{"in range unchanged", 55, 55},
		{"boundary 0", 0, 0},
		{"boundary 100", 100, 100},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rs := NewRiskScore()
			rs.Total = tc.in
			rs.ClampTotal()
			if rs.Total != tc.want {
				t.Fatalf("ClampTotal(%d) = %d, want %d", tc.in, rs.Total, tc.want)
			}
		})
	}
}

func TestRiskScoreTrustReductionFlow(t *testing.T) {
	// Trust is a negative contribution; total can go below zero then clamp.
	rs := NewRiskScore()
	rs.Add(ScoreCategoryBotDetection, "suspicious", 20)
	rs.Add(ScoreCategoryTrust, "challenge_passed", -30)

	if rs.Total != -10 {
		t.Fatalf("Total = %d, want -10 before clamp", rs.Total)
	}
	rs.ClampTotal()
	if rs.Total != 0 {
		t.Fatalf("Total after clamp = %d, want 0", rs.Total)
	}
}
