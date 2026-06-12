package challenge

import "math"

type TrajectoryPoint struct {
	X int `json:"x"`
	Y int `json:"y"`
	T int `json:"t"`
}

type ChallengeSignals struct {
	FocusCount      int `json:"focus_count"`
	BlurCount       int `json:"blur_count"`
	ScrollCount     int `json:"scroll_count"`
	MouseBeforeDrag int `json:"mousemove_before_drag"`
	FirstInteraction int `json:"first_interaction_ms"`
}

type TrustLevelConfig struct {
	Level0Max         float64 `json:"level0_max"`
	Level1Max         float64 `json:"level1_max"`
	Level2Max         float64 `json:"level2_max"`
	Reductions        [4]int  `json:"reductions"`
	MinPoints         int     `json:"min_points"`
	SpeedVarianceMin  float64 `json:"speed_variance_min"`
	StraightnessMax   float64 `json:"straightness_max"`
	JitterMin         float64 `json:"jitter_min"`
	TimingVarianceMin float64 `json:"timing_variance_min"`
	FirstInteractMin  int     `json:"first_interact_min_ms"`
	AccelVarianceMin  float64 `json:"accel_variance_min"`
	PauseRequired     bool    `json:"pause_required"`
	PauseMinMs        int     `json:"pause_min_ms"`
}

func DefaultTrustLevelConfig() TrustLevelConfig {
	return TrustLevelConfig{
		Level0Max:         0.40,
		Level1Max:         0.60,
		Level2Max:         0.80,
		Reductions:        [4]int{0, -5, -10, -15},
		MinPoints:         10,
		SpeedVarianceMin:  0.5,
		StraightnessMax:   0.99,
		JitterMin:         0.5,
		TimingVarianceMin: 2.0,
		FirstInteractMin:  200,
		AccelVarianceMin:  0.3,
		PauseRequired:     true,
		PauseMinMs:        40,
	}
}

func AnalyzeTrajectory(points []TrajectoryPoint, cfg TrustLevelConfig) float64 {
	score := 1.0

	if len(points) < cfg.MinPoints {
		score -= 0.4
	}

	if len(points) >= 2 {
		sv := calcSpeedVariance(points)
		if sv < cfg.SpeedVarianceMin {
			score -= 0.3
		}

		st := calcStraightness(points)
		if st > cfg.StraightnessMax {
			score -= 0.2
		}

		jt := calcYJitter(points)
		if jt < cfg.JitterMin {
			score -= 0.2
		}

		dc := calcDirectionChanges(points)
		if dc == 0 {
			score -= 0.15
		}

		tv := calcTimingVariance(points)
		if tv < cfg.TimingVarianceMin {
			score -= 0.2
		}

		// Acceleration variance: human movement has phases (accelerate, cruise, decelerate)
		av := calcAccelVariance(points)
		if av < cfg.AccelVarianceMin {
			score -= 0.2
		}

		// Pause detection: humans often have micro-pauses (hesitation before release)
		if cfg.PauseRequired {
			hasPause := detectPause(points, cfg.PauseMinMs)
			if !hasPause {
				score -= 0.15
			}
		}
	}

	if score < 0 {
		score = 0
	}
	return score
}

func AnalyzeSignals(s ChallengeSignals, cfg TrustLevelConfig) float64 {
	score := 1.0

	if s.MouseBeforeDrag == 0 {
		score -= 0.2
	}

	if s.FirstInteraction < cfg.FirstInteractMin {
		score -= 0.3
	}

	if s.FocusCount == 0 && s.BlurCount == 0 && s.ScrollCount == 0 && s.MouseBeforeDrag == 0 {
		score -= 0.1
	}

	if score < 0 {
		score = 0
	}
	return score
}

func ComputeTrustLevel(trajectoryScore, signalsScore float64, cfg TrustLevelConfig) int {
	confidence := (trajectoryScore * 0.7) + (signalsScore * 0.3)

	switch {
	case confidence < cfg.Level0Max:
		return 0
	case confidence < cfg.Level1Max:
		return 1
	case confidence < cfg.Level2Max:
		return 2
	default:
		return 3
	}
}

func calcSpeedVariance(points []TrajectoryPoint) float64 {
	if len(points) < 3 {
		return 0
	}

	speeds := make([]float64, 0, len(points)-1)
	for i := 1; i < len(points); i++ {
		dx := float64(points[i].X - points[i-1].X)
		dy := float64(points[i].Y - points[i-1].Y)
		dt := float64(points[i].T - points[i-1].T)
		if dt <= 0 {
			continue
		}
		dist := math.Sqrt(dx*dx + dy*dy)
		speeds = append(speeds, dist/dt)
	}

	if len(speeds) < 2 {
		return 0
	}

	var sum float64
	for _, s := range speeds {
		sum += s
	}
	mean := sum / float64(len(speeds))

	var variance float64
	for _, s := range speeds {
		diff := s - mean
		variance += diff * diff
	}
	variance /= float64(len(speeds))

	return variance
}

