/**
 * The single live-mode switch (architect ruling, Sprint FI Slice 4).
 *
 * Live integration is opt-in: active only when `VITE_API_BASE_URL` is set at
 * build/dev time. Unset (the default, and every static demo deploy) → the
 * simulated POC flow runs unchanged and fully offline. This is the one place
 * the mode is decided; components never branch on it themselves.
 */
export const LIVE_MODE: boolean = !!import.meta.env.VITE_API_BASE_URL
