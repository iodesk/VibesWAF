import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRule, useRules, useCreateRule, useUpdateRule, useValidateExpression } from '@/hooks/useApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft, CheckCircle, XCircle, Code, Wand2, Plus, Save, Loader2 } from 'lucide-react'
import { ExpressionBuilder, generateExpression, type ConditionGroup } from '@/components/rules/ExpressionBuilder'
import { astToConditionGroup } from '@/lib/ast-converter'
import { fetchFieldMetadata, type FieldDefinition } from '@/lib/field-metadata'
import type { RuleCreateRequest } from '@/lib/api-client'

export default function RuleForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id

  const { data: existingRule, isLoading: loadingRule } = useRule(id ? parseInt(id) : 0)
  const { data: rules } = useRules()
  const createRule = useCreateRule()
  const updateRule = useUpdateRule()
  const validateExpression = useValidateExpression()
  const { addToast } = useToast()

  // Fields metadata from backend
  const [fields, setFields] = useState<Record<string, FieldDefinition>>({})

  // Builder mode: visual or raw
  const [builderMode, setBuilderMode] = useState<'visual' | 'raw'>('visual')

  // Expression builder state
  const [expressionGroup, setExpressionGroup] = useState<ConditionGroup>({
    id: 'root',
    conditions: [],
  })

  // Raw expression state
  const [rawExpression, setRawExpression] = useState('')

  // Validation state
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null)

  // Form state
  const [formData, setFormData] = useState<RuleCreateRequest>({
    name: '',
    description: '',
    scope: 'app',
    rule_group: 'custom',
    expression_raw: '',
    action: 'block',
    skip_modules: [],
    priority: 100,
    enabled: true,
  })

  // Fetch field metadata on mount
  useEffect(() => {
    fetchFieldMetadata()
      .then(setFields)
      .catch((error) => {
        console.error('Failed to load field metadata:', error)
        addToast('Failed to load field metadata', 'error')
      })
  }, [])

  // Load existing rule data
  useEffect(() => {
    if (existingRule) {
      setFormData({
        name: existingRule.name,
        description: existingRule.description,
        scope: existingRule.scope,
        app_id: existingRule.app_id || '',
        rule_group: existingRule.rule_group,
        expression_raw: existingRule.expression_raw,
        action: existingRule.action,
        skip_modules: existingRule.skip_modules || [],
        priority: existingRule.priority,
        enabled: existingRule.enabled,
      })
      setRawExpression(existingRule.expression_raw)

      // Convert AST to ConditionGroup for Visual Builder
      if (existingRule.expression_structure) {
        const conditionGroup = astToConditionGroup(existingRule.expression_structure)
        setExpressionGroup(conditionGroup)
        // Keep visual mode as default
      } else {
        // No structure available, use raw mode
        setBuilderMode('raw')
      }
    }
  }, [isEdit, existingRule])

  // Auto-suggest priority for new rules
  useEffect(() => {
    if (!isEdit && rules && rules.length > 0) {
      const maxPriority = Math.max(...rules.map(r => r.priority), 0)
      setFormData(prev => ({ ...prev, priority: maxPriority + 10 }))
    }
  }, [rules, isEdit])

  // Get current expression based on mode
  const getCurrentExpression = () => {
    if (builderMode === 'visual') {
      return generateExpression(expressionGroup, fields)
    }
    return rawExpression
  }

  const handleValidate = async () => {
    const expression = getCurrentExpression()
    if (!expression) {
      setValidationResult({ valid: false, error: 'Expression is required' })
      return
    }

    try {
      const result = await validateExpression.mutateAsync(expression)
      setValidationResult(result)
      if (result.valid) {
        addToast('Expression is valid', 'success')
      } else {
        addToast(result.error || 'Invalid expression', 'error')
      }
    } catch (error) {
      setValidationResult({ valid: false, error: 'Validation failed' })
      addToast('Validation failed', 'error')
    }
  }

  const handleSubmit = async () => {
    const expression = getCurrentExpression()

    if (!formData.name || !expression) {
      addToast('Name and expression are required', 'error')
      return
    }

    try {
      if (isEdit && id) {
        await updateRule.mutateAsync({
          id: parseInt(id),
          data: {
            ...formData,
            expression_raw: expression,
          },
        })
        addToast('Rule updated successfully', 'success')
      } else {
        await createRule.mutateAsync({
          ...formData,
          expression_raw: expression,
        })
        addToast('Rule created successfully', 'success')
      }
      navigate('/rules-engine')
    } catch (error) {
      addToast(`Failed to ${isEdit ? 'update' : 'create'} rule`, 'error')
    }
  }

  if (isEdit && loadingRule) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    )
  }

  const currentExpression = getCurrentExpression()

  return (
    <div className="space-y-6 animate-in max-w-10xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/rules-engine')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{isEdit ? 'Edit Rule' : 'Create Rule'}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isEdit ? 'Update rule configuration' : 'Add a new security rule with visual expression builder'}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rule Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Rule Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Rules"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this rule does..."
              rows={2}
            />
          </div>

          {/* Expression Builder/Raw Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Expression *</Label>
              <div className="flex gap-2">
              <div className="inline-flex rounded border border-border bg-muted">
                  <button
                    type="button"
                    onClick={() => setBuilderMode('visual')}
                    className={`px-3 py-1 text-xs font-medium rounded-l transition-colors ${builderMode === 'visual'
                      ? 'btn-primary text-white'
                      : 'text-muted-foreground hover:bg-muted'
                      }`}
                  >
                    <Wand2 className="w-3 h-3 inline mr-1" />
                    Visual
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuilderMode('raw')}
                    className={`px-3 py-1 text-xs font-medium rounded-r transition-colors ${builderMode === 'raw'
                      ? 'btn-primary text-white'
                      : 'text-muted-foreground hover:bg-muted'
                      }`}
                  >
                    <Code className="w-3 h-3 inline mr-1" />
                    Raw
                  </button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleValidate}
                  disabled={!currentExpression || validateExpression.isPending}
                >
                  {validateExpression.isPending ? 'Validating...' : 'Validate'}
                </Button>
              </div>
            </div>

            {/* Visual Builder */}
            {builderMode === 'visual' && (
              <div className="border border-border rounded p-4 bg-background">
                <ExpressionBuilder value={expressionGroup} onChange={setExpressionGroup} />
              </div>
            )}

            {/* Raw Expression */}
            {builderMode === 'raw' && (
              <Textarea
                value={rawExpression}
                onChange={(e) => {
                  setRawExpression(e.target.value)
                  setValidationResult(null)
                }}
                placeholder='http.request.uri.path contains "admin" and ip.src == "1.2.3.4"'
                rows={6}
                className="font-mono text-sm"
              />
            )}

            {/* Expression Preview */}
            {builderMode === 'visual' && currentExpression && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Preview:</Label>
                <div className="bg-secondary/50 p-3 rounded border border-border">
                  <code className="text-sm font-mono">{currentExpression}</code>
                </div>
              </div>
            )}

            {/* Validation Result */}
            {validationResult && (
              <div
                className={`flex items-center gap-2 text-sm ${validationResult.valid ? 'text-foreground' : 'text-destructive'
                  }`}
              >
                {validationResult.valid ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Expression is valid</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>{validationResult.error || 'Invalid expression'}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Action & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="action">Action *</Label>
              <Select
                id="action"
                value={formData.action}
                onChange={(e) => setFormData({ ...formData, action: e.target.value as any, skip_modules: e.target.value === 'skip' ? formData.skip_modules : [] })}
              >
                <option value="allow">Allow</option>
                <option value="block">Block</option>
                <option value="challenge">Challenge</option>
                <option value="log">Log</option>
                <option value="skip">Skip</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              />
            </div>
          </div>

          {/* Skip Modules Checkboxes (shown only when action=skip) */}
          {formData.action === 'skip' && (
            <div className="space-y-3 p-4 border border-border rounded bg-secondary/30">
              <Label>Skip Modules</Label>
              <p className="text-xs text-muted-foreground">
                Select which security modules to bypass for matched traffic. Unchecked modules still run normally.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {[
                  { value: 'waf', label: 'WAF Managed Rules' },
                  { value: 'bot', label: 'Bot Detection' },
                  { value: 'rate_limit', label: 'Rate Limiting' },
                  { value: 'ip_reputation', label: 'IP Reputation' },
                  { value: 'protocol_anomaly', label: 'Protocol Anomaly' },
                  { value: 'flood', label: 'Flood Protection' },
                ].map((mod) => (
                  <label key={mod.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      checked={formData.skip_modules?.includes(mod.value) || false}
                      onChange={(e) => {
                        const modules = formData.skip_modules || []
                        if (e.target.checked) {
                          setFormData({ ...formData, skip_modules: [...modules, mod.value] })
                        } else {
                          setFormData({ ...formData, skip_modules: modules.filter(m => m !== mod.value) })
                        }
                      }}
                    />
                    <span className="text-sm">{mod.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Lower priority rules are evaluated first in the pipeline
          </p>

          {/* Enabled */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <Label>Enable Rule</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Disabled rules will not be evaluated
              </p>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/rules-engine')}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!formData.name || !currentExpression || createRule.isPending || updateRule.isPending}
          className="btn-primary hover:opacity-90 shadow-none px-6"
        >
          {createRule.isPending || updateRule.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : isEdit ? (
            <Save className="w-4 h-4 mr-2" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          {createRule.isPending || updateRule.isPending
            ? 'Saving...'
            : isEdit
              ? 'Save'
              : 'Create'}
        </Button>
      </div>
    </div>
  )
}