func calcStraightness(points []TrajectoryPoint) float64 {
	if len(points) < 2 {
		return 1.0
	}

	first := points[0]
	last := points[len(points)-1]
	directDx := float64(last.X - first.X)
	directDy := float64(last.Y - first.Y)
	directDist := math.Sqrt(directDx*directDx + directDy*directDy)

	if directDist == 0 {
		return 1.0
	}

	var totalDist float64
	for i := 1; i < len(points); i++ {
		dx := float64(points[i].X - points[i-1].X)
		dy := float64(points[i].Y - points[i-1].Y)
		totalDist += math.Sqrt(dx*dx + dy*dy)
	}

	if totalDist == 0 {
		return 1.0
	}

	return directDist / totalDist
}

func calcYJitter(points []TrajectoryPoint) float64 {
	if len(points) < 2 {
		return 0
	}

	var totalJitter float64
	for i := 1; i < len(points); i++ {
		totalJitter += math.Abs(float64(points[i].Y - points[i-1].Y))
	}

	return totalJitter / float64(len(points)-1)
}

func calcDirectionChanges(points []TrajectoryPoint) int {
	if len(points) < 3 {
		return 0
	}

	changes := 0
	for i := 2; i < len(points); i++ {
		prevDx := points[i-1].X - points[i-2].X
		currDx := points[i].X - points[i-1].X
		if (prevDx > 0 && currDx < 0) || (prevDx < 0 && currDx > 0) {
			changes++
		}
	}
	return changes
}

func calcTimingVariance(points []TrajectoryPoint) float64 {
	if len(points) < 3 {
		return 0
	}

	intervals := make([]float64, 0, len(points)-1)
	for i := 1; i < len(points); i++ {
		dt := float64(points[i].T - points[i-1].T)
		if dt >= 0 {
			intervals = append(intervals, dt)
		}
	}

	if len(intervals) < 2 {
		return 0
	}

	var sum float64
	for _, v := range intervals {
		sum += v
	}
	mean := sum / float64(len(intervals))

	if mean == 0 {
		return 0
	}

	var variance float64
	for _, v := range intervals {
		diff := v - mean
		variance += diff * diff
	}
	variance /= float64(len(intervals))

	return variance
}

// calcAccelVariance measures variance in acceleration (change in speed over time).
// Humans have distinct phases: acceleration at start, cruise in middle, deceleration at end.
// Bots tend to have uniform or linearly interpolated speed changes.
func calcAccelVariance(points []TrajectoryPoint) float64 {
	if len(points) < 4 {
		return 0
	}

	// Calculate speeds first
	speeds := make([]float64, 0, len(points)-1)
	for i := 1; i < len(points); i++ {
		dx := float64(points[i].X - points[i-1].X)
		dy := float64(points[i].Y - points[i-1].Y)
		dt := float64(points[i].T - points[i-1].T)
		if dt <= 0 {
			continue
		}
		dist := math.Sqrt(dx*dx + dy*dy)
		speeds = append(speeds, dist/dt)
	}

	if len(speeds) < 3 {
		return 0
	}

	// Calculate accelerations (change in speed)
	accels := make([]float64, 0, len(speeds)-1)
	for i := 1; i < len(speeds); i++ {
		accels = append(accels, speeds[i]-speeds[i-1])
	}

	if len(accels) < 2 {
		return 0
	}

	// Variance of accelerations
	var sum float64
	for _, a := range accels {
		sum += a
	}
	mean := sum / float64(len(accels))

	var variance float64
	for _, a := range accels {
		diff := a - mean
		variance += diff * diff
	}
	variance /= float64(len(accels))

	return variance
}

// detectPause checks for at least one micro-pause in the trajectory.
// A pause is defined as a time gap >= pauseMinMs between consecutive points
// where displacement is minimal (< 3px).
func detectPause(points []TrajectoryPoint, pauseMinMs int) bool {
	for i := 1; i < len(points); i++ {
		dt := points[i].T - points[i-1].T
		if dt >= pauseMinMs {
			dx := math.Abs(float64(points[i].X - points[i-1].X))
			dy := math.Abs(float64(points[i].Y - points[i-1].Y))
			if dx < 3 && dy < 3 {
				return true
			}
		}
	}
	return false
}
