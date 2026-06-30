import { useState, useEffect } from 'react'
import { Joyride, EVENTS, STATUS, ACTIONS } from 'react-joyride'
import { type CaseStatus, type Client, type ScenarioConfig, type View, type Role } from './types'
import { initialClients, newCaseRef, scenarios } from './data/scenarios'
import { JOYRIDE_STYLES, TOURS, type TourId, type TourStep } from './components/tour'
import { LandingHub } from './components/LandingHub'
import { AgentInstructionsView, useInstructionStore } from './components/instructions'
import { EvalDashboard } from './components/EvalDashboard'
import { OnboardingView } from './components/OnboardingView'
import { PlatformView } from './components/PlatformView'
import { EvalRubricView } from './components/EvalRubricView'
import { WorkflowSpecView } from './components/WorkflowSpecView'
import { FailureReviewView } from './components/FailureReviewView'
import { Sidebar } from './components/Sidebar'
import { SponsorView } from './components/SponsorView'
import { PortfolioView } from './components/PortfolioView'
import { AutomationPolicyView } from './components/AutomationPolicyView'
import { POCView } from './components/poc/POCView'
import { LibraryView } from './components/LibraryView'

// Maps each view to the role that owns it — used to keep the sidebar in sync
// when tours or internal navigation jump across role boundaries.
const VIEW_ROLE: Record<View, Role> = {
  landing:      'Operate',
  portfolio:    'Operate',
  poc:          'Operate',
  evals:        'Operate',
  automation:   'Operate',
  library:      'Build',
  specs:        'Build',
  instructions: 'Build',
  rubric:       'Build',
  failures:     'Build',
  onboarding:   'Scale',
  platform:     'Scale',
  sponsor:      'Sponsor',
}

// Default first view for each role (used when switching roles via the role switcher)
const ROLE_DEFAULT_VIEW: Record<Role, View> = {
  Operate: 'portfolio',
  Build:   'library',
  Scale:   'onboarding',
  Sponsor: 'sponsor',
}

// Tour id → which role it belongs to (so selecting a tour also sets the correct role)
const TOUR_ROLE: Record<string, Role> = {
  operate:  'Operate',
  build:    'Build',
  scale:    'Scale',
  overview: 'Operate',
}

export default function App() {
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

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <Joyride
        steps={activeTour ? TOURS[activeTour].steps : TOURS.overview.steps}
        run={tourRunning}
        stepIndex={tourStepIndex}
        onEvent={handleJoyrideCallback as Parameters<typeof Joyride>[0]['onEvent']}
        continuous
        scrollToFirstStep
        styles={JOYRIDE_STYLES}
        options={{
          arrowColor: '#1e293b',
          backgroundColor: '#1e293b',
          overlayColor: 'rgba(2, 6, 23, 0.6)',
          primaryColor: '#10b981',
          textColor: '#cbd5e1',
          zIndex: 200,
          width: 400,
          buttons: ['back', 'primary', 'skip'],
          showProgress: true,
          overlayClickAction: false,
          skipBeacon: true,
        }}
      />
      <Sidebar view={view} setView={setView} activeRole={activeRole} onRoleChange={handleRoleChange} onStartTour={openTourHub} theme={theme} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
      {view === 'landing' && (
        <LandingHub onStartTour={startTour} onRoleChange={handleRoleChange} />
      )}
      {view === 'portfolio' && (
        <PortfolioView clients={clients} onOpenCase={openCase} onStartTour={openTourHub} />
      )}
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
  )
}
