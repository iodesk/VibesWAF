package rule

import (
	"fmt"
	"strings"
	"unicode"
)


type Lexer struct {
	input  string
	pos    int
	tokens []Token
}


func NewLexer(input string) *Lexer {
	return &Lexer{
		input:  input,
		pos:    0,
		tokens: make([]Token, 0),
	}
}


func (l *Lexer) Tokenize() ([]Token, error) {
	for l.pos < len(l.input) {
		l.skipWhitespace()

		if l.pos >= len(l.input) {
			break
		}

		ch := l.input[l.pos]

		switch {
		case ch == '(':
			l.tokens = append(l.tokens, Token{Type: TokenLeftParen, Value: "("})
			l.pos++

		case ch == ')':
			l.tokens = append(l.tokens, Token{Type: TokenRightParen, Value: ")"})
			l.pos++

		case ch == ',':
			l.tokens = append(l.tokens, Token{Type: TokenComma, Value: ","})
			l.pos++

		case ch == '[':
			l.tokens = append(l.tokens, Token{Type: TokenLeftBracket, Value: "["})
			l.pos++

		case ch == ']':
			l.tokens = append(l.tokens, Token{Type: TokenRightBracket, Value: "]"})
			l.pos++

		case ch == '"':

			value, err := l.readString()
			if err != nil {
				return nil, err
			}
			l.tokens = append(l.tokens, Token{Type: TokenString, Value: value})

		case unicode.IsLetter(rune(ch)) || ch == '.':

			word := l.readWord()

			switch strings.ToUpper(word) {
			case "AND":
				l.tokens = append(l.tokens, Token{Type: TokenLogical, Value: "AND"})
			case "OR":
				l.tokens = append(l.tokens, Token{Type: TokenLogical, Value: "OR"})
			case "NOT":
				l.tokens = append(l.tokens, Token{Type: TokenLogical, Value: "NOT"})
			case "TRUE", "FALSE":

				l.tokens = append(l.tokens, Token{Type: TokenString, Value: strings.ToLower(word)})
			default:

				if l.isOperator(word) {
					l.tokens = append(l.tokens, Token{Type: TokenOperator, Value: word})
				} else {
					l.tokens = append(l.tokens, Token{Type: TokenIdentifier, Value: word})
				}
			}

		case unicode.IsDigit(rune(ch)):

			value := l.readNumber()

			if value == "1" {
				l.tokens = append(l.tokens, Token{Type: TokenString, Value: "true"})
			} else if value == "0" {
				l.tokens = append(l.tokens, Token{Type: TokenString, Value: "false"})
			} else {
				l.tokens = append(l.tokens, Token{Type: TokenNumber, Value: value})
			}

		default:
			return nil, fmt.Errorf("unexpected character '%c' at position %d", ch, l.pos)
		}
	}

	l.tokens = append(l.tokens, Token{Type: TokenEOF, Value: ""})
	return l.tokens, nil
}

func (l *Lexer) skipWhitespace() {
	for l.pos < len(l.input) && unicode.IsSpace(rune(l.input[l.pos])) {
		l.pos++
	}
}

func (l *Lexer) readWord() string {
	start := l.pos
	for l.pos < len(l.input) {
		ch := rune(l.input[l.pos])
		if unicode.IsLetter(ch) || unicode.IsDigit(ch) || ch == '.' || ch == '_' {
			l.pos++
		} else {
			break
		}
	}
	return l.input[start:l.pos]
}

func (l *Lexer) readString() (string, error) {
	l.pos++
	start := l.pos

	for l.pos < len(l.input) {
		if l.input[l.pos] == '"' {
			value := l.input[start:l.pos]
			l.pos++
			return value, nil
		}
		if l.input[l.pos] == '\\' && l.pos+1 < len(l.input) {
			l.pos += 2
		} else {
			l.pos++
		}
	}

	return "", fmt.Errorf("unterminated string at position %d", start)
}

func (l *Lexer) readNumber() string {
	start := l.pos
	for l.pos < len(l.input) && unicode.IsDigit(rune(l.input[l.pos])) {
		l.pos++
	}
	return l.input[start:l.pos]
}

func (l *Lexer) isOperator(word string) bool {
	operators := []string{
		"eq", "neq", "in", "not_in",
		"contains", "not_contains",
		"prefix", "suffix",
		"regex", "not_regex",
		"gt", "lt", "gte", "lte",
		"exists", "not_exists",
	}

	for _, op := range operators {
		if word == op {
			return true
		}
	}
	return false
}
