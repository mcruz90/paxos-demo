import { Zap } from 'lucide-react'
import { usePoc } from './PocContext'
import { InlineProgress } from './InlineProgress'

export function PipelineStartPanel() {
  const { scenario, phase, stepIdx, pipelineSteps, handleExecute } = usePoc()
  const isInitialPa = scenario.lifecycle === 'initial_pa'
  return (
    <>
      {phase === 'idle' && (
        <button id="tour-execute-btn" onClick={handleExecute}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors">
          <Zap className="w-4 h-4" />Execute Full Pipeline
        </button>
      )}
      {phase === 'loading' && (
        <div className="space-y-4">
          <InlineProgress
            steps={pipelineSteps}
            currentStep={stepIdx}
            variant="blue"
            label={isInitialPa ? "Assembling PA Request" : "Generating Appeal"}
          />
        </div>
      )}
    </>
  )
}
