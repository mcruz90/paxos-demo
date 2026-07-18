import { useState, useEffect } from 'react'
import { Joyride, EVENTS, STATUS, ACTIONS } from 'react-joyride'
import { type CaseStatus, type Client, type ScenarioConfig, type View, type Role } from '../types'
import { initialClients, newCaseRef, scenarios } from '../data/scenarios'
import { buildManifest } from '../capabilities'
import { JOYRIDE_OPTIONS, JOYRIDE_STYLES, TOURS, TOUR_ROLE, type TourId, type TourStep } from './tour'
import { LandingHub } from './LandingHub'
import { AgentInstructionsView, useInstructionStore } from './instructions'
import { EvalDashboard } from './EvalDashboard'
import { OnboardingView } from './OnboardingView'
import { PlatformView } from './PlatformView'
import { EvalRubricView } from './EvalRubricView'
import { WorkflowSpecView } from './WorkflowSpecView'
import { FailureReviewView } from './FailureReviewView'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { SponsorView } from './SponsorView'
import { SplitPortfolioView } from './portfolio/SplitPortfolioView'
import { applyPayerDecision, quickApproveClient, setClientStatus } from './portfolio/caseQueue'
import { AutomationPolicyView } from './AutomationPolicyView'
import { POCView } from './poc/POCView'
import { BuildOverview } from './BuildOverview'
import { LibraryView } from './LibraryView'
import { VIEW_ROLE, ROLE_DEFAULT_VIEW } from './navConfig'
import { CapabilityChip } from './live/CapabilityChip'
import { LiveOpsRail } from './live/LiveOpsRail'
import { type LiveShellSession } from './live/SessionGate'

