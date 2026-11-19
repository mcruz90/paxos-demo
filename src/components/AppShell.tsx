import { useEffect, useState } from 'react'
import { ACTIONS, EVENTS, Joyride, STATUS } from 'react-joyride'
import { buildManifest, shellModeBadge } from '../capabilities'
import { initialClients, scenarios } from '../data/scenarios'
import { type CaseStatus, type Client, type Role, type View } from '../types'
import { AgentInstructionsView, useInstructionStore } from './instructions'
import { AutomationPolicyView } from './AutomationPolicyView'
import { BuildOverview } from './BuildOverview'
import { ConceptBInspectorView } from './ConceptBInspectorView'
import { EvalDashboard } from './EvalDashboard'
import { EvalRubricView } from './EvalRubricView'
import { FailureReviewView } from './FailureReviewView'
import { LandingHub } from './LandingHub'
import { LibraryView } from './LibraryView'
import { CapabilityChip } from './live/CapabilityChip'
import { LiveOpsRail } from './live/LiveOpsRail'
import { type LiveShellSession } from './live/SessionGate'
import { ROLE_DEFAULT_VIEW, VIEW_ROLE } from './navConfig'
import { OnboardingView } from './OnboardingView'
import { PlatformView } from './PlatformView'
import { applyPayerDecision, quickApproveClient, resolveSidebarNav, setClientStatus } from './portfolio/caseQueue'
import { SplitPortfolioView } from './portfolio/SplitPortfolioView'
import { Sidebar } from './Sidebar'
import { SponsorView } from './SponsorView'
import { Topbar } from './Topbar'
import { JOYRIDE_OPTIONS, JOYRIDE_STYLES, TOURS, TOUR_ROLE, type TourId, type TourStep } from './tour'
import { WorkflowSpecView } from './WorkflowSpecView'

function ShellViewRouter({
  view, portfolioEl, handleSetView, openCase, instrStore, startTour, handleRoleChange,
  inspectScenarioId, setInspectScenarioId, handleInspectInBuild, live, manifest,
}: {
  view: View
  portfolioEl: React.ReactNode
  handleSetView: (v: View) => void
  openCase: (sid: string, status: CaseStatus) => void
  instrStore: ReturnType<typeof useInstructionStore>
  startTour: (id: TourId) => void
  handleRoleChange: (r: Role) => void
  inspectScenarioId: string
  setInspectScenarioId: (sid: string) => void
  handleInspectInBuild: (sid: string) => void
  live?: LiveShellSession
  manifest: ReturnType<typeof buildManifest>
}) {
  switch (view) {
    case 'landing':      return <LandingHub onStartTour={startTour} onRoleChange={handleRoleChange} />
    case 'portfolio':
    case 'poc':          return <>{portfolioEl}</>
    case 'build_home':   return <BuildOverview setView={handleSetView} />
    case 'library':      return <LibraryView setView={handleSetView} />
    case 'evals':        return <EvalDashboard mode="coordinator_only" onOpenCase={openCase} />
    case 'automation':   return <AutomationPolicyView onOpenCase={openCase} />
    case 'onboarding':   return <OnboardingView setView={handleSetView} />
    case 'platform':     return <PlatformView setView={handleSetView} />
    case 'sponsor':      return <SponsorView />
    case 'failures':     return <FailureReviewView setView={handleSetView} store={instrStore} onInspectScenario={handleInspectInBuild} />
    case 'specs':        return <WorkflowSpecView onInspectScenario={handleInspectInBuild} />
    case 'instructions': return <AgentInstructionsView store={instrStore} />
    case 'rubric':       return <EvalRubricView setView={handleSetView} onOpenCase={openCase} onInspectScenario={handleInspectInBuild} />
    case 'inspector':
      return <ConceptBInspectorView selectedScenarioId={inspectScenarioId} onSelectScenarioId={setInspectScenarioId} live={live} manifest={manifest} />
  }
}

