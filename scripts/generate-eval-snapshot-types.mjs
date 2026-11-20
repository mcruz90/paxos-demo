import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SCHEMA_PATH = path.join(ROOT, 'src', 'data', 'eval_snapshot.schema.json')
const OUT_PATH = path.join(ROOT, 'src', 'generated', 'evalSnapshotTypes.ts')
const HEADER = [
  '// AUTO-GENERATED from src/data/eval_snapshot.schema.json — DO NOT EDIT.',
  '// Run: npm run eval:types',
  '',
].join('\n')

function toPascalCase(name) {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join('')
}

function renderPrimitive(t) {
  if (t === 'integer' || t === 'number') return 'number'
  if (t === 'string') return 'string'
  if (t === 'boolean') return 'boolean'
  if (t === 'null') return 'null'
  if (t === 'object') return 'Record<string, unknown>'
  return 'unknown'
}

function renderObjectFields(node, indent) {
  const req = new Set(node.required ?? [])
  const pad = ' '.repeat(indent)
  const lines = Object.entries(node.properties).map(([key, prop]) => {
    const opt = req.has(key) ? '' : '?'
    return `${pad}${key}${opt}: ${renderSchemaType(prop, indent)}`
  })
  return `{\n${lines.join('\n')}\n${' '.repeat(indent - 2)}}`
}

function renderArrayType(items, indent) {
  const itemType = items ? renderSchemaType(items, indent) : 'unknown'
  return itemType.includes(' | ') ? `(${itemType})[]` : `${itemType}[]`
}

function renderUnionTypes(types, node, indent) {
  const nonNull = types.filter(t => t !== 'null')
  const hasNull = types.includes('null')
  const mapped = nonNull.map(t => {
    if (t === 'object' && node.properties) return renderObjectFields(node, indent + 2)
    if (t === 'array' && node.items) return renderArrayType(node.items, indent)
    return renderPrimitive(t)
  })
  if (hasNull) mapped.push('null')
  return [...new Set(mapped)].join(' | ')
}

function renderSchemaType(node, indent = 2) {
  if (node.$ref) {
    const prefix = '#/$defs/'
    if (!node.$ref.startsWith(prefix)) throw new Error(`Unsupported $ref: ${node.$ref}`)
    return toPascalCase(node.$ref.slice(prefix.length))
  }
  if ('const' in node) return JSON.stringify(node.const).replace(/"/g, "'")
  if (node.enum) return node.enum.map(v => JSON.stringify(v).replace(/"/g, "'")).join(' | ')
  if (Array.isArray(node.type)) return renderUnionTypes(node.type, node, indent)
  if (node.type === 'object' && node.properties) return renderObjectFields(node, indent + 2)
  if (node.type === 'array') return renderArrayType(node.items, indent)
  if (node.type) return renderPrimitive(node.type)
  return 'unknown'
}

function renderDef(name, defSchema) {
  const typeName = toPascalCase(name)
  if (defSchema.type === 'object' && defSchema.properties && !Array.isArray(defSchema.type)) {
    return `export interface ${typeName} ${renderObjectFields(defSchema, 2)}`
  }
  return `export type ${typeName} = ${renderSchemaType(defSchema, 2)}`
}

export function generateEvalSnapshotTypesSource(schema) {
  const defs = Object.entries(schema.$defs ?? {}).map(([k, v]) => renderDef(k, v))
  const root = `export interface EvalSnapshot ${renderObjectFields(schema, 2)}`
  return `${HEADER}\n${defs.join('\n\n')}\n\n${root}\n`
}

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'))
const nextContent = generateEvalSnapshotTypesSource(schema)

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf8') : ''
  if (current !== nextContent) {
    console.error(`Mismatch in ${path.relative(ROOT, OUT_PATH)}. Run: npm run eval:types`)
    process.exit(1)
  }
  console.log(`OK: ${path.relative(ROOT, OUT_PATH)} matches ${path.relative(ROOT, SCHEMA_PATH)}`)
} else {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, nextContent, 'utf8')
  console.log(`Generated ${path.relative(ROOT, OUT_PATH)}`)
}
