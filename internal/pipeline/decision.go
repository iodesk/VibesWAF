package pipeline


type Decision struct {
	Action   string
	Source   string
	Reason   string
	Metadata map[string]interface{}


	SkipPhases []string
}


const (
	ActionRankBlock     = 4
	ActionRankChallenge = 3
	ActionRankAllow     = 2
	ActionRankLog       = 1
	ActionRankNone      = 0
)


func NewDecision(action, source, reason string) Decision {
	return Decision{
		Action:   action,
		Source:   source,
		Reason:   reason,
		Metadata: make(map[string]interface{}),
	}
}


func NewSkipDecision(source string, skipPhases []string) Decision {
	return Decision{
		Action:     "skip",
		Source:     source,
		SkipPhases: skipPhases,
		Metadata:   make(map[string]interface{}),
	}
}


func GetActionRank(action string) int {
	switch action {
	case "block":
		return ActionRankBlock
	case "challenge":
		return ActionRankChallenge
	case "allow":
		return ActionRankAllow
	case "log":
		return ActionRankLog
	default:
		return ActionRankNone
	}
}



func ResolveDecision(current, new Decision) Decision {

	if new.Action == "skip" {
		return current
	}


	currentRank := GetActionRank(current.Action)
	newRank := GetActionRank(new.Action)

	if newRank > currentRank {
		return new
	}

	return current
}
