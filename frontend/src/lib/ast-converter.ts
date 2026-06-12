/**
 * AST Converter
 * Converts backend AST structure to frontend ConditionGroup format for Visual Builder
 */

import type { ConditionGroup, Condition } from '@/components/rules/ExpressionBuilder'

// Backend AST Node types
interface ASTNode {
  type: string // "logical" or "comparison"
  operator?: string
  field?: string
  value?: any
  left?: ASTNode
  right?: ASTNode
}

/**
 * Convert backend AST to frontend ConditionGroup
 */
export function astToConditionGroup(ast: ASTNode | null | undefined): ConditionGroup {
  if (!ast) {
    return {
      id: 'root',
      conditions: [],
    }
  }

  const conditions: Condition[] = []
  
  // Parse AST recursively
  parseASTNode(ast, conditions, 'AND')

  return {
    id: 'root',
    conditions,
  }
}

function parseASTNode(node: ASTNode, conditions: Condition[], logicAfter: 'AND' | 'OR' = 'AND') {
  if (!node) return

  // Handle logical operators (AND/OR)
  if (node.type === 'logical') {
    const logic = node.operator?.toUpperCase() as 'AND' | 'OR'
    
    // Parse left side
    if (node.left) {
      parseASTNode(node.left, conditions, logic)
    }
    
    // Parse right side (this is the last one, so it gets the logic)
    if (node.right) {
      // If right is also logical, parse it
      if (node.right.type === 'logical') {
        parseASTNode(node.right, conditions, logic)
      } else {
        // Right is comparison, this is the last condition
        parseASTNode(node.right, conditions, 'AND') // Last condition doesn't need logicAfter
      }
    }
  }
  // Handle comparison operators
  else if (node.type === 'comparison') {
    const condition: Condition = {
      id: `cond-${Date.now()}-${Math.random()}`,
      field: node.field || '',
      operator: mapOperator(node.operator || ''),
      value: formatValue(node.value),
      logicAfter,
    }

    // Handle multi-value operators (in/not_in)
    if (Array.isArray(node.value)) {
      condition.values = node.value.map(String)
      condition.value = ''
    }

    conditions.push(condition)
  }
}

/**
 * Map backend operator to frontend operator naming
 */
function mapOperator(op: string): string {
  const operatorMap: Record<string, string> = {
    '==': 'eq',
    '!=': 'neq',
    '>': 'gt',
    '<': 'lt',
    '>=': 'gte',
    '<=': 'lte',
    'contains': 'contains',
    'not_contains': 'not_contains',
    'prefix': 'prefix',
    'suffix': 'suffix',
    'in': 'in',
    'not_in': 'not_in',
    'regex': 'regex',
    'not_regex': 'not_regex',
    'exists': 'exists',
    'not_exists': 'not_exists',
  }

  return operatorMap[op] || op
}

/**
 * Format value for display
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return String(value)
}
