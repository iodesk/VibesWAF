package rules

import (
	"fmt"
	"regexp"
	"strings"
)


type Validator struct {
	fields    map[string]FieldDef
	operators map[string]OperatorDef
}


func NewValidator() *Validator {
	return &Validator{
		fields:    FieldRegistry,
		operators: OperatorRegistry,
	}
}


func (v *Validator) Validate(node *Node) error {
	if node == nil {
		return fmt.Errorf("node is nil")
	}

	switch node.Type {
	case NodeCondition:
		return v.validateCondition(node)
	case NodeAnd, NodeOr:
		if err := v.Validate(node.Left); err != nil {
			return err
		}
		return v.Validate(node.Right)
	case NodeNot:
		return v.Validate(node.Left)
	default:
		return fmt.Errorf("unknown node type: %v", node.Type)
	}
}


func (v *Validator) validateCondition(node *Node) error {

	fieldDef, exists := v.fields[node.Field]
	if !exists {
		return fmt.Errorf("unknown field: %s", node.Field)
	}


	opDef, exists := v.operators[node.Operator]
	if !exists {
		return fmt.Errorf("unknown operator: %s", node.Operator)
	}


	if !v.isOperatorAllowed(fieldDef, node.Operator) {
		return fmt.Errorf("operator '%s' not allowed for field '%s' (type: %v)", 
			node.Operator, node.Field, fieldDef.Type)
	}


	if !v.isOperatorValidForType(opDef, fieldDef.Type) {
		return fmt.Errorf("operator '%s' not valid for field type %v", 
			node.Operator, fieldDef.Type)
	}


	if err := v.validateValue(node, fieldDef); err != nil {
		return err
	}


	if node.Operator == "regex" || node.Operator == "not_regex" {
		if err := v.validateRegex(node.Value); err != nil {
			return fmt.Errorf("invalid regex pattern: %w", err)
		}
	}

	return nil
}


func (v *Validator) isOperatorAllowed(fieldDef FieldDef, operator string) bool {
	for _, allowed := range fieldDef.AllowedOps {
		if allowed == operator {
			return true
		}
	}
	return false
}


func (v *Validator) isOperatorValidForType(opDef OperatorDef, fieldType FieldType) bool {
	for _, validType := range opDef.ValidTypes {
		if validType == fieldType {
			return true
		}
	}
	return false
}


func (v *Validator) validateValue(node *Node, fieldDef FieldDef) error {

	if node.Operator == "exists" || node.Operator == "not_exists" {
		return nil
	}


	if node.Value == "" && fieldDef.Type == FieldTypeString {
		return nil
	}

	if node.Value == "" {
		return fmt.Errorf("value is required for operator '%s'", node.Operator)
	}

	switch fieldDef.Type {
	case FieldTypeInt:

		if strings.HasPrefix(node.Value, "[") {

			return v.validateIntArray(node.Value)
		}

		if !isNumeric(node.Value) {
			return fmt.Errorf("value must be numeric for field '%s'", node.Field)
		}

	case FieldTypeBool:

		if node.Value != "true" && node.Value != "false" {
			return fmt.Errorf("value must be 'true' or 'false' for field '%s'", node.Field)
		}

	case FieldTypeIP:

		if strings.HasPrefix(node.Value, "[") {
			return v.validateIPArray(node.Value)
		}

		if !isValidIP(node.Value) {
			return fmt.Errorf("value must be valid IP address for field '%s'", node.Field)
		}

	case FieldTypeString:


		if (node.Operator == "in" || node.Operator == "not_in") && strings.HasPrefix(node.Value, "[") {
			return v.validateStringArray(node.Value)
		}
	}

	return nil
}


func (v *Validator) validateRegex(pattern string) error {

	if len(pattern) > 500 {
		return fmt.Errorf("regex pattern too long (max 500 characters)")
	}


	dangerousPatterns := []string{
		`(a+)+`,
		`(a*)*`,
		`(a|a)*`,
		`(a|ab)*`,
		`([a-zA-Z]+)*`,
	}

	for _, dangerous := range dangerousPatterns {
		if strings.Contains(pattern, dangerous) {
			return fmt.Errorf("regex pattern may cause ReDoS attack")
		}
	}


	_, err := regexp.Compile(pattern)
	if err != nil {
		return fmt.Errorf("invalid regex syntax: %w", err)
	}

	return nil
}


func (v *Validator) validateIntArray(value string) error {

	value = strings.Trim(value, "[]")
	parts := strings.Split(value, ",")

	for _, part := range parts {
		part = strings.TrimSpace(part)
		part = strings.Trim(part, "\"")
		if !isNumeric(part) {
			return fmt.Errorf("invalid integer in array: %s", part)
		}
	}

	return nil
}


func (v *Validator) validateIPArray(value string) error {

	value = strings.Trim(value, "[]")
	parts := strings.Split(value, ",")

	for _, part := range parts {
		part = strings.TrimSpace(part)
		part = strings.Trim(part, "\"")
		if !isValidIP(part) {
			return fmt.Errorf("invalid IP address in array: %s", part)
		}
	}

	return nil
}


func (v *Validator) validateStringArray(value string) error {

	if !strings.HasPrefix(value, "[") || !strings.HasSuffix(value, "]") {
		return fmt.Errorf("invalid array format")
	}
	return nil
}



func isNumeric(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return len(s) > 0
}

func isValidIP(s string) bool {

	parts := strings.Split(s, ".")
	if len(parts) != 4 {
		return false
	}

	for _, part := range parts {
		if !isNumeric(part) {
			return false
		}

		num := 0
		for _, c := range part {
			num = num*10 + int(c-'0')
		}
		if num > 255 {
			return false
		}
	}

	return true
}
