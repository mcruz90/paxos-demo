import { type ReactNode } from 'react'

// Shared JSON renderer: colors keys/strings/numbers/bools like a code block and
// swaps status/verdict string values for chips so a payload is scannable at a
// glance. Used by the Agent Instructions and Rule-primitive example runs.

const CHIP_CLS: Record<string, string> = {
  found:        'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  needs_review: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  conflict:     'text-red-300 bg-red-500/10 border-red-500/30',
  pass:         'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  fail:         'text-red-300 bg-red-500/10 border-red-500/30',
}
const CHIP_KEYS = new Set(['status', 'verdict'])

export function Chip({ value }: { value: string }) {
  const cls = CHIP_CLS[value] ?? 'text-slate-300 bg-slate-700/40 border-slate-600/40'
  return <span className={`inline-block px-1.5 rounded border text-[10px] font-sans align-middle ${cls}`}>{value}</span>
}

function renderVal(v: unknown, indent: number, key?: string): ReactNode {
  const pad = '  '.repeat(indent + 1)
  const padEnd = '  '.repeat(indent)
  if (v === null) return <span className="text-slate-600">null</span>
  if (typeof v === 'boolean') return <span className={v ? 'text-emerald-400' : 'text-red-400'}>{String(v)}</span>
  if (typeof v === 'number') return <span className="text-amber-300">{v}</span>
  if (typeof v === 'string') {
    if (key && CHIP_KEYS.has(key)) return <Chip value={v} />
    return <span className="text-emerald-300/90">&quot;{v}&quot;</span>
  }
  if (Array.isArray(v)) {
    if (!v.length) return <span className="text-slate-600">[]</span>
    return (
      <>
        <span className="text-slate-600">[</span>{'\n'}
        {v.map((it, i) => (
          <span key={i}>{pad}{renderVal(it, indent + 1)}{i < v.length - 1 && <span className="text-slate-600">,</span>}{'\n'}</span>
        ))}
        {padEnd}<span className="text-slate-600">]</span>
      </>
    )
  }
  const entries = Object.entries(v as Record<string, unknown>)
  return (
    <>
      <span className="text-slate-600">{'{'}</span>{'\n'}
      {entries.map(([k, val], i) => (
        <span key={k}>{pad}<span className="text-sky-300">&quot;{k}&quot;</span><span className="text-slate-600">: </span>{renderVal(val, indent + 1, k)}{i < entries.length - 1 && <span className="text-slate-600">,</span>}{'\n'}</span>
      ))}
      {padEnd}<span className="text-slate-600">{'}'}</span>
    </>
  )
}

// A JSON payload rendered as a code block, with an optional `// SchemaName` header.
export function JsonView({ schema, data }: { schema?: string; data: unknown }) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-950/50 p-3 h-full">
      {schema && <p className="text-[10px] font-mono text-slate-600 mb-1.5">{'// '}{schema}</p>}
      <pre className="text-[11px] leading-relaxed font-mono text-slate-300 whitespace-pre-wrap break-words">{renderVal(data, 0)}</pre>
    </div>
  )
}
