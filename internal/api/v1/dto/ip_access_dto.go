package dto


type IPAccessRuleResponse struct {
	ID          int    `json:"id"`
	AppID       string `json:"app_id"`
	IPRange     string `json:"ip_range"`
	Description string `json:"description"`
	Action      string `json:"action"`
	Enabled     bool   `json:"enabled"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}


type IPAccessRuleCreateRequest struct {
	IPRange     string `json:"ip_range" validate:"required"`
	Description string `json:"description"`
	Action      string `json:"action" validate:"required,oneof=allow block challenge"`
	Enabled     bool   `json:"enabled"`
}


type IPAccessRuleUpdateRequest struct {
	IPRange     string `json:"ip_range"`
	Description string `json:"description"`
	Action      string `json:"action" validate:"omitempty,oneof=allow block challenge"`
	Enabled     *bool  `json:"enabled"`
}


type IPAccessRulesListResponse struct {
	Rules []*IPAccessRuleResponse `json:"rules"`
}
