export {
  TOURS,
  TOUR_ROLE,
  tc,
  tl,
  type TourAccent,
  type TourId,
  type TourMeta,
  type TourNav,
  type TourStep,
} from './tourSteps'

// Joyride chrome shared by every tour (colors, overlay, buttons) — kept beside
// JOYRIDE_STYLES so the shell only wires state, not presentation.
export const JOYRIDE_OPTIONS: Partial<import('react-joyride').Options> = {
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
}

export const JOYRIDE_STYLES: import('react-joyride').PartialDeep<import('react-joyride').Styles> = {
  tooltip: {
    borderRadius: 12,
    backgroundColor: '#0f172a',
    border: '1px solid rgba(51,65,85,0.9)',
    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
    padding: 0,
  },
  tooltipTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#f1f5f9',
    padding: '18px 18px 10px',
    margin: 0,
  },
  tooltipContent: {
    padding: '0 18px 4px',
  },
  tooltipFooter: {
    padding: '12px 18px 16px',
    marginTop: 0,
  },
  buttonPrimary: {
    backgroundColor: '#4c1d95',
    color: '#ffffff',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    padding: '7px 14px',
  },
  buttonBack: {
    color: '#64748b',
    fontSize: 13,
    marginRight: 4,
  },
  buttonSkip: {
    color: '#475569',
    fontSize: 12,
  },
  buttonClose: {
    color: '#475569',
  },
}
