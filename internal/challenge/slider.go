package challenge

import (
	"crypto/rand"
	"encoding/binary"
	"io"
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
	target, err := secureRandomTarget(rand.Reader)
	if err != nil {
		return nil
	}

	return &ChallengeData{
		Type: "slider",
		Payload: map[string]interface{}{
			"target": target,
		},
		Answer: target,
	}
}

func secureRandomTarget(random io.Reader) (int, error) {
	const targetRange = uint32(sliderMaxTarget - sliderMinTarget + 1)
	const rejectionLimit = ^uint32(0) - (^uint32(0) % targetRange)

	var buf [4]byte
	for {
		if _, err := io.ReadFull(random, buf[:]); err != nil {
			return 0, err
		}
		value := binary.LittleEndian.Uint32(buf[:])
		if value < rejectionLimit {
			return sliderMinTarget + int(value%targetRange), nil
		}
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
