package rule

import (
	"fmt"
	"strings"
)


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

	for p.current().Type == TokenLogical && strings.ToUpper(p.current().Value) == "OR" {
		p.advance()
		right, err := p.parseTerm()
		if err != nil {
			return nil, err
		}
		left = &Node{
			Type:     NodeLogical,
			Operator: "OR",
			Left:     left,
			Right:    right,
		}
	}

	return left, nil
}


func (p *Parser) parseTerm() (*Node, error) {
	left, err := p.parseFactor()
	if err != nil {
		return nil, err
	}

	for p.current().Type == TokenLogical && strings.ToUpper(p.current().Value) == "AND" {
		p.advance()
		right, err := p.parseFactor()
		if err != nil {
			return nil, err
		}
		left = &Node{
			Type:     NodeLogical,
			Operator: "AND",
			Left:     left,
			Right:    right,
		}
	}

	return left, nil
}


func (p *Parser) parseFactor() (*Node, error) {

	if p.current().Type == TokenLogical && strings.ToUpper(p.current().Value) == "NOT" {
		p.advance()
		node, err := p.parseFactor()
		if err != nil {
			return nil, err
		}
		return &Node{
			Type:     NodeLogical,
			Operator: "NOT",
			Left:     node,
		}, nil
	}


	if p.current().Type == TokenLeftParen {
		p.advance()
		node, err := p.parseExpression()
		if err != nil {
			return nil, err
		}
		if p.current().Type != TokenRightParen {
			return nil, fmt.Errorf("expected ')' but got %v", p.current().Type)
		}
		p.advance()
		return node, nil
	}


	return p.parseCondition()
}


func (p *Parser) parseCondition() (*Node, error) {

	if p.current().Type != TokenIdentifier {
		return nil, fmt.Errorf("expected field, got %v", p.current().Type)
	}
	field := p.current().Value
	p.advance()

	if p.current().Type != TokenOperator {
		return nil, fmt.Errorf("expected operator, got %v", p.current().Type)
	}
	operator := p.current().Value
	p.advance()


	if operator == "exists" || operator == "not_exists" {
		return &Node{
			Type:     NodeComparison,
			Field:    field,
			Operator: operator,
			Value:    nil,
		}, nil
	}


	if operator == "in" || operator == "not_in" {
		if p.current().Type == TokenLeftBracket {
			values, err := p.parseList()
			if err != nil {
				return nil, err
			}
			return &Node{
				Type:     NodeComparison,
				Field:    field,
				Operator: operator,
				Value:    values,
			}, nil
		}
	}


	var value interface{}
	switch p.current().Type {
	case TokenString:
		value = p.current().Value
	case TokenNumber:
		value = p.current().Value
	default:
		return nil, fmt.Errorf("expected value, got %v", p.current().Type)
	}
	p.advance()

	return &Node{
		Type:     NodeComparison,
		Field:    field,
		Operator: operator,
		Value:    value,
	}, nil
}


func (p *Parser) parseList() ([]interface{}, error) {
	if p.current().Type != TokenLeftBracket {
		return nil, fmt.Errorf("expected '[', got %v", p.current().Type)
	}
	p.advance()

	values := make([]interface{}, 0)

	for p.current().Type != TokenRightBracket {
		if p.current().Type == TokenEOF {
			return nil, fmt.Errorf("unexpected EOF while parsing list")
		}

		var value interface{}
		switch p.current().Type {
		case TokenString:
			value = p.current().Value
		case TokenNumber:
			value = p.current().Value
		default:
			return nil, fmt.Errorf("expected value in list, got %v", p.current().Type)
		}
		values = append(values, value)
		p.advance()


		if p.current().Type == TokenComma {
			p.advance()
		} else if p.current().Type != TokenRightBracket {
			return nil, fmt.Errorf("expected ',' or ']', got %v", p.current().Type)
		}
	}

	if p.current().Type != TokenRightBracket {
		return nil, fmt.Errorf("expected ']', got %v", p.current().Type)
	}
	p.advance()

	return values, nil
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
