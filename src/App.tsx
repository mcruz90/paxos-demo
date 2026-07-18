import { DEV_CONSOLE, LIVE_MODE } from './components/poc/live/liveMode'
import { LiveApp } from './components/poc/live/LiveApp'
import { SessionGate } from './components/live/SessionGate'
import { AppShell } from './components/AppShell'

// The one mode switch (ADR-0016 over the liveMode.ts seam). All three
// branches are build/URL constants, so hook order is stable across renders:
// - demo (default, every static deploy): the shell on fixture data, unchanged;
// - live: session gate, then the same shell with live units per the
//   capability manifest;
// - live + ?console=dev: the demoted LiveApp developer console.
export default function App() {
  if (!LIVE_MODE) return <AppShell />
  if (DEV_CONSOLE) return <LiveApp />
  return <SessionGate>{live => <AppShell live={live} />}</SessionGate>
}
