// Field metadata service - fetches field definitions from backend
export interface OperatorMetadata {
  value: string
  label: string
  symbol: string
  description?: string
}

export interface FieldMetadata {
  name: string
  type: 'string' | 'int' | 'bool' | 'ip'
  allowed_operators: OperatorMetadata[]
  description: string
}

export interface FieldDefinition {
  label: string
  type: 'string' | 'number' | 'boolean'
  category: string
  description?: string
  allowedOperators: OperatorMetadata[]
}

import { apiBase } from './api/client'

let cachedFields: Record<string, FieldDefinition> | null = null

const API_BASE_URL = apiBase

// Fetch field metadata from backend
export async function fetchFieldMetadata(): Promise<Record<string, FieldDefinition>> {
  if (cachedFields) {
    return cachedFields
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/rules/fields`, {
      credentials: 'include', // Send cookies with request
    })
    if (!response.ok) {
      throw new Error('Failed to fetch field metadata')
    }

    const data = await response.json()
    const fields: Record<string, FieldDefinition> = {}

    // Convert backend format to frontend format
    data.fields.forEach((field: FieldMetadata) => {
      // Skip device.* fields — client.* are the canonical aliases
      if (field.name.startsWith('device.')) return

      const category = getCategoryForField(field.name)
      const label = getLabelForField(field.name)

      fields[field.name] = {
        label,
        type: mapBackendTypeToFrontend(field.type),
        category,
        description: field.description,
        allowedOperators: field.allowed_operators,
      }
    })

    cachedFields = fields
    return fields
  } catch (error) {
    console.error('Failed to fetch field metadata:', error)
    throw error
  }
}

// Map backend type to frontend type
function mapBackendTypeToFrontend(type: string): 'string' | 'number' | 'boolean' {
  switch (type) {
    case 'int':
      return 'number'
    case 'bool':
      return 'boolean'
    case 'string':
    case 'ip':
      return 'string'
    default:
      return 'string'
  }
}

// Get category based on field name
function getCategoryForField(fieldName: string): string {
  if (fieldName.startsWith('ip.') || fieldName === 'asn' || fieldName === 'country') return 'IP & Network'
  if (fieldName.startsWith('http.') && !fieldName.includes('ua') && !fieldName.includes('cookie') && !fieldName.includes('referer') && !fieldName.includes('accept')) return 'HTTP Request'
  if (fieldName.startsWith('http.') && (fieldName.includes('ua') || fieldName.includes('cookie') || fieldName.includes('referer') || fieldName.includes('accept'))) return 'Headers'
  if (fieldName.startsWith('client.') || fieldName.startsWith('device.')) return 'Device'
  if (fieldName.startsWith('req.')) return 'Rate'
  return 'Other'
}

// Get human-readable label for field
function getLabelForField(fieldName: string): string {
  const labels: Record<string, string> = {
    'ip.src': 'IP Source',
    'ip.version': 'IP Version',
    'ip.is_datacenter': 'Is Datacenter IP',
    'asn': 'ASN',
    'country': 'Country',
    'http.host': 'Host',
    'http.path': 'Path',
    'http.query': 'Query String',
    'http.scheme': 'Scheme',
    'http.version': 'Protocol Version',
    'http.method': 'Request Method',
    'http.ua': 'User Agent',
    'http.cookie': 'Cookie',
    'http.referer': 'Referer',
    'http.accept': 'Accept Header',
    'client.os': 'Operating System',
    'client.browser': 'Browser',
    'client.is_mobile': 'Is Mobile',
    'client.is_desktop': 'Is Desktop',
    'client.is_tablet': 'Is Tablet',
    'req.rate': 'Request Rate',
  }

  return labels[fieldName] || fieldName
}

// Get unique categories
export function getCategories(fields: Record<string, FieldDefinition>): string[] {
  return Array.from(new Set(Object.values(fields).map((f) => f.category))).sort()
}

// Get fields by category
export function getFieldsByCategory(fields: Record<string, FieldDefinition>, category: string) {
  return Object.entries(fields)
    .filter(([_, field]) => field.category === category)
    .map(([key, field]) => ({ key, ...field }))
}

// Get allowed operators for a field
export function getAllowedOperators(fields: Record<string, FieldDefinition>, fieldName: string): OperatorMetadata[] {
  return fields[fieldName]?.allowedOperators || []
}

// Clear cache (useful for testing)
export function clearFieldCache() {
  cachedFields = null
}
