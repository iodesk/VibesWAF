package service

import (
	"net"
	"testing"
)

func TestIPTrieExactMatch(t *testing.T) {
	trie := newIPTrie()
	_, cidr, _ := net.ParseCIDR("192.168.1.0/24")
	trie.insert(cidr, 50)

	ip := net.ParseIP("192.168.1.100")
	score, ok := trie.lookup(ip)
	if !ok || score != 50 {
		t.Fatalf("expected score=50 ok=true, got score=%d ok=%v", score, ok)
	}
}

func TestIPTrieNoMatch(t *testing.T) {
	trie := newIPTrie()
	_, cidr, _ := net.ParseCIDR("192.168.1.0/24")
	trie.insert(cidr, 50)

	ip := net.ParseIP("10.0.0.1")
	_, ok := trie.lookup(ip)
	if ok {
		t.Fatalf("expected no match for 10.0.0.1")
	}
}

func TestIPTrieLongestPrefixMatch(t *testing.T) {
	trie := newIPTrie()
	_, cidr16, _ := net.ParseCIDR("192.168.0.0/16")
	_, cidr24, _ := net.ParseCIDR("192.168.1.0/24")
	trie.insert(cidr16, 30)
	trie.insert(cidr24, 70)

	ip := net.ParseIP("192.168.1.5")
	score, ok := trie.lookup(ip)
	if !ok || score != 70 {
		t.Fatalf("expected longest prefix /24 match score=70, got score=%d ok=%v", score, ok)
	}

	ip2 := net.ParseIP("192.168.2.5")
	score2, ok2 := trie.lookup(ip2)
	if !ok2 || score2 != 30 {
		t.Fatalf("expected /16 match score=30, got score=%d ok=%v", score2, ok2)
	}
}

func TestIPTrieSingleIP(t *testing.T) {
	trie := newIPTrie()
	_, cidr32, _ := net.ParseCIDR("10.0.0.1/32")
	trie.insert(cidr32, 100)

	ip := net.ParseIP("10.0.0.1")
	score, ok := trie.lookup(ip)
	if !ok || score != 100 {
		t.Fatalf("expected /32 match score=100, got score=%d ok=%v", score, ok)
	}

	ip2 := net.ParseIP("10.0.0.2")
	_, ok2 := trie.lookup(ip2)
	if ok2 {
		t.Fatalf("expected no match for 10.0.0.2")
	}
}

func TestIPTrieIPv6(t *testing.T) {
	trie := newIPTrie()
	_, cidr, _ := net.ParseCIDR("2001:db8::/32")
	trie.insert(cidr, 60)

	ip := net.ParseIP("2001:db8::1")
	score, ok := trie.lookup(ip)
	if !ok || score != 60 {
		t.Fatalf("expected IPv6 match score=60, got score=%d ok=%v", score, ok)
	}

	ip2 := net.ParseIP("2001:db9::1")
	_, ok2 := trie.lookup(ip2)
	if ok2 {
		t.Fatalf("expected no match for 2001:db9::1")
	}
}

func TestIPTrieMultipleCIDRs(t *testing.T) {
	trie := newIPTrie()
	cidrs := []struct {
		cidr  string
		score int
	}{
		{"10.0.0.0/8", 10},
		{"10.1.0.0/16", 20},
		{"10.1.2.0/24", 30},
		{"172.16.0.0/12", 40},
		{"192.168.0.0/16", 50},
	}
	for _, c := range cidrs {
		_, cidr, _ := net.ParseCIDR(c.cidr)
		trie.insert(cidr, c.score)
	}

	if trie.size() != 5 {
		t.Fatalf("expected size=5, got %d", trie.size())
	}

	tests := []struct {
		ip    string
		score int
	}{
		{"10.1.2.5", 30},
		{"10.1.5.5", 20},
		{"10.5.5.5", 10},
		{"172.16.5.5", 40},
		{"192.168.1.1", 50},
		{"8.8.8.8", 0},
	}
	for _, tt := range tests {
		ip := net.ParseIP(tt.ip)
		score, ok := trie.lookup(ip)
		if tt.score == 0 {
			if ok {
				t.Errorf("IP %s: expected no match, got score=%d", tt.ip, score)
			}
		} else {
			if !ok || score != tt.score {
				t.Errorf("IP %s: expected score=%d, got score=%d ok=%v", tt.ip, tt.score, score, ok)
			}
		}
	}
}

func TestIPTrieEmpty(t *testing.T) {
	trie := newIPTrie()
	ip := net.ParseIP("1.2.3.4")
	_, ok := trie.lookup(ip)
	if ok {
		t.Fatalf("expected no match on empty trie")
	}
	if trie.size() != 0 {
		t.Fatalf("expected size=0, got %d", trie.size())
	}
}
