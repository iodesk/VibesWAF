package rules

import (
	"fmt"
)


type NodeType int

const (
	NodeCondition NodeType = iota
	NodeAnd
	NodeOr
	NodeNot
)


type Node struct {
	Type     NodeType
	Field    string
	Operator string
	Value    string
	Left     *Node
	Right    *Node
}


type Parser struct {
	tokens []Token
	pos    int
}


func NewParser(tokens []Token) *Parser {
	return &Parser{
		tokens: tokens,
		pos:    0,
	}
}


func (p *Parser) Parse() (*Node, error) {
	return p.parseExpression()
}


func (p *Parser) parseExpression() (*Node, error) {
	left, err := p.parseTerm()
	if err != nil {
		return nil, err
	}

	for p.current().Type == TokenOr {
		p.advance()
		right, err := p.parseTerm()
		if err != nil {
			return nil, err
		}
		left = &Node{
			Type:  NodeOr,
			Left:  left,
			Right: right,
		}
	}

	return left, nil
}


func (p *Parser) parseTerm() (*Node, error) {
	left, err := p.parseFactor()
	if err != nil {
		return nil, err
	}

	for p.current().Type == TokenAnd {
		p.advance()
		right, err := p.parseFactor()
		if err != nil {
			return nil, err
		}
		left = &Node{
			Type:  NodeAnd,
			Left:  left,
			Right: right,
		}
	}

	return left, nil
}


func (p *Parser) parseFactor() (*Node, error) {

	if p.current().Type == TokenNot {
		p.advance()
		node, err := p.parseFactor()
		if err != nil {
			return nil, err
		}
		return &Node{
			Type: NodeNot,
			Left: node,
		}, nil
	}


	if p.current().Type == TokenLParen {
		p.advance()
		node, err := p.parseExpression()
		if err != nil {
			return nil, err
		}
		if p.current().Type != TokenRParen {
			return nil, fmt.Errorf("expected ')' at position %d", p.current().Pos)
		}
		p.advance()
		return node, nil
	}


	return p.parseCondition()
}


func (p *Parser) parseCondition() (*Node, error) {

	if p.current().Type != TokenField {
		return nil, fmt.Errorf("expected field at position %d, got %v", p.current().Pos, p.current().Type)
	}
	field := p.current().Value
	p.advance()

	if p.current().Type != TokenOperator {
		return nil, fmt.Errorf("expected operator at position %d, got %v", p.current().Pos, p.current().Type)
	}
	operator := p.current().Value
	p.advance()


	if operator == "exists" || operator == "not_exists" {
		return &Node{
			Type:     NodeCondition,
			Field:    field,
			Operator: operator,
			Value:    "",
		}, nil
	}

	if p.current().Type != TokenValue {
		return nil, fmt.Errorf("expected value at position %d, got %v", p.current().Pos, p.current().Type)
	}
	value := p.current().Value
	p.advance()

	return &Node{
		Type:     NodeCondition,
		Field:    field,
		Operator: operator,
		Value:    value,
	}, nil
}



func (p *Parser) current() Token {
	if p.pos >= len(p.tokens) {
		return Token{Type: TokenEOF}
	}
	return p.tokens[p.pos]
}

func (p *Parser) advance() {
	if p.pos < len(p.tokens) {
		p.pos++
	}
}


func (n *Node) String() string {
	if n == nil {
		return "nil"
	}

	switch n.Type {
	case NodeCondition:
		return fmt.Sprintf("(%s %s %s)", n.Field, n.Operator, n.Value)
	case NodeAnd:
		return fmt.Sprintf("(AND %s %s)", n.Left.String(), n.Right.String())
	case NodeOr:
		return fmt.Sprintf("(OR %s %s)", n.Left.String(), n.Right.String())
	case NodeNot:
		return fmt.Sprintf("(NOT %s)", n.Left.String())
	default:
		return "unknown"
	}
}
