export const EVAL_HEADLINE = [
  {
    key: 'coverage',
    label: 'Guideline Coverage',
    score: 94.2,
    desc: 'PA criteria with a supporting clinical guideline or policy citation located',
    color: 'emerald',
  },
  {
    key: 'structure',
    label: 'Letter Structure',
    score: 100,
    desc: 'Generated letters containing all required sections before coordinator review',
    color: 'emerald',
  },
  {
    key: 'safety',
    label: 'Safety Gate (1st pass)',
    score: 100,
    desc: 'Cases cleared the deterministic rule check without triggering a retry',
    color: 'emerald',
  },
  {
    key: 'alignment',
    label: 'Claim-Citation Alignment',
    score: 97.8,
    desc: 'Letter claims independently traceable to a retrieved source document',
    color: 'emerald',
  },
] as const

export const EVAL_BY_CASE = [
  {
    name: 'Case #PH-3102',
    drug: 'Ozempic',
    category: 'Endocrinology',
    rounds: 1,
    coverage: 96,
    structure: 100,
    safety: 100,
    alignment: 98,
  },
  {
    name: 'Case #PH-4201',
    drug: 'Esomeprazole Susp.',
    category: 'Gastroenterology',
    rounds: 2,
    coverage: 92,
    structure: 100,
    safety: 100,
    alignment: 97,
  },
]

export function ScorePill({ v }: { v: number }) {
  const color = v === 100 ? 'text-emerald-300 bg-emerald-500/10' : v >= 90 ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-300 bg-amber-500/10'
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold ${color}`}>{v}%</span>
}

export const OUTCOMES_HEADLINE: { key: string; label: string; value: string; unit: string; sub: string; colorClass: string }[] = [
  { key: 'approval', label: 'Auth Approval Rate',    value: '87%', unit: '',           sub: 'Cases approved by payer this period',    colorClass: 'text-emerald-300' },
  { key: 'appeal',   label: 'Appeal Win Rate',        value: '94%', unit: '',           sub: 'Denied cases overturned on resubmission', colorClass: 'text-emerald-300' },
  { key: 'days',     label: 'Avg Days to Decision',   value: '4.2', unit: 'days',       sub: 'Submission to payer response',            colorClass: 'text-sky-300' },
  { key: 'time',     label: 'Avg Coordinator Review', value: '14',  unit: 'min / case', sub: 'vs. ~67 min manual baseline',             colorClass: 'text-violet-300' },
]

export const PAYER_PERF = [
  { payer: 'Cigna',            cases: 4, approvalRate: 92, avgDays: 3.8, trend: '↑', trendColor: 'text-emerald-400' },
  { payer: 'UnitedHealthcare', cases: 3, approvalRate: 83, avgDays: 5.1, trend: '→', trendColor: 'text-slate-400' },
  { payer: 'Aetna CVS Health', cases: 2, approvalRate: 75, avgDays: 6.2, trend: '↓', trendColor: 'text-red-400' },
]

// Outcomes are tracked by drug × INDICATION — the same drug can have multiple
// indications with entirely different criteria and payer posture (e.g. Ozempic
// for T2DM vs. weight management). A single "note" can't represent that, so each
// indication is its own row with a trend, mirroring Payer Performance.
export const DRUG_PERF: { drug: string; indication: string; category: string; cases: number; approvalRate: number | null; trend: string; trendColor: string }[] = [
  { drug: 'Ozempic',            indication: 'Type 2 Diabetes',             category: 'Endocrinology',    cases: 4, approvalRate: 92,   trend: '↑', trendColor: 'text-emerald-400' },
  { drug: 'Ozempic',            indication: 'Weight management',           category: 'Endocrinology',    cases: 3, approvalRate: 78,   trend: '↓', trendColor: 'text-red-400' },
  { drug: 'Esomeprazole Susp.', indication: 'Pediatric GERD',            category: 'Gastroenterology', cases: 2, approvalRate: 84,   trend: '→', trendColor: 'text-slate-400' },
  { drug: 'Livdelzi',           indication: 'Primary Biliary Cholangitis', category: 'Hepatology',       cases: 1, approvalRate: null, trend: '→', trendColor: 'text-slate-400' },
]
