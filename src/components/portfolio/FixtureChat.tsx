import { useState } from 'react'
import { Send } from 'lucide-react'

// Fixture-honest Q&A body shared by the Exception Resolver's evidence chat and
// the Document Vault's AI auditor: suggested questions answer verbatim from
// researched fixture fields; free-form questions get the honest "needs the live
// retrieval backend (unit O6)" deferral instead of an improvised answer.
// Callers own their header chrome; this component owns the chat mechanics.
export function FixtureChat({
  suggestions,
  deferralReply,
  placeholder,
  intro,
  variant = 'compact',
}: {
  suggestions: { q: string; a: string }[]
  deferralReply: string
  placeholder: string
  // Optional opening AI message (the vault auditor introduces itself).
  intro?: string
  // 'compact' = embedded card (modal evidence pane); 'full' = fills its column.
  variant?: 'compact' | 'full'
}) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>(
    intro ? [{ role: 'ai', text: intro }] : [],
  )
  const [input, setInput] = useState('')
  const asked = new Set(messages.filter(m => m.role === 'user').map(m => m.text))

  const ask = (q: string, a: string) =>
    setMessages(prev => [...prev, { role: 'user', text: q }, { role: 'ai', text: a }])

  const askFree = () => {
    const q = input.trim()
    if (!q) return
    setInput('')
    ask(q, deferralReply)
  }

  const full = variant === 'full'
  const bubbleText = full ? 'text-sm' : 'text-xs'

  return (
    <div className={full ? 'flex-1 flex flex-col overflow-hidden' : ''}>
      {messages.length > 0 && (
        <div className={full ? 'flex-1 overflow-y-auto p-4 space-y-3' : 'px-3 py-2.5 space-y-2 max-h-44 overflow-y-auto'}>
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <span className={[
                `inline-block ${bubbleText} leading-relaxed rounded-lg px-2.5 py-1.5 text-left`,
                full ? 'max-w-[88%] rounded-xl px-3 py-2' : 'max-w-[92%]',
                m.role === 'user'
                  ? 'bg-slate-800 text-slate-200'
                  : 'bg-violet-500/10 border border-violet-500/20 text-slate-300',
              ].join(' ')}>
                {m.text}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className={`flex gap-1.5 px-3 py-2 overflow-x-auto ${full ? 'px-4 shrink-0' : ''}`}>
        {suggestions.filter(s => !asked.has(s.q)).map(s => (
          <button
            key={s.q}
            onClick={() => ask(s.q, s.a)}
            className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium text-violet-300 bg-violet-500/10 border border-violet-500/25 hover:bg-violet-500/20 transition-colors"
          >
            {s.q}
          </button>
        ))}
      </div>

      <div className={`flex items-center gap-1.5 px-3 pb-2.5 ${full ? 'px-4 pb-3 shrink-0' : ''}`}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') askFree() }}
          placeholder={placeholder}
          className={`flex-1 bg-slate-950/60 border border-slate-700 rounded-lg px-2.5 py-1.5 ${bubbleText} text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500`}
        />
        <button onClick={askFree} className="p-1.5 rounded-lg text-violet-300 hover:bg-violet-500/10 transition-colors">
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
