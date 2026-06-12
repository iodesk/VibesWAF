package pipeline

type ScoreCategory string

const (
	ScoreCategoryIPReputation    ScoreCategory = "ip_reputation"
	ScoreCategoryBotDetection    ScoreCategory = "bot_detection"
	ScoreCategoryWAFAnomaly      ScoreCategory = "waf_anomaly"
	ScoreCategoryProtocolAnomaly ScoreCategory = "protocol_anomaly"
	ScoreCategoryTrust           ScoreCategory = "trust"
)

type ScoreEntry struct {
	Category ScoreCategory `json:"category"`
	Rule     string        `json:"rule"`
	Score    int           `json:"score"`
}

type RiskScore struct {
	Total      int            `json:"total"`
	Entries    []ScoreEntry   `json:"entries"`
	ByCategory map[ScoreCategory]int `json:"by_category"`
}

func NewRiskScore() *RiskScore {
	return &RiskScore{
		Entries:    make([]ScoreEntry, 0),
		ByCategory: make(map[ScoreCategory]int),
	}
}

func (rs *RiskScore) Add(category ScoreCategory, rule string, score int) {
	entry := ScoreEntry{
		Category: category,
		Rule:     rule,
		Score:    score,
	}
	rs.Entries = append(rs.Entries, entry)
	rs.ByCategory[category] += score
	rs.Total += score
}

func (rs *RiskScore) ApplyCap(category ScoreCategory, maxScore int) {
	current := rs.ByCategory[category]
	if current <= maxScore {
		return
	}

	overflow := current - maxScore
	rs.ByCategory[category] = maxScore
	rs.Total -= overflow
}

func (rs *RiskScore) ApplyMultiplier(category ScoreCategory, multiplier float64) {
	if multiplier == 1.0 {
		return
	}

	current := rs.ByCategory[category]
	adjusted := int(float64(current) * multiplier)
	diff := adjusted - current
	rs.ByCategory[category] = adjusted
	rs.Total += diff
}

func (rs *RiskScore) ClampTotal() {
	if rs.Total < 0 {
		rs.Total = 0
	}
	if rs.Total > 100 {
		rs.Total = 100
	}
}
