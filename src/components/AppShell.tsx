import { useState, useEffect } from 'react'
import { Joyride, EVENTS, STATUS, ACTIONS } from 'react-joyride'
import { type CaseStatus, type Client, type ScenarioConfig, type View, type Role } from '../types'
import { initialClients, newCaseRef, scenarios } from '../data/scenarios'
import { buildManifest, shellModeBadge } from '../capabilities'
import { JOYRIDE_OPTIONS, JOYRIDE_STYLES, TOURS, TOUR_ROLE, type TourId, type TourStep } from './tour'
import { LandingHub } from './LandingHub'
import { AgentInstructionsView, useInstructionStore } from './instructions'
import { EvalDashboard } from './EvalDashboard'
import { OnboardingView } from './OnboardingView'
import { PlatformView } from './PlatformView'
import { EvalRubricView } from './EvalRubricView'
import { WorkflowSpecView } from './WorkflowSpecView'
import { FailureReviewView } from './FailureReviewView'
import { ConceptBInspectorView } from './ConceptBInspectorView'
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
import { type LiveShellSession } from './live/SessionGate'

// Single product shell (ADR-0016):
// - Operate uses the Epic Hyperspace clinical light/slate default, auto-collapses
//   the outer nav into a slim icon rail when a patient chart opens, and stays
//   100% free of engineering/evals chrome.
// - Build houses Concept B (Live Trace & Evals Inspector + PII-Redacted Tokenizer)
//   in a dark-slate engineering theme.
export function AppShell({ live }: { live?: LiveShellSession }) {
  const manifest = buildManifest(!!live)
  const modeBadge = shellModeBadge(!!live)

  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  const [view, setView] = useState<View>('portfolio')
  const [activeRole, setActiveRole] = useState<Role>('Operate')
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [activeScenario, setActiveScenario] = useState<ScenarioConfig | null>(null)
  const [reviewMode, setReviewMode] = useState(false)
  const [openedCaseStatus, setOpenedCaseStatus] = useState<CaseStatus | null>(null)
  const [inspectScenarioId, setInspectScenarioId] = useState<string>('gilead-livdelzi')
  const [activeTour, setActiveTour] = useState<TourId | null>(null)
  const [tourRunning, setTourRunning] = useState(false)
  const [tourStepIndex, setTourStepIndex] = useState(0)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const instrStore = useInstructionStore()

  // Switching roles navigates to that role's default view and applies the
  // persona-matched theme default (Light/Slate Epic for Operate, Dark-Slate for Build).
  const handleRoleChange = (role: Role) => {
    setActiveRole(role)
    setView(ROLE_DEFAULT_VIEW[role])
    setActiveScenario(null)
    setReviewMode(false)
    setOpenedCaseStatus(null)
    setIsSidebarCollapsed(false)
    if (role === 'Operate') setTheme('light')
    else if (role === 'Build') setTheme('dark')
  }

  const handleSetView = (nextView: View) => {
    setView(nextView)
    if (nextView !== 'portfolio') {
      setIsSidebarCollapsed(false)
    }
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
    setTheme('light')
    setIsSidebarCollapsed(false)
  }

  const handleQuickApprove = (scenarioId: string) =>
    setClients(prev => quickApproveClient(prev, scenarioId))
  const handleBatchApproveReady = () =>
    setClients(prev => prev.map(c => c.status === 'ready_for_review' ? { ...c, status: 'submitted' as CaseStatus } : c))
  const handlePayerDecision = (scenarioId: string, decision: 'accepted' | 'disputed') =>
    setClients(prev => applyPayerDecision(prev, scenarioId, decision))
  const handleUpdateClientStatus = (scenarioId: string, status: CaseStatus) =>
    setClients(prev => setClientStatus(prev, scenarioId, status))

  const handleInspectInBuild = (scenarioId: string) => {
    setInspectScenarioId(scenarioId)
    setActiveRole('Build')
    setTheme('dark')
    setIsSidebarCollapsed(false)
    setView('inspector')
  }

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
    const nextRole = VIEW_ROLE[nav.view]
    setView(nav.view)
    setActiveRole(nextRole)
    if (nextRole === 'Operate') setTheme('light')
    else if (nextRole === 'Build') setTheme('dark')
  }

  const openTourHub = () => {
    setIsSidebarCollapsed(false)
    setView('landing')
  }

  const endTour = () => {
    setTourRunning(false)
    setActiveTour(null)
    setTourStepIndex(0)
  }

  const startTour = (id: TourId) => {
    setIsSidebarCollapsed(false)
    setActiveTour(id)
    const role = TOUR_ROLE[id] ?? 'Operate'
    setActiveRole(role)
    if (role === 'Operate') setTheme('light')
    else if (role === 'Build') setTheme('dark')
    applyTourNav(TOURS[id].steps[0]?.nav)
    setTourStepIndex(0)
    setTourRunning(true)
  }

  const handleJoyrideCallback = (data: { action: string; index: number; status: string; type: string }) => {
    const { action, index, status, type } = data

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      endTour()
      return
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      if (action === ACTIONS.CLOSE) { endTour(); return }

      const isNext = action === ACTIONS.NEXT
      const isPrev = action === ACTIONS.PREV
      if (!isNext && !isPrev) return

      const steps = activeTour ? TOURS[activeTour].steps : []
      const next = index + (isNext ? 1 : -1)
      const nextStep = steps[next]
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
      onBatchApproveReady={handleBatchApproveReady}
      onPayerDecision={handlePayerDecision}
      onUpdateClientStatus={handleUpdateClientStatus}
      generateCap={manifest.O4_generate}
      live={live}
      onCaseOpenChange={setIsSidebarCollapsed}
      onInspectInBuild={handleInspectInBuild}
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
        modeBadge={modeBadge}
        liveSession={live ? { userId: live.userId, onLogout: live.onLogout } : undefined}
      />
      <div className="flex flex-1 overflow-hidden">
      <Sidebar
        view={view}
        setView={handleSetView}
        activeRole={activeRole}
        onStartTour={openTourHub}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        modeBadge={modeBadge}
      />
      {view === 'landing' && (
        <LandingHub onStartTour={startTour} onRoleChange={handleRoleChange} />
      )}
      {view === 'portfolio' && portfolioEl}
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
        <BuildOverview setView={handleSetView} />
      )}
      {view === 'library' && (
        <LibraryView setView={handleSetView} />
      )}
      {view === 'evals' && (
        <EvalDashboard mode="coordinator_only" />
      )}
      {view === 'automation' && (
        <AutomationPolicyView />
      )}
      {view === 'onboarding' && (
        <OnboardingView setView={handleSetView} />
      )}
      {view === 'platform' && (
        <PlatformView setView={handleSetView} />
      )}
      {view === 'sponsor' && (
        <SponsorView />
      )}
      {view === 'failures' && (
        <FailureReviewView setView={handleSetView} store={instrStore} />
      )}
      {view === 'specs' && (
        <WorkflowSpecView />
      )}
      {view === 'instructions' && (
        <AgentInstructionsView store={instrStore} />
      )}
      {view === 'rubric' && (
        <EvalRubricView setView={handleSetView} onOpenCase={openCase} />
      )}
      {view === 'inspector' && (
        <ConceptBInspectorView
          selectedScenarioId={inspectScenarioId}
          onSelectScenarioId={setInspectScenarioId}
          live={live}
          manifest={manifest}
        />
      )}
      </div>
    </div>
  )
}
