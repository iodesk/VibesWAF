package rule

import (
	"fmt"
	"regexp"
	"strings"
	"sync"
)



type RequestContext interface {
	GetClientIP() string
	GetHost() string
	GetPath() string
	GetQuery() string
	GetMethod() string
	GetUserAgent() string
	GetHeader(key string) string
	GetScheme() string
	GetProto() string
	IsTLS() bool
	GetMetadata() map[string]interface{}
}


type Evaluator struct {
	regexCache   map[string]*regexp.Regexp
	regexCacheMu sync.RWMutex
}


func NewEvaluator() *Evaluator {
	return &Evaluator{
		regexCache: make(map[string]*regexp.Regexp),
	}
}


func (e *Evaluator) Evaluate(node *Node, ctx RequestContext) (bool, error) {
	if node == nil {
		return false, fmt.Errorf("node is nil")
	}

	switch node.Type {
	case NodeComparison:
		return e.evaluateComparison(node, ctx)

	case NodeLogical:
		return e.evaluateLogical(node, ctx)

	default:
		return false, fmt.Errorf("unknown node type: %v", node.Type)
	}
}


func (e *Evaluator) evaluateLogical(node *Node, ctx RequestContext) (bool, error) {
	switch strings.ToUpper(node.Operator) {
	case "AND":
		left, err := e.Evaluate(node.Left, ctx)
		if err != nil {
			return false, err
		}
		if !left {
			return false, nil
		}
		return e.Evaluate(node.Right, ctx)

	case "OR":
		left, err := e.Evaluate(node.Left, ctx)
		if err != nil {
			return false, err
		}
		if left {
			return true, nil
		}
		return e.Evaluate(node.Right, ctx)

	case "NOT":
		result, err := e.Evaluate(node.Left, ctx)
		return !result, err

	default:
		return false, fmt.Errorf("unknown logical operator: %s", node.Operator)
	}
}


func (e *Evaluator) evaluateComparison(node *Node, ctx RequestContext) (bool, error) {

	fieldValue := e.extractField(node.Field, ctx)


	switch node.Operator {
	case "eq":
		return e.evalEquals(fieldValue, node.Value), nil
	case "neq":
		return !e.evalEquals(fieldValue, node.Value), nil
	case "in":
		return e.evalIn(fieldValue, node.Value), nil
	case "not_in":
		return !e.evalIn(fieldValue, node.Value), nil
	case "contains":
		return e.evalContains(fieldValue, node.Value), nil
	case "not_contains":
		return !e.evalContains(fieldValue, node.Value), nil
	case "prefix":
		return e.evalPrefix(fieldValue, node.Value), nil
	case "suffix":
		return e.evalSuffix(fieldValue, node.Value), nil
	case "regex":
		return e.evalRegex(fieldValue, node.Value)
	case "not_regex":
		result, err := e.evalRegex(fieldValue, node.Value)
		return !result, err
	case "gt":
		return e.evalGreaterThan(fieldValue, node.Value), nil
	case "lt":
		return e.evalLessThan(fieldValue, node.Value), nil
	case "gte":
		return e.evalGreaterOrEqual(fieldValue, node.Value), nil
	case "lte":
		return e.evalLessOrEqual(fieldValue, node.Value), nil
	case "exists":
		return e.evalExists(fieldValue), nil
	case "not_exists":
		return !e.evalExists(fieldValue), nil
	default:
		return false, fmt.Errorf("unknown operator: %s", node.Operator)
	}
}


func (e *Evaluator) extractField(field string, ctx RequestContext) interface{} {
	switch field {
	case "ip.src":
		return ctx.GetClientIP()
	case "ip.is_datacenter":
		metadata := ctx.GetMetadata()
		if metadata != nil {
			if isDatacenter, ok := metadata["is_datacenter"].(bool); ok {
				return isDatacenter
			}
		}
		return false
	case "asn":
		metadata := ctx.GetMetadata()
		if metadata != nil {
			if asn, ok := metadata["asn"].(uint32); ok {
				return int(asn)
			}
			if asn, ok := metadata["asn"].(uint); ok {
				return int(asn)
			}
		}
		return 0
	case "country":
		metadata := ctx.GetMetadata()
		if metadata != nil {
			if country, ok := metadata["country"].(string); ok {
				return strings.ToUpper(country)
			}
		}
		return ""
	case "http.host":
		return ctx.GetHost()
	case "http.path":
		return ctx.GetPath()
	case "http.query":
		return ctx.GetQuery()
	case "http.method":
		return ctx.GetMethod()
	case "http.ua":
		return ctx.GetUserAgent()
	case "http.scheme":
		return ctx.GetScheme()
	case "http.version":
		return ctx.GetProto()
	case "http.cookie":
		return ctx.GetHeader("Cookie")
	case "http.referer":
		return ctx.GetHeader("Referer")
	case "http.accept":
		return ctx.GetHeader("Accept")
	case "client.is_mobile", "device.is_mobile":
		return isMobileUA(ctx.GetUserAgent())
	case "client.is_desktop", "device.is_desktop":
		return !isMobileUA(ctx.GetUserAgent()) && !isTabletUA(ctx.GetUserAgent())
	case "client.is_tablet", "device.is_tablet":
		return isTabletUA(ctx.GetUserAgent())
	default:
		return ""
	}
}



