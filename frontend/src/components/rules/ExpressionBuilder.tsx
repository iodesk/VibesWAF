import { useState, useEffect, JSX } from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { MultiSelect } from '@/components/ui/multi-select'
import { Plus, Trash2 } from 'lucide-react'
import { 
  fetchFieldMetadata, 
  getCategories, 
  getFieldsByCategory, 
  getAllowedOperators,
  type FieldDefinition
} from '@/lib/field-metadata'

export interface Condition {
  id: string
  field: string
  operator: string
  value: string
  values?: string[] // For multi-select operators like in/not_in
  logicAfter?: 'AND' | 'OR' // Logic operator after this condition
}

export interface ConditionGroup {
  id: string
  conditions: Condition[]
}

interface ExpressionBuilderProps {
  value: ConditionGroup
  onChange: (value: ConditionGroup) => void
}

export function ExpressionBuilder({ value, onChange }: ExpressionBuilderProps) {
  const [fields, setFields] = useState<Record<string, FieldDefinition>>({})
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch field metadata from backend on mount
  useEffect(() => {
    fetchFieldMetadata()
      .then((fetchedFields) => {
        setFields(fetchedFields)
        setCategories(getCategories(fetchedFields))
        setLoading(false)
      })
      .catch((error) => {
        console.error('Failed to load field metadata:', error)
        setLoading(false)
      })
  }, [])

  const addCondition = (groupId: string) => {
    // Use first available field as default
    const firstField = Object.keys(fields)[0] || 'http.path'
    const allowedOps = getAllowedOperators(fields, firstField)
    
    const newCondition: Condition = {
      id: `cond-${Date.now()}`,
      field: firstField,
      operator: allowedOps[0]?.value || 'eq',
      value: '',
      logicAfter: 'AND', // Default to AND
    }

    const updateGroup = (group: ConditionGroup): ConditionGroup => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: [...group.conditions, newCondition],
        }
      }
      return group
    }

    onChange(updateGroup(value))
  }



  const removeItem = (groupId: string, itemId: string) => {
    const updateGroup = (group: ConditionGroup): ConditionGroup => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: group.conditions.filter((c) => c.id !== itemId),
        }
      }
      return group
    }

    onChange(updateGroup(value))
  }

  const updateCondition = (conditionId: string, updates: Partial<Condition>) => {
    const updateInGroup = (group: ConditionGroup): ConditionGroup => {
      return {
        ...group,
        conditions: group.conditions.map((c) => {
          if (c.id === conditionId) {
            return { ...c, ...updates }
          }
          return c
        }),
      }
    }

    onChange(updateInGroup(value))
  }

  const renderCondition = (condition: Condition, groupId: string) => {
    const field = fields[condition.field]
    const allowedOps = getAllowedOperators(fields, condition.field)

    return (
      <div key={condition.id} className="flex flex-col gap-2 p-3 bg-secondary/30 rounded border border-border sm:flex-row sm:items-center">
        {/* Field Selector */}
        <div className="w-full sm:flex-1">
          <Select
            value={condition.field}
            onChange={(e) => {
              const newField = e.target.value
              const newFieldDef = fields[newField]
              const newAllowedOps = getAllowedOperators(fields, newField)
              updateCondition(condition.id, {
                field: newField,
                operator: newAllowedOps[0]?.value || 'eq',
                value: newFieldDef?.type === 'boolean' ? 'true' : '',
              })
            }}
            className="text-sm"
          >
            {categories.map((category) => (
              <optgroup key={category} label={category}>
                {getFieldsByCategory(fields, category).map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        {/* Operator Selector - Use metadata from backend */}
        <div className="w-full sm:w-40">
          <Select
            value={condition.operator}
            onChange={(e) => updateCondition(condition.id, { operator: e.target.value })}
            className="text-sm"
          >
            {allowedOps.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Value Input - hide for exists/not_exists and boolean operators */}
        {field?.type !== 'boolean' && condition.operator !== 'exists' && condition.operator !== 'not_exists' && (
          <div className="w-full sm:flex-1">
            {condition.operator === 'in' || condition.operator === 'not_in' ? (
              <MultiSelect
                values={condition.values || []}
                onChange={(values) => updateCondition(condition.id, { values })}
                placeholder="Add value..."
                type={field?.type === 'number' ? 'number' : 'text'}
              />
            ) : (
              <Input
                type={field?.type === 'number' ? 'number' : 'text'}
                value={condition.value}
                onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                placeholder="Value..."
                className="text-sm"
              />
            )}
          </div>
        )}

        {/* Remove Button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => removeItem(groupId, condition.id)}
          className="self-end sm:self-auto"
        >
          <Trash2 className="w-4 h-4 icon-danger" />
        </Button>
      </div>
    )
  }

  const renderGroup = (group: ConditionGroup): JSX.Element => {
    return (
      <div className="space-y-2">
        {/* Conditions */}
        <div className="space-y-2">
          {group.conditions.map((condition, index) => (
            <div key={condition.id}>
              {renderCondition(condition, group.id)}
              
              {/* Logic selector between conditions (not after last one) */}
              {index < group.conditions.length - 1 && (
                <div className="flex items-center justify-center py-2">
                  <div className="inline-flex rounded border border-border bg-muted">
                    <button
                      type="button"
                      onClick={() => updateCondition(condition.id, { logicAfter: 'AND' })}
                      className={`px-3 py-1 text-xs font-medium rounded-l transition-colors ${
                        condition.logicAfter === 'AND'
                          ? 'btn-primary text-white'
                          : 'text-muted-foreground hover:bg-background/50'
                      }`}
                    >
                      AND
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCondition(condition.id, { logicAfter: 'OR' })}
                      className={`px-3 py-1 text-xs font-medium rounded-r transition-colors ${
                        condition.logicAfter === 'OR'
                          ? 'btn-primary text-white'
                          : 'text-muted-foreground hover:bg-background/50'
                      }`}
                    >
                      OR
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Button */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addCondition(group.id)}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Condition
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="text-center py-4 text-muted-foreground">
          Loading fields...
        </div>
      ) : (
        renderGroup(value)
      )}
    </div>
  )
}

// Helper function to generate expression string from condition group
export function generateExpression(group: ConditionGroup, fields: Record<string, FieldDefinition>): string {
  if (group.conditions.length === 0) return ''

  const parts: string[] = []

  group.conditions.forEach((condition, index) => {
    const field = fields[condition.field]
    if (!field) return

    // Get operator metadata from field's allowed operators
    const allowedOps = field.allowedOperators
    const opDef = allowedOps.find(op => op.value === condition.operator)
    if (!opDef) return

    // Handle exists/not_exists operators (no value needed)
    if (condition.operator === 'exists' || condition.operator === 'not_exists') {
      parts.push(`${condition.field} ${opDef.symbol}`)
    }
    // Handle boolean operators
    else if (field.type === 'boolean') {
      if (condition.operator === 'eq') {
        parts.push(`${condition.field} eq true`)
      } else if (condition.operator === 'neq') {
        parts.push(`${condition.field} neq true`)
      }
    }
    // Handle in/not_in operators with multi-value
    else if (condition.operator === 'in' || condition.operator === 'not_in') {
      const values = (condition.values || [])
        .filter((v) => v)
        .map((v) => (field.type === 'string' ? `"${v}"` : v))
      
      if (values.length > 0) {
        parts.push(`${condition.field} ${opDef.symbol} [${values.join(', ')}]`)
      }
    }
    // Handle regular operators
    else {
      let formattedValue = condition.value
      if (field.type === 'string') {
        formattedValue = `"${condition.value}"`
      }
      parts.push(`${condition.field} ${opDef.symbol} ${formattedValue}`)
    }

    // Add logic operator after this condition (if not last)
    if (index < group.conditions.length - 1 && condition.logicAfter) {
      parts.push(condition.logicAfter.toLowerCase())
    }
  })

  return parts.join(' ')
}

