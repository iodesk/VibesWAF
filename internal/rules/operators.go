package rules

import (
	"regexp"
	"strings"
)

type OperatorDef struct {
	Name       string
	Symbol     string
	ValidTypes []FieldType
	Evaluator  func(fieldValue, ruleValue interface{}) (bool, error)
}

var OperatorRegistry = map[string]OperatorDef{
	"eq": {
		Name:       "equals",
		Symbol:     "eq",
		ValidTypes: []FieldType{FieldTypeString, FieldTypeInt, FieldTypeBool, FieldTypeIP},
		Evaluator:  evalEquals,
	},
	"neq": {
		Name:       "not equals",
		Symbol:     "neq",
		ValidTypes: []FieldType{FieldTypeString, FieldTypeInt, FieldTypeBool, FieldTypeIP},
		Evaluator:  evalNotEquals,
	},
	"in": {
		Name:       "in",
		Symbol:     "in",
		ValidTypes: []FieldType{FieldTypeString, FieldTypeInt, FieldTypeIP},
		Evaluator:  evalIn,
	},
	"not_in": {
		Name:       "not in",
		Symbol:     "not_in",
		ValidTypes: []FieldType{FieldTypeString, FieldTypeInt, FieldTypeIP},
		Evaluator:  evalNotIn,
	},
	"contains": {
		Name:       "contains",
		Symbol:     "contains",
		ValidTypes: []FieldType{FieldTypeString},
		Evaluator:  evalContains,
	},
	"not_contains": {
		Name:       "does not contain",
		Symbol:     "not_contains",
		ValidTypes: []FieldType{FieldTypeString},
		Evaluator:  evalNotContains,
	},
	"prefix": {
		Name:       "starts with",
		Symbol:     "prefix",
		ValidTypes: []FieldType{FieldTypeString},
		Evaluator:  evalPrefix,
	},
	"suffix": {
		Name:       "ends with",
		Symbol:     "suffix",
		ValidTypes: []FieldType{FieldTypeString},
		Evaluator:  evalSuffix,
	},
	"regex": {
		Name:       "match regex",
		Symbol:     "regex",
		ValidTypes: []FieldType{FieldTypeString},
		Evaluator:  evalRegex,
	},
	"not_regex": {
		Name:       "not match regex",
		Symbol:     "not_regex",
		ValidTypes: []FieldType{FieldTypeString},
		Evaluator:  evalNotRegex,
	},
	"gt": {
		Name:       "greater than",
		Symbol:     "gt",
		ValidTypes: []FieldType{FieldTypeInt},
		Evaluator:  evalGreaterThan,
	},
	"lt": {
		Name:       "less than",
		Symbol:     "lt",
		ValidTypes: []FieldType{FieldTypeInt},
		Evaluator:  evalLessThan,
	},
	"gte": {
		Name:       "greater or equal",
		Symbol:     "gte",
		ValidTypes: []FieldType{FieldTypeInt},
		Evaluator:  evalGreaterOrEqual,
	},
	"lte": {
		Name:       "less or equal",
		Symbol:     "lte",
		ValidTypes: []FieldType{FieldTypeInt},
		Evaluator:  evalLessOrEqual,
	},
	"exists": {
		Name:       "exists",
		Symbol:     "exists",
		ValidTypes: []FieldType{FieldTypeString},
		Evaluator:  evalExists,
	},
	"not_exists": {
		Name:       "not exists",
		Symbol:     "not_exists",
		ValidTypes: []FieldType{FieldTypeString},
		Evaluator:  evalNotExists,
	},
}

func evalEquals(fieldValue, ruleValue interface{}) (bool, error) {
	// Handle boolean comparisons
	if fv, ok := fieldValue.(bool); ok {
		rv := toBool(ruleValue)
		return fv == rv, nil
	}

	// Handle integer comparisons
	if fv, ok := fieldValue.(int); ok {
		rv := toInt(ruleValue)
		return fv == rv, nil
	}

	// Handle string comparisons (default)
	fv := toString(fieldValue)
	rv := toString(ruleValue)
	return fv == rv, nil
}

func evalNotEquals(fieldValue, ruleValue interface{}) (bool, error) {
	return fieldValue != ruleValue, nil
}

func evalIn(fieldValue, ruleValue interface{}) (bool, error) {

	switch rv := ruleValue.(type) {
	case []string:
		fv := toString(fieldValue)
		for _, v := range rv {
			if fv == v {
				return true, nil
			}
		}
	case string:

		values := strings.Split(rv, ",")
		fv := toString(fieldValue)
		for _, v := range values {
			if fv == strings.TrimSpace(v) {
				return true, nil
			}
		}
	}
	return false, nil
}

func evalNotIn(fieldValue, ruleValue interface{}) (bool, error) {
	result, err := evalIn(fieldValue, ruleValue)
	return !result, err
}

func evalContains(fieldValue, ruleValue interface{}) (bool, error) {
	fv := toString(fieldValue)
	rv := toString(ruleValue)
	return strings.Contains(fv, rv), nil
}

func evalNotContains(fieldValue, ruleValue interface{}) (bool, error) {
	result, err := evalContains(fieldValue, ruleValue)
	return !result, err
}

func evalPrefix(fieldValue, ruleValue interface{}) (bool, error) {
	fv := toString(fieldValue)
	rv := toString(ruleValue)
	return strings.HasPrefix(fv, rv), nil
}

func evalSuffix(fieldValue, ruleValue interface{}) (bool, error) {
	fv := toString(fieldValue)
	rv := toString(ruleValue)
	return strings.HasSuffix(fv, rv), nil
}

func evalRegex(fieldValue, ruleValue interface{}) (bool, error) {
	fv := toString(fieldValue)
	rv := toString(ruleValue)

	re, err := regexp.Compile(rv)
	if err != nil {
		return false, err
	}

	return re.MatchString(fv), nil
}

func evalNotRegex(fieldValue, ruleValue interface{}) (bool, error) {
	result, err := evalRegex(fieldValue, ruleValue)
	return !result, err
}

func evalGreaterThan(fieldValue, ruleValue interface{}) (bool, error) {
	fv := toInt(fieldValue)
	rv := toInt(ruleValue)
	return fv > rv, nil
}

func evalLessThan(fieldValue, ruleValue interface{}) (bool, error) {
	fv := toInt(fieldValue)
	rv := toInt(ruleValue)
	return fv < rv, nil
}

func evalGreaterOrEqual(fieldValue, ruleValue interface{}) (bool, error) {
	fv := toInt(fieldValue)
	rv := toInt(ruleValue)
	return fv >= rv, nil
}

func evalLessOrEqual(fieldValue, ruleValue interface{}) (bool, error) {
	fv := toInt(fieldValue)
	rv := toInt(ruleValue)
	return fv <= rv, nil
}

func evalExists(fieldValue, ruleValue interface{}) (bool, error) {
	fv := toString(fieldValue)
	return fv != "", nil
}

func evalNotExists(fieldValue, ruleValue interface{}) (bool, error) {
	result, err := evalExists(fieldValue, ruleValue)
	return !result, err
}

func toBool(v interface{}) bool {
	switch val := v.(type) {
	case bool:
		return val
	case string:
		return val == "true" || val == "1"
	case int:
		return val != 0
	default:
		return false
	}
}