// The single product shell (ADR-0016). In demo mode (`live` absent — every
// static deploy) this is exactly the pre-ADR-0016 tree. In live mode the
// SessionGate mounts it with a session, and the capability manifest decides
// which live units compose in — the shell is the only layer that branches on
// the manifest; units never branch on mode themselves.
export function AppShell({ live }: { live?: LiveShellSession }) {
  const manifest = buildManifest(!!live)

  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  const [view, setView] = useState<View>('landing')
  const [activeRole, setActiveRole] = useState<Role>('Operate')
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [activeScenario, setActiveScenario] = useState<ScenarioConfig | null>(null)
  const [reviewMode, setReviewMode] = useState(false)
  const [openedCaseStatus, setOpenedCaseStatus] = useState<CaseStatus | null>(null)
  const [activeTour, setActiveTour] = useState<TourId | null>(null)
  const [tourRunning, setTourRunning] = useState(false)
  const [tourStepIndex, setTourStepIndex] = useState(0)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const instrStore = useInstructionStore()

  // Switching roles navigates to that role's default first view
  const handleRoleChange = (role: Role) => {
    setActiveRole(role)
    setView(ROLE_DEFAULT_VIEW[role])
    setActiveScenario(null)
    setReviewMode(false)
    setOpenedCaseStatus(null)
  }
  const addToPortfolio = (scenario: ScenarioConfig) => {
    const now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const name = scenario.clientType === 'patient'
      ? `Case #${newCaseRef()}`
      : scenario.manufacturer
    setClients(prev => [...prev, {
      id: Date.now(),
      name,
      drug: scenario.drug.split(' ')[0],
      categoryLabel: scenario.categoryLabel,
      status: (scenario.criteriaResults.some(r => r.status === 'needs_review' || r.status === 'conflict') ? 'exception' : 'ready_for_review') as CaseStatus,
      clientType: scenario.clientType,
      lastUpdated: now,
      scenarioId: scenario.id,
      deadline: 'Due soon',
      urgency: 'soon',
    }])
    setActiveScenario(null)
    setReviewMode(false)
    setView('portfolio')
  }

  // Portfolio click → open the case in POC review mode (coordinator reviews the AI's
  // completed work). Cases import automatically; there is no manual-intake path.
  const openCase = (scenarioId: string, status: CaseStatus) => {
    const scenario = scenarios[scenarioId]
    if (!scenario) return
    setActiveScenario(scenario)
    setReviewMode(true)
    setOpenedCaseStatus(status)
    setView('poc')
  }

  const handleReset = () => {
    setActiveScenario(null)
    setReviewMode(false)
    setOpenedCaseStatus(null)
    setView('portfolio')
    setActiveRole('Operate')
  }

  // Case-status transitions from the queue's preview pane — the guarded state
  // machine lives in portfolio/caseQueue.ts, unit-tested there.
  const handleQuickApprove = (scenarioId: string) =>
    setClients(prev => quickApproveClient(prev, scenarioId))
  const handlePayerDecision = (scenarioId: string, decision: 'accepted' | 'disputed') =>
    setClients(prev => applyPayerDecision(prev, scenarioId, decision))
  const handleUpdateClientStatus = (scenarioId: string, status: CaseStatus) =>
    setClients(prev => setClientStatus(prev, scenarioId, status))

  // Apply a step's nav: make the right view (and case) active before the step shows.
  // Also syncs activeRole so the sidebar reflects the correct role during tours.
  const applyTourNav = (nav?: TourStep['nav']) => {
    if (!nav) return
    if (nav.scenarioId) {
      const sc = scenarios[nav.scenarioId]
      if (!sc) {
        console.error(`[Tour] Unknown scenarioId "${nav.scenarioId}" — skipping nav`)
        return
      }
      setActiveScenario(sc)
      setReviewMode(!!nav.caseStatus)
      setOpenedCaseStatus(nav.caseStatus ?? null)
    } else {
      setActiveScenario(null)
      setReviewMode(false)
      setOpenedCaseStatus(null)
    }
    setView(nav.view)
    setActiveRole(VIEW_ROLE[nav.view])
  }

  const openTourHub = () => setView('landing')

  const endTour = () => {
    setTourRunning(false)
    setActiveTour(null)
    setTourStepIndex(0)
  }

  const startTour = (id: TourId) => {
    setIsSidebarCollapsed(false)
    setActiveTour(id)
    setActiveRole(TOUR_ROLE[id] ?? 'Operate')
    applyTourNav(TOURS[id].steps[0]?.nav)
    setTourStepIndex(0)
    setTourRunning(true)
  }

  // Generic driver: on advance, apply the next step's nav, then move the index
  // (delayed only when the view/case actually changes so the target can mount).
  const handleJoyrideCallback = (data: { action: string; index: number; status: string; type: string }) => {
    const { action, index, status, type } = data

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      endTour()
      return
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      // Close (X) button — end the tour and clear the overlay.
      if (action === ACTIONS.CLOSE) { endTour(); return }

      const isNext = action === ACTIONS.NEXT
      const isPrev = action === ACTIONS.PREV
      if (!isNext && !isPrev) return

      const steps = activeTour ? TOURS[activeTour].steps : []
      const next = index + (isNext ? 1 : -1)
      const nextStep = steps[next]
      // Past the last step (or before the first) — finish so the overlay clears.
      if (!nextStep) { if (isNext) endTour(); return }

      const nav = nextStep.nav
      const viewChanges = !!nav && (nav.view !== view || (nav.scenarioId ?? null) !== (activeScenario?.id ?? null))
      if (viewChanges) {
        applyTourNav(nav)
        setTimeout(() => setTourStepIndex(next), 350)
      } else {
        setTourStepIndex(next)
      }
    }
  }

  const portfolioEl = (
    <SplitPortfolioView
      clients={clients}
      onOpenCase={openCase}
      onQuickApprove={handleQuickApprove}
      onPayerDecision={handlePayerDecision}
      onUpdateClientStatus={handleUpdateClientStatus}
    />
  )

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
      <Joyride
        steps={activeTour ? TOURS[activeTour].steps : TOURS.overview.steps}
        run={tourRunning}
        stepIndex={tourStepIndex}
        onEvent={handleJoyrideCallback as Parameters<typeof Joyride>[0]['onEvent']}
        continuous
        scrollToFirstStep
        styles={JOYRIDE_STYLES}
        options={JOYRIDE_OPTIONS}
      />
      <Topbar
        activeRole={activeRole}
        onRoleChange={handleRoleChange}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        onStartTour={openTourHub}
      />
      <div className="flex flex-1 overflow-hidden">
      <Sidebar
        view={view}
        setView={setView}
        activeRole={activeRole}
        onStartTour={openTourHub}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      {view === 'landing' && (
        <LandingHub onStartTour={startTour} onRoleChange={handleRoleChange} />
      )}
      {/* Live mode: the fixture queue wears its SIMULATED label and the
          slice-1 live units (O7 queue, O5 resume, B8 audit) rail alongside.
          Demo mode renders the identical pre-ADR-0016 tree. */}
      {view === 'portfolio' && (live ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-1.5 border-b border-slate-800 flex items-center gap-2 text-xs text-slate-400">
            <CapabilityChip cap={manifest.O7_portfolio_queue_sim} />
            Fixture-driven case queue — not live backend data
          </div>
          <div className="flex-1 flex overflow-hidden min-h-0">
            {portfolioEl}
            <LiveOpsRail manifest={manifest} live={live} />
          </div>
        </div>
      ) : portfolioEl)}
      {view === 'poc' && activeScenario && (
        <POCView
          key={activeScenario.id}
          scenario={activeScenario}
          onReset={handleReset}
          reviewMode={reviewMode}
          caseStatus={openedCaseStatus ?? undefined}
          onStartAppeal={(scenarioId) => openCase(scenarioId, 'ready_for_review')}
          onSaveToPortfolio={
            clients.some(c => c.scenarioId === activeScenario.id)
              ? undefined
              : () => addToPortfolio(activeScenario)
          }
          onDispatchComplete={() => {
            setClients(prev => prev.map(c =>
              c.scenarioId === activeScenario.id && c.status === 'exception'
                ? { ...c, status: 'awaiting_documentation' as CaseStatus }
                : c
            ))
          }}
        />
      )}
      {view === 'build_home' && (
        <BuildOverview setView={setView} />
      )}
      {view === 'library' && (
        <LibraryView setView={setView} />
      )}
      {view === 'evals' && (
        <EvalDashboard />
      )}
      {view === 'automation' && (
        <AutomationPolicyView />
      )}
      {view === 'onboarding' && (
        <OnboardingView setView={setView} />
      )}
      {view === 'platform' && (
        <PlatformView setView={setView} />
      )}
      {view === 'sponsor' && (
        <SponsorView />
      )}
      {view === 'failures' && (
        <FailureReviewView setView={setView} store={instrStore} />
      )}
      {view === 'specs' && (
        <WorkflowSpecView />
      )}
      {view === 'instructions' && (
        <AgentInstructionsView store={instrStore} />
      )}
      {view === 'rubric' && (
        <EvalRubricView setView={setView} onOpenCase={openCase} />
      )}
      </div>
    </div>
  )
}
