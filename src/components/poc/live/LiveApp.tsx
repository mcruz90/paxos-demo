/**
 * Live-mode shell (rendered by App only when LIVE_MODE is set).
 *
 * The opt-in counterpart to the simulated POC: login gate → pick a fixture case
 * → stream a real appeal from the backend → an exception-tier run parks and
 * appears in the pending-review queue → resume it (approve as-is or edit) →
 * the queue clears. Everything is wired through the src/lib client; the
 * simulated flow (App's default path) is untouched and still fully offline.
 */
import { useEffect, useMemo, useState } from 'react'
import { LogOut } from 'lucide-react'
import { scenarios } from '../../../data/scenarios'
import { useLiveSession } from './useLiveSession'
import { useLiveAppeal } from './useLiveAppeal'
import { useLivePa } from './useLivePa'
import { usePendingQueue } from './usePendingQueue'
import { shouldRefreshQueue } from './queue'
import { isParked } from './appealEvents'
import { LoginForm } from './LoginForm'
import { CaseSelector } from './CaseSelector'
import { GenerateView } from './GenerateView'
import { PaResultView } from './PaResultView'
import { CaseContextPanel } from './CaseContextPanel'
import { PendingQueue } from './PendingQueue'
import { ResumeEditor } from './ResumeEditor'
import type { PendingReviewItem } from '../../../lib/wire'

const ALL_SCENARIOS = Object.values(scenarios)
const APPEAL_SCENARIOS = ALL_SCENARIOS.filter(s => s.lifecycle !== 'initial_pa')
const INITIAL_PA_SCENARIOS = ALL_SCENARIOS.filter(s => s.lifecycle === 'initial_pa')

export function LiveApp() {
  const { auth, doLogin, doLogout, expire } = useLiveSession()
  const session = auth.session

  if (!session) {
    return (
      <div className="flex h-screen bg-slate-950 text-white">
        <LoginForm onSubmit={doLogin} error={auth.error} expired={auth.expired} />
      </div>
    )
  }
  return <LiveWorkspace csrfToken={session.csrfToken} userId={session.userId} onLogout={doLogout} onExpire={expire} />
}

function LiveWorkspace({
  csrfToken,
  userId,
  onLogout,
  onExpire,
}: {
  csrfToken: string
  userId: string
  onLogout: () => void
  onExpire: () => void
}) {
  const appeal = useLiveAppeal(csrfToken, onExpire)
  const pa = useLivePa(csrfToken, onExpire)
  const queue = usePendingQueue(true, onExpire)
  const [selectedId, setSelectedId] = useState(APPEAL_SCENARIOS[0].id)
  const [resumeTarget, setResumeTarget] = useState<{ correlationId: string; draft: string } | null>(null)
  const [resumeBusy, setResumeBusy] = useState(false)

  const selected = useMemo(() => ALL_SCENARIOS.find(s => s.id === selectedId)!, [selectedId])
  const isInitialPa = selected.lifecycle === 'initial_pa'
  const streaming = isInitialPa ? pa.state.status === 'streaming' : appeal.state.status === 'streaming'

  const onSelect = (id: string) => {
    setSelectedId(id)
    appeal.reset()
    pa.reset()
    setResumeTarget(null)
  }
  const onGenerate = () => { if (isInitialPa) void pa.run(selected); else void appeal.run(selected) }

  // A run that parks (exception tier) becomes the review target and shows up in
  // the queue — refresh so the reviewer sees it land.
  const parkedId = isParked(appeal.state) ? appeal.state.correlationId : null
  useEffect(() => {
    if (!parkedId) return
    setResumeTarget({ correlationId: parkedId, draft: appeal.state.letter })
    void queue.refresh()
    // appeal.state.letter is captured with parkedId; queue.refresh is stable.
  }, [parkedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const openFromQueue = (item: PendingReviewItem) => {
    const draft = appeal.state.correlationId === item.correlation_id ? appeal.state.letter : ''
    setResumeTarget({ correlationId: item.correlation_id, draft })
  }

  const handleResume = async (editedText: string | null) => {
    if (!resumeTarget) return
    setResumeBusy(true)
    const result = await appeal.resume(resumeTarget.correlationId, editedText, csrfToken)
    setResumeBusy(false)
    // On an error terminal (e.g. double-resume) or transport failure the run is
    // still parked — keep the editor open so the reviewer's edits aren't lost;
    // the error surfaces via appeal.state.error in the panel below.
    if (!shouldRefreshQueue(result)) return
    queue.drop(resumeTarget.correlationId)
    await queue.refresh()
    setResumeTarget(null)
  }

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div className="px-8 py-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold font-display text-white">ClearAuth — live pipeline</h1>
            <p className="text-sm text-slate-400 mt-0.5">Signed in as {userId}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>

        <div className="p-8 flex gap-6 items-start">
          <div className="flex-1 min-w-0 space-y-5">
            <CaseSelector
              appeals={APPEAL_SCENARIOS}
              initialPas={INITIAL_PA_SCENARIOS}
              selectedId={selectedId}
              streaming={streaming}
              buttonLabel={isInitialPa ? 'Submit PA' : 'Generate appeal'}
              onSelect={onSelect}
              onGenerate={onGenerate}
            />
            {isInitialPa ? <PaResultView state={pa.state} /> : <GenerateView state={appeal.state} />}
            <CaseContextPanel scenario={selected} />
            {!isInitialPa && resumeTarget && (
              <ResumeEditor
                key={resumeTarget.correlationId}
                correlationId={resumeTarget.correlationId}
                draft={resumeTarget.draft}
                busy={resumeBusy}
                error={appeal.state.status === 'error' ? appeal.state.error : null}
                onResume={handleResume}
              />
            )}
          </div>
          <div className="w-80 shrink-0">
            <PendingQueue
              reviews={queue.reviews}
              activeId={resumeTarget?.correlationId ?? null}
              onOpen={openFromQueue}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
