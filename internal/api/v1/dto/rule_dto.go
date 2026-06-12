package dto


type RuleCreateRequest struct {
	Name          string   `json:"name"`
	Scope         string   `json:"scope"`
	AppID         string   `json:"app_id"`
	RuleGroup     string   `json:"rule_group"`
	ExpressionRaw string   `json:"expression_raw"`
	Action        string   `json:"action"`
	SkipModules   []string `json:"skip_modules"`
	Priority      int      `json:"priority"`
	Enabled       bool     `json:"enabled"`
	Description   string   `json:"description"`
}


type RuleUpdateRequest struct {
	Name          string   `json:"name"`
	Scope         string   `json:"scope"`
	AppID         string   `json:"app_id"`
	RuleGroup     string   `json:"rule_group"`
	ExpressionRaw string   `json:"expression_raw"`
	Action        string   `json:"action"`
	SkipModules   []string `json:"skip_modules"`
	Priority      int      `json:"priority"`
	Enabled       bool     `json:"enabled"`
	Description   string   `json:"description"`
}


type RuleResponse struct {
	ID                  int         `json:"id"`
	AppID               string      `json:"app_id,omitempty"`
	Name                string      `json:"name"`
	Scope               string      `json:"scope"`
	RuleGroup           string      `json:"rule_group"`
	ExpressionRaw       string      `json:"expression_raw"`
	ExpressionStructure interface{} `json:"expression_structure,omitempty"`
	Action              string      `json:"action"`
	SkipModules         []string    `json:"skip_modules,omitempty"`
	Priority            int         `json:"priority"`
	Enabled             bool        `json:"enabled"`
	Description         string      `json:"description"`
}


type ValidateExpressionRequest struct {
	Expression string `json:"expression"`
}


type ValidateExpressionResponse struct {
	Valid bool   `json:"valid"`
	Error string `json:"error,omitempty"`
}


type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}


type SuccessResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}


type RuleReorderRequest struct {
	RuleIDs []int `json:"rule_ids"`
}


type FieldMetadata struct {
	Name             string             `json:"name"`
	Type             string             `json:"type"`
	AllowedOperators []OperatorMetadata `json:"allowed_operators"`
	Description      string             `json:"description"`
}


type OperatorMetadata struct {
	Value       string `json:"value"`
	Label       string `json:"label"`
	Symbol      string `json:"symbol"`
	Description string `json:"description,omitempty"`
}


type FieldMetadataResponse struct {
	Fields []FieldMetadata `json:"fields"`
}