// The single product shell (ADR-0016). In demo mode (`live` absent — every
// static deploy) this renders simulated fixtures. In live mode the SessionGate
// mounts it with a session, and the capability manifest decides which live units
// compose in — the shell is the only layer that branches on the manifest;
// units never branch on mode themselves.
export function AppShell({ live }: { live?: LiveShellSession }) {
  const manifest = buildManifest(!!live)
  const modeBadge = shellModeBadge(!!live)
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  useEffect(() => { document.documentElement.classList.toggle('light', theme === 'light') }, [theme])

  const [view, setView] = useState<View>('landing')
  const [activeRole, setActiveRole] = useState<Role>('Operate')
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [portfolioScenarioOverride, setPortfolioScenarioOverride] = useState<string | null | undefined>(undefined)
  const [queueResetNonce, setQueueResetNonce] = useState(0)
  const [inspectScenarioId, setInspectScenarioId] = useState<string>('gilead-livdelzi')
  const [activeTour, setActiveTour] = useState<TourId | null>(null)
  const [tourRunning, setTourRunning] = useState(false)
  const [tourStepIndex, setTourStepIndex] = useState(0)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const instrStore = useInstructionStore()

  // Switching roles navigates to that role's default first view without overriding user theme choice.
  const handleRoleChange = (role: Role) => {
    setActiveRole(role); setView(ROLE_DEFAULT_VIEW[role]); setPortfolioScenarioOverride(undefined); setIsSidebarCollapsed(false)
  }

  const handleSetView = (nextView: View) => {
    const nav = resolveSidebarNav(nextView, portfolioScenarioOverride, queueResetNonce)
    setPortfolioScenarioOverride(nav.override)
    setQueueResetNonce(nav.resetNonce)
    if (!nav.collapseSidebar) setIsSidebarCollapsed(false)
    setView(nextView)
  }

  // Portfolio / Eval deep-link → opens the unified SplitPortfolioView chart workspace;
  // cases import automatically with no manual-intake path.
  const openCase = (scenarioId: string, _status: CaseStatus) => {
    if (!scenarios[scenarioId]) return
    setPortfolioScenarioOverride(scenarioId); setActiveRole('Operate'); setView('portfolio')
  }

  // Case-status transitions from the queue's preview pane — the guarded state
  // machine lives in portfolio/caseQueue.ts, unit-tested there.
  const handleQuickApprove = (scenarioId: string) => setClients(prev => quickApproveClient(prev, scenarioId))
  const handlePayerDecision = (scenarioId: string, decision: 'accepted' | 'disputed') => setClients(prev => applyPayerDecision(prev, scenarioId, decision))
  const handleUpdateClientStatus = (scenarioId: string, status: CaseStatus) => setClients(prev => setClientStatus(prev, scenarioId, status))

  const handleInspectInBuild = (scenarioId: string) => {
    setInspectScenarioId(scenarioId); setActiveRole('Build'); setIsSidebarCollapsed(false); setView('inspector')
  }

  // Apply a step's nav: make the right view (and case) active before the step shows.
  // Also syncs activeRole so the sidebar reflects the correct role during tours.
  const applyTourNav = (nav?: TourStep['nav']) => {
    if (!nav) return
    if (nav.view === 'portfolio' || nav.view === 'poc') setPortfolioScenarioOverride(nav.scenarioId ?? null)
    else if (nav.scenarioId) setInspectScenarioId(nav.scenarioId)
    const targetView = nav.view === 'poc' ? 'portfolio' : nav.view
    setView(targetView); setActiveRole(VIEW_ROLE[targetView])
  }

  const openTourHub = () => { setIsSidebarCollapsed(false); setView('landing') }
  const endTour = () => { setTourRunning(false); setActiveTour(null); setTourStepIndex(0) }
  const startTour = (id: TourId) => {
    setIsSidebarCollapsed(false); setActiveTour(id); setActiveRole(TOUR_ROLE[id] ?? 'Operate')
    applyTourNav(TOURS[id].steps[0]?.nav); setTourStepIndex(0); setTourRunning(true)
  }

  // Generic driver: on advance, apply the next step's nav, then move the index.
  const handleJoyrideCallback = (data: { action: string; index: number; status: string; type: string }) => {
    const { action, index, status, type } = data
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) { endTour(); return }
    if (type !== EVENTS.STEP_AFTER && type !== EVENTS.TARGET_NOT_FOUND) return
    if (action === ACTIONS.CLOSE) { endTour(); return }
    const isNext = action === ACTIONS.NEXT
    if (!isNext && action !== ACTIONS.PREV) return
    const next = index + (isNext ? 1 : -1)
    const nextStep = (activeTour ? TOURS[activeTour].steps : [])[next]
    if (!nextStep) { if (isNext) endTour(); return }
    const nav = nextStep.nav
    const targetView = nav?.view === 'poc' ? 'portfolio' : nav?.view
    if (nav && (targetView !== view || (nav.scenarioId ?? null) !== (portfolioScenarioOverride ?? null))) {
      applyTourNav(nav); setTimeout(() => setTourStepIndex(next), 350)
    } else setTourStepIndex(next)
  }

  const basePortfolio = (
    <SplitPortfolioView
      clients={clients} onOpenCase={openCase} onQuickApprove={handleQuickApprove} onPayerDecision={handlePayerDecision}
      onUpdateClientStatus={handleUpdateClientStatus} generateCap={manifest.O4_generate} live={live}
      onCaseOpenChange={setIsSidebarCollapsed} onInspectInBuild={handleInspectInBuild} activeScenarioOverride={portfolioScenarioOverride} queueResetNonce={queueResetNonce}
    />
  )

  // Live mode: the fixture queue wears its SIMULATED label and the slice-1
  // live units (O7 queue, O5 resume, B8 audit) rail alongside.
  const portfolioEl = live ? (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-1.5 border-b border-slate-800 flex items-center gap-2 text-xs text-slate-400">
        <CapabilityChip cap={manifest.O7_portfolio_queue_sim} />
        Fixture-driven case queue — not live backend data
      </div>
      <div className="flex-1 flex overflow-hidden min-h-0">
        {basePortfolio}
        <LiveOpsRail manifest={manifest} live={live} />
      </div>
    </div>
  ) : basePortfolio

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
      <Joyride steps={activeTour ? TOURS[activeTour].steps : TOURS.overview.steps} run={tourRunning} stepIndex={tourStepIndex}
        onEvent={handleJoyrideCallback as Parameters<typeof Joyride>[0]['onEvent']} continuous scrollToFirstStep styles={JOYRIDE_STYLES} options={JOYRIDE_OPTIONS} />
      <Topbar activeRole={activeRole} onRoleChange={handleRoleChange} theme={theme} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        onStartTour={openTourHub} modeBadge={modeBadge} liveSession={live ? { userId: live.userId, onLogout: live.onLogout } : undefined} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar view={view} setView={handleSetView} activeRole={activeRole} onStartTour={openTourHub}
          isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} modeBadge={modeBadge} />
        <ShellViewRouter view={view} portfolioEl={portfolioEl} handleSetView={handleSetView} openCase={openCase}
          instrStore={instrStore} startTour={startTour} handleRoleChange={handleRoleChange} inspectScenarioId={inspectScenarioId}
          setInspectScenarioId={setInspectScenarioId} handleInspectInBuild={handleInspectInBuild} live={live} manifest={manifest} />
      </div>
    </div>
  )
}
