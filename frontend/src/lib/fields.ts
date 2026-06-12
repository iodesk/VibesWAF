// Field definitions for expression builder
export interface FieldDefinition {
  label: string
  type: 'string' | 'number' | 'boolean'
  category: string
  description?: string
}

export const FIELDS: Record<string, FieldDefinition> = {
  // IP & Network
  'ip.src': {
    label: 'IP Source',
    type: 'string',
    category: 'IP & Network',
    description: 'Client IP address',
  },
  'ip.version': {
    label: 'IP Version',
    type: 'number',
    category: 'IP & Network',
    description: 'IP version (4 or 6)',
  },
  'ip.is_datacenter': {
    label: 'Is Datacenter IP',
    type: 'boolean',
    category: 'IP & Network',
    description: 'IP from datacenter',
  },
  asn: {
    label: 'ASN',
    type: 'number',
    category: 'IP & Network',
    description: 'Autonomous System Number',
  },
  country: {
    label: 'Country',
    type: 'string',
    category: 'IP & Network',
    description: 'Country code (e.g., US, ID)',
  },

  // HTTP Request
  'http.host': {
    label: 'Host',
    type: 'string',
    category: 'HTTP Request',
    description: 'Request host header',
  },
  'http.path': {
    label: 'Path',
    type: 'string',
    category: 'HTTP Request',
    description: 'Request URI path',
  },
  'http.request.uri.path': {
    label: 'Path',
    type: 'string',
    category: 'HTTP Request',
    description: 'Request URI path',
  },
  'http.query': {
    label: 'Query String',
    type: 'string',
    category: 'HTTP Request',
    description: 'Request query string',
  },
  'http.request.uri.query': {
    label: 'Query String',
    type: 'string',
    category: 'HTTP Request',
    description: 'Request query string',
  },
  'http.request.scheme': {
    label: 'Scheme',
    type: 'string',
    category: 'HTTP Request',
    description: 'HTTP or HTTPS',
  },
  'http.request.version': {
    label: 'Protocol Version',
    type: 'string',
    category: 'HTTP Request',
    description: 'HTTP version (e.g., HTTP/1.1)',
  },
  'http.request.method': {
    label: 'Request Method',
    type: 'string',
    category: 'HTTP Request',
    description: 'HTTP method (GET, POST, etc)',
  },

  // Headers
  'http.ua': {
    label: 'User Agent',
    type: 'string',
    category: 'Headers',
    description: 'User-Agent header',
  },
  'http.user_agent': {
    label: 'User Agent',
    type: 'string',
    category: 'Headers',
    description: 'User-Agent header',
  },
  'http.cookie': {
    label: 'Cookie',
    type: 'string',
    category: 'Headers',
    description: 'Cookie header',
  },
  'http.referer': {
    label: 'Referer',
    type: 'string',
    category: 'Headers',
    description: 'Referer header',
  },
  'http.accept': {
    label: 'Accept Header',
    type: 'string',
    category: 'Headers',
    description: 'Accept header',
  },

  // Device
  'device.os': {
    label: 'Operating System',
    type: 'string',
    category: 'Device',
    description: 'OS name (Windows, macOS, etc)',
  },
  'device.browser': {
    label: 'Browser',
    type: 'string',
    category: 'Device',
    description: 'Browser name (Chrome, Firefox, etc)',
  },
  'device.is_mobile': {
    label: 'Is Mobile',
    type: 'boolean',
    category: 'Device',
    description: 'Mobile device',
  },
  'device.is_desktop': {
    label: 'Is Desktop',
    type: 'boolean',
    category: 'Device',
    description: 'Desktop device',
  },
  'device.is_tablet': {
    label: 'Is Tablet',
    type: 'boolean',
    category: 'Device',
    description: 'Tablet device',
  },

  // Rate
  request_rate: {
    label: 'Request Rate',
    type: 'number',
    category: 'Rate',
    description: 'Requests per second',
  },
}

// Get unique categories
export const CATEGORIES = Array.from(
  new Set(Object.values(FIELDS).map((f) => f.category))
).sort()

// Get fields by category
export function getFieldsByCategory(category: string) {
  return Object.entries(FIELDS)
    .filter(([_, field]) => field.category === category)
    .map(([key, field]) => ({ key, ...field }))
}
