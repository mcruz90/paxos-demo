export interface JsonSchema {
  $ref?: string
  $defs?: Record<string, JsonSchema>
  const?: unknown
  enum?: unknown[]
  type?: string | string[]
  required?: string[]
  additionalProperties?: boolean
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
}

function matchesJsonType(value: unknown, kind: string): boolean {
  if (kind === 'null') return value === null
  if (kind === 'string') return typeof value === 'string'
  if (kind === 'boolean') return typeof value === 'boolean'
  if (kind === 'integer') return typeof value === 'number' && Number.isInteger(value)
  if (kind === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (kind === 'array') return Array.isArray(value)
  if (kind === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value)
  return false
}

function resolveRef(schema: JsonSchema, rootSchema: JsonSchema): JsonSchema {
  if (!schema.$ref) return schema
  const prefix = '#/$defs/'
  if (!schema.$ref.startsWith(prefix)) throw new Error(`Unsupported $ref: ${schema.$ref}`)
  const def = rootSchema.$defs?.[schema.$ref.slice(prefix.length)]
  if (!def) throw new Error(`Missing schema definition: ${schema.$ref}`)
  return def
}

function validateObject(
  obj: Record<string, unknown>,
  node: JsonSchema,
  root: JsonSchema,
  path: string,
): string[] {
  const errors: string[] = []
  for (const key of node.required ?? []) {
    if (!(key in obj)) errors.push(`${path}.${key}: missing required field`)
  }
  const props = node.properties ?? {}
  if (node.additionalProperties === false) {
    for (const key of Object.keys(obj)) {
      if (!(key in props)) errors.push(`${path}.${key}: unexpected property`)
    }
  }
  for (const [key, propSchema] of Object.entries(props)) {
    if (key in obj) {
      errors.push(...validateAgainstSchema(obj[key], propSchema, root, `${path}.${key}`))
    }
  }
  return errors
}

export function validateAgainstSchema(
  value: unknown,
  schema: JsonSchema,
  rootSchema: JsonSchema = schema,
  path = '$',
): string[] {
  const node = resolveRef(schema, rootSchema)
  const errors: string[] = []

  if ('const' in node && value !== node.const) {
    errors.push(`${path}: expected const ${JSON.stringify(node.const)}, got ${JSON.stringify(value)}`)
  }
  if (node.enum && !node.enum.includes(value)) {
    errors.push(`${path}: value ${JSON.stringify(value)} not in enum [${node.enum.join(', ')}]`)
  }
  if (node.type) {
    const allowed = Array.isArray(node.type) ? node.type : [node.type]
    if (!allowed.some(kind => matchesJsonType(value, kind))) {
      errors.push(`${path}: expected type ${allowed.join(' | ')}`)
      return errors
    }
  }

  if (Array.isArray(value) && node.items) {
    for (let i = 0; i < value.length; i++) {
      errors.push(...validateAgainstSchema(value[i], node.items, rootSchema, `${path}[${i}]`))
    }
  } else if (typeof value === 'object' && value !== null && !Array.isArray(value) && (node.properties || node.required)) {
    errors.push(...validateObject(value as Record<string, unknown>, node, rootSchema, path))
  }

  return errors
}
