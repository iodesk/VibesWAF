package rule


type TokenType int

const (
	TokenEOF TokenType = iota
	TokenIdentifier
	TokenString
	TokenNumber
	TokenOperator
	TokenLogical
	TokenLeftParen
	TokenRightParen
	TokenComma
	TokenLeftBracket
	TokenRightBracket
)


type Token struct {
	Type  TokenType
	Value string
}


type NodeType string

const (
	NodeComparison NodeType = "comparison"
	NodeLogical    NodeType = "logical"
	NodeFunction   NodeType = "function"
	NodeField      NodeType = "field"
	NodeLiteral    NodeType = "literal"
	NodeList       NodeType = "list"
)


type Node struct {
	Type     NodeType    `json:"type"`
	Operator string      `json:"operator,omitempty"`
	Field    string      `json:"field,omitempty"`
	Value    interface{} `json:"value,omitempty"`
	Left     *Node       `json:"left,omitempty"`
	Right    *Node       `json:"right,omitempty"`
	Args     []*Node     `json:"args,omitempty"`
	Function string      `json:"function,omitempty"`
}


type CompiledRule struct {
	ID            int
	AppID         string
	Name          string
	Scope         string
	RuleGroup     string
	ExpressionRaw string
	AST           *Node
	Action        string
	SkipModules   []string
	Priority      int
	Enabled       bool
	Description   string
}
