import { Fragment, useState } from 'react'
import { Building2, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { type View } from '../types'
import { ONBOARD_STEPS, ONBOARDING_TEMPLATES } from './onboardingData'
import { ClientProfileStep, CoverageScopeStep, DataSourcesStep, FieldMappingStep, ReviewTiersStep } from './OnboardingSteps'
import { ValidateLaunchStep } from './OnboardingValidateStep'
import { RoleChip } from './ui'

export {
  CATEGORY_CLS, CONNECTORS, getSamplePayloadPreview, ONBOARD_STEPS, ONBOARDING_TEMPLATES,
  type Connector, type FieldMapping, type OnboardingTemplate,
} from './onboardingData'
export { ConfidencePill } from './OnboardingSteps'

function OnboardingStepper({ stepIdx, onSelectStep }: { stepIdx: number; onSelectStep: (idx: number) => void }) {
  return (
    <div className="px-8 pt-6">
      <div className="flex items-center max-w-4xl">
        {ONBOARD_STEPS.map((label, i) => {
          const done = i < stepIdx
          const current = i === stepIdx
          return (
            <Fragment key={label}>
              {i > 0 && <div className={`flex-1 h-px ${i <= stepIdx ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />}
              <button onClick={() => i <= stepIdx && onSelectStep(i)} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 text-xs font-semibold transition-colors ${
                  done ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : current ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}>
                  {done ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-[10px] font-medium whitespace-nowrap ${current ? 'text-white' : 'text-slate-500'}`}>{label}</span>
              </button>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

export function OnboardingView({ setView }: { setView: (v: View) => void }) {
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [selectedConnectors, setSelectedConnectors] = useState<Set<string>>(new Set())
  const [validating, setValidating] = useState(false)
  const [validated, setValidated] = useState(false)
  const [launched, setLaunched] = useState(false)

  const template = templateId ? ONBOARDING_TEMPLATES.find(t => t.id === templateId) ?? null : null
  const pickTemplate = (id: string) => {
    const t = ONBOARDING_TEMPLATES.find(tpl => tpl.id === id)!
    setTemplateId(id); setSelectedConnectors(new Set(t.connectorIds)); setValidated(false)
  }
  const toggleConnector = (id: string) =>
    setSelectedConnectors(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const runValidation = () => {
    setValidating(true)
    setTimeout(() => { setValidating(false); setValidated(true) }, 1400)
  }
  const canAdvance = stepIdx === 0 ? !!template : true

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-display text-white">Onboard a New Client</h1>
          <p className="text-sm text-slate-400 mt-0.5">Configure reusable platform components — zero bespoke pipeline code</p>
        </div>
        <div className="flex items-center gap-2">
          <RoleChip layer="scale" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40">
            <Building2 className="w-3.5 h-3.5 text-slate-500" /><span className="text-xs text-slate-400">ClearAuth Implementation Team</span>
          </div>
        </div>
      </div>

      <OnboardingStepper stepIdx={stepIdx} onSelectStep={setStepIdx} />

      <div className="px-8 py-6">
        {stepIdx === 0 && <ClientProfileStep templateId={templateId} onPick={pickTemplate} />}
        {stepIdx === 1 && template && <DataSourcesStep template={template} selectedConnectors={selectedConnectors} onToggle={toggleConnector} />}
        {stepIdx === 2 && template && <FieldMappingStep template={template} />}
        {stepIdx === 3 && template && <CoverageScopeStep template={template} setView={setView} />}
        {stepIdx === 4 && template && <ReviewTiersStep template={template} setView={setView} />}
        {stepIdx === 5 && template && (
          <ValidateLaunchStep
            template={template} validating={validating} validated={validated} launched={launched}
            onRunValidation={runValidation} onLaunch={() => setLaunched(true)} setView={setView}
          />
        )}
        {!launched && (
          <div className="flex gap-3 pt-8 mt-2 border-t border-slate-800">
            {stepIdx > 0 && (
              <button onClick={() => setStepIdx(stepIdx - 1)} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors">
                <ChevronLeft className="w-4 h-4" />Back
              </button>
            )}
            {stepIdx < ONBOARD_STEPS.length - 1 && (
              <button
                onClick={() => canAdvance && setStepIdx(stepIdx + 1)} disabled={!canAdvance}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors ml-auto"
              >
                Next<ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
