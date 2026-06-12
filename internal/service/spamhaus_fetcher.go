package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

var spamhausClient = &http.Client{Timeout: 30 * time.Second}

type spamhausDROPEntry struct {
	CIDR string `json:"cidr"`
}

type spamhausASNEntry struct {
	ASN uint `json:"asn"`
}

func getSpamhausDropV4URL() string {
	if url := os.Getenv("SPAMHAUS_DROP_V4_URL"); url != "" {
		return url
	}
	return "https://www.spamhaus.org/drop/drop_v4.json"
}

func getSpamhausDropV6URL() string {
	if url := os.Getenv("SPAMHAUS_DROP_V6_URL"); url != "" {
		return url
	}
	return "https://www.spamhaus.org/drop/drop_v6.json"
}

func getSpamhausASNDropURL() string {
	if url := os.Getenv("SPAMHAUS_ASN_DROP_URL"); url != "" {
		return url
	}
	return "https://www.spamhaus.org/drop/asndrop.json"
}

func fetchSpamhausDROPv4() ([]string, error) {
	return fetchSpamhausCIDRList(getSpamhausDropV4URL())
}

func fetchSpamhausDROPv6() ([]string, error) {
	return fetchSpamhausCIDRList(getSpamhausDropV6URL())
}

func fetchSpamhausCIDRList(url string) ([]string, error) {
	resp, err := spamhausClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d from %s", resp.StatusCode, url)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var entries []spamhausDROPEntry
	if err := json.Unmarshal(body, &entries); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	cidrs := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.CIDR != "" {
			cidrs = append(cidrs, e.CIDR)
		}
	}
	return cidrs, nil
}

func fetchSpamhausASNDROP() ([]uint, error) {
	resp, err := spamhausClient.Get(getSpamhausASNDropURL())
	if err != nil {
		return nil, fmt.Errorf("failed to fetch ASN-DROP: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d from ASN-DROP", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var entries []spamhausASNEntry
	if err := json.Unmarshal(body, &entries); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	asns := make([]uint, 0, len(entries))
	for _, e := range entries {
		if e.ASN > 0 {
			asns = append(asns, e.ASN)
		}
	}
	return asns, nil
}
