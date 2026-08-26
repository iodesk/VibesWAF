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

type CategoryScores struct {
	IPReputation    int `json:"ip_reputation"`
	BotDetection    int `json:"bot_detection"`
	WAFAnomaly      int `json:"waf_anomaly"`
	ProtocolAnomaly int `json:"protocol_anomaly"`
	Trust           int `json:"trust"`
}

type RiskScore struct {
	Total      int            `json:"total"`
	Entries    []ScoreEntry   `json:"entries"`
	ByCategory CategoryScores `json:"by_category"`
}

func NewRiskScore() *RiskScore {
	return &RiskScore{
		Entries: make([]ScoreEntry, 0),
	}
}

func (rs *RiskScore) get(category ScoreCategory) int {
	switch category {
	case ScoreCategoryIPReputation:
		return rs.ByCategory.IPReputation
	case ScoreCategoryBotDetection:
		return rs.ByCategory.BotDetection
	case ScoreCategoryWAFAnomaly:
		return rs.ByCategory.WAFAnomaly
	case ScoreCategoryProtocolAnomaly:
		return rs.ByCategory.ProtocolAnomaly
	case ScoreCategoryTrust:
		return rs.ByCategory.Trust
	default:
		return 0
	}
}

func (rs *RiskScore) set(category ScoreCategory, value int) {
	switch category {
	case ScoreCategoryIPReputation:
		rs.ByCategory.IPReputation = value
	case ScoreCategoryBotDetection:
		rs.ByCategory.BotDetection = value
	case ScoreCategoryWAFAnomaly:
		rs.ByCategory.WAFAnomaly = value
	case ScoreCategoryProtocolAnomaly:
		rs.ByCategory.ProtocolAnomaly = value
	case ScoreCategoryTrust:
		rs.ByCategory.Trust = value
	}
}

func (rs *RiskScore) Add(category ScoreCategory, rule string, score int) {
	entry := ScoreEntry{
		Category: category,
		Rule:     rule,
		Score:    score,
	}
	rs.Entries = append(rs.Entries, entry)
	rs.set(category, rs.get(category)+score)
	rs.Total += score
}

func (rs *RiskScore) ApplyCap(category ScoreCategory, maxScore int) {
	current := rs.get(category)
	if current <= maxScore {
		return
	}

	overflow := current - maxScore
	rs.set(category, maxScore)
	rs.Total -= overflow
}

func (rs *RiskScore) ApplyMultiplier(category ScoreCategory, multiplier float64) {
	if multiplier == 1.0 {
		return
	}

	current := rs.get(category)
	adjusted := int(float64(current) * multiplier)
	diff := adjusted - current
	rs.set(category, adjusted)
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
