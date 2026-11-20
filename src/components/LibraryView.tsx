import { useState } from 'react'
import { Info } from 'lucide-react'
import { type View } from '../types'
import { LibraryPrimitivesSection } from './LibraryPrimitivesSection'
import { LifecycleSkeleton } from './LifecycleSkeleton'

export {
  computePackDeltas, PACK_DRIFT, PACK_PROVENANCE, PACK_REGISTRY_HISTORY, PACK_REGISTRY_V1,
  type PackDrift, type PackRegistryData, type PolicyPack,
} from './libraryData'

const LAYER_TABS = [
  { key: 'all', label: 'All Layers', note: 'skeleton + primitives' },
  { key: 'skeleton', label: 'Case skeleton', note: 'the process' },
  { key: 'criteria', label: 'Criteria', note: 'what it checks' },
] as const
type LayerKey = typeof LAYER_TABS[number]['key']

export function LibraryView({ setView }: { setView: (v: View) => void }) {
  const [activeLayer, setActiveLayer] = useState<LayerKey>('all')

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      <div className="px-8 py-6 border-b border-slate-800">
        <h1 className="text-xl font-bold font-display text-white">Ontology Library</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          The universal anatomy of a PA case — the shared lifecycle skeleton and payer-agnostic rule primitives
        </p>
      </div>
      <div className="p-8 space-y-6">
        <div className="flex items-start gap-3 px-4 py-3.5 bg-slate-800/50 border border-slate-700/60 rounded-xl">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-300">Two layers: the process, and what it checks</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              The <em className="text-slate-400 not-italic font-medium">case skeleton</em> defines every lifecycle gate; <em className="text-slate-400 not-italic font-medium">Universal Rule Primitives</em> compose into per-payer packs resolved from the <button onClick={() => setView('platform')} className="text-emerald-400 hover:underline">Platform Registry</button>.
            </p>
          </div>
        </div>
        <div className="flex gap-1 border-b border-slate-800">
          {LAYER_TABS.map(t => (
            <button
              key={t.key} onClick={() => setActiveLayer(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeLayer === t.key ? 'border-emerald-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}<span className="ml-2 text-[10px] font-mono text-slate-500 hidden sm:inline">{t.note}</span>
            </button>
          ))}
        </div>
        {(activeLayer === 'all' || activeLayer === 'skeleton') && <LifecycleSkeleton />}
        {(activeLayer === 'all' || activeLayer === 'criteria') && <LibraryPrimitivesSection setView={setView} />}
      </div>
    </div>
  )
}
