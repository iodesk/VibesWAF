package challenge

import (
	"math/rand"
)

const (
	sliderMinTarget = 20
	sliderMaxTarget = 80
	sliderTolerance = 4
	sliderMinTimeMs = 1500
)

type SliderChallenge struct{}

func NewSliderChallenge() *SliderChallenge {
	return &SliderChallenge{}
}

func (s *SliderChallenge) TypeName() string {
	return "slider"
}

func (s *SliderChallenge) Generate() *ChallengeData {
	target := sliderMinTarget + rand.Intn(sliderMaxTarget-sliderMinTarget+1)

	return &ChallengeData{
		Type: "slider",
		Payload: map[string]interface{}{
			"target": target,
		},
		Answer: target,
	}
}

func (s *SliderChallenge) Validate(data *ChallengeData, answer int, meta ValidateMeta) bool {
	if meta.Duration.Milliseconds() < sliderMinTimeMs {
		return false
	}

	diff := answer - data.Answer
	if diff < 0 {
		diff = -diff
	}

	return diff <= sliderTolerance
}
