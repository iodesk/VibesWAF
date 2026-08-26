package service

import "net"

type trieNode struct {
	children [2]*trieNode
	score    int
	hasScore bool
}

type ipTrie struct {
	root *trieNode
}

func newIPTrie() *ipTrie {
	return &ipTrie{root: &trieNode{}}
}

func (t *ipTrie) insert(cidr *net.IPNet, score int) {
	ip := cidr.IP.To4()
	if ip == nil {
		ip = cidr.IP.To16()
	}
	if ip == nil {
		return
	}

ones, _ := cidr.Mask.Size()
	node := t.root
	for i := 0; i < ones; i++ {
		byteIdx := i / 8
		bitIdx := 7 - (i % 8)
		bit := int((ip[byteIdx] >> uint(bitIdx)) & 1)

		if node.children[bit] == nil {
			node.children[bit] = &trieNode{}
		}
		node = node.children[bit]
	}

	node.score = score
	node.hasScore = true
}

func (t *ipTrie) lookup(ip net.IP) (int, bool) {
	ip4 := ip.To4()
	if ip4 != nil {
		return t.lookupBits(ip4, 32)
	}
	ip16 := ip.To16()
	if ip16 != nil {
		return t.lookupBits(ip16, 128)
	}
	return 0, false
}

func (t *ipTrie) lookupBits(ip []byte, maxBits int) (int, bool) {
	node := t.root
	bestScore := 0
	found := false

	for i := 0; i < maxBits; i++ {
		byteIdx := i / 8
		bitIdx := 7 - (i % 8)
		bit := int((ip[byteIdx] >> uint(bitIdx)) & 1)

		child := node.children[bit]
		if child == nil {
			break
		}
		node = child
		if node.hasScore {
			bestScore = node.score
			found = true
		}
	}

	return bestScore, found
}

func (t *ipTrie) size() int {
	count := 0
	var walk func(n *trieNode)
	walk = func(n *trieNode) {
		if n == nil {
			return
		}
		if n.hasScore {
			count++
		}
		walk(n.children[0])
		walk(n.children[1])
	}
	walk(t.root)
	return count
}