func (e *Evaluator) evalEquals(fieldValue, ruleValue interface{}) bool {
	return toString(fieldValue) == toString(ruleValue)
}

func (e *Evaluator) evalIn(fieldValue, ruleValue interface{}) bool {
	fv := toString(fieldValue)
	

	if values, ok := ruleValue.([]interface{}); ok {
		for _, v := range values {
			if fv == toString(v) {
				return true
			}
		}
		return false
	}
	

	rv := toString(ruleValue)
	values := strings.Split(rv, ",")
	for _, v := range values {
		if fv == strings.TrimSpace(v) {
			return true
		}
	}
	return false
}

func (e *Evaluator) evalContains(fieldValue, ruleValue interface{}) bool {
	fv := toString(fieldValue)
	rv := toString(ruleValue)

	return strings.Contains(strings.ToLower(fv), strings.ToLower(rv))
}

func (e *Evaluator) evalPrefix(fieldValue, ruleValue interface{}) bool {
	fv := toString(fieldValue)
	rv := toString(ruleValue)
	return strings.HasPrefix(fv, rv)
}

func (e *Evaluator) evalSuffix(fieldValue, ruleValue interface{}) bool {
	fv := toString(fieldValue)
	rv := toString(ruleValue)
	return strings.HasSuffix(fv, rv)
}

func (e *Evaluator) evalRegex(fieldValue, ruleValue interface{}) (bool, error) {
	fv := toString(fieldValue)
	pattern := toString(ruleValue)


	e.regexCacheMu.RLock()
	re, cached := e.regexCache[pattern]
	e.regexCacheMu.RUnlock()

	if !cached {
		var err error
		re, err = regexp.Compile(pattern)
		if err != nil {
			return false, fmt.Errorf("invalid regex: %w", err)
		}

		e.regexCacheMu.Lock()
		e.regexCache[pattern] = re
		e.regexCacheMu.Unlock()
	}

	return re.MatchString(fv), nil
}

func (e *Evaluator) evalGreaterThan(fieldValue, ruleValue interface{}) bool {
	fv := toInt(fieldValue)
	rv := toInt(ruleValue)
	return fv > rv
}

func (e *Evaluator) evalLessThan(fieldValue, ruleValue interface{}) bool {
	fv := toInt(fieldValue)
	rv := toInt(ruleValue)
	return fv < rv
}

func (e *Evaluator) evalGreaterOrEqual(fieldValue, ruleValue interface{}) bool {
	fv := toInt(fieldValue)
	rv := toInt(ruleValue)
	return fv >= rv
}

func (e *Evaluator) evalLessOrEqual(fieldValue, ruleValue interface{}) bool {
	fv := toInt(fieldValue)
	rv := toInt(ruleValue)
	return fv <= rv
}

func (e *Evaluator) evalExists(fieldValue interface{}) bool {
	fv := toString(fieldValue)
	return fv != ""
}



func toString(v interface{}) string {
	switch val := v.(type) {
	case string:
		return val
	case int:
		return fmt.Sprintf("%d", val)
	case bool:
		if val {
			return "true"
		}
		return "false"
	default:
		return ""
	}
}

func toInt(v interface{}) int {
	switch val := v.(type) {
	case int:
		return val
	case string:
		num := 0
		for _, c := range val {
			if c >= '0' && c <= '9' {
				num = num*10 + int(c-'0')
			}
		}
		return num
	default:
		return 0
	}
}

func isMobileUA(ua string) bool {
	ua = strings.ToLower(ua)
	for _, kw := range []string{"mobile", "android", "iphone", "ipod", "blackberry", "windows phone", "opera mini"} {
		if strings.Contains(ua, kw) && !strings.Contains(ua, "ipad") && !strings.Contains(ua, "tablet") {
			return true
		}
	}
	return false
}

func isTabletUA(ua string) bool {
	ua = strings.ToLower(ua)
	for _, kw := range []string{"ipad", "tablet", "kindle"} {
		if strings.Contains(ua, kw) {
			return true
		}
	}
	return false
}
