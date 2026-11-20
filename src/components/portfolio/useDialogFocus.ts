import { type RefObject, useEffect, useRef } from 'react'

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function nextTrappedFocusIndex(currentIndex: number, total: number, shiftKey: boolean): number {
  if (total <= 0) return -1
  if (shiftKey) {
    return currentIndex <= 0 ? total - 1 : currentIndex - 1
  }
  return currentIndex < 0 || currentIndex >= total - 1 ? 0 : currentIndex + 1
}

function getVisibleFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    el => el.getClientRects().length > 0 && el.getAttribute('aria-hidden') !== 'true',
  )
}

export function useDialogFocus(
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  active = true,
) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!active) return
    const panel = dialogRef.current
    if (!panel) return

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const initialFocusables = getVisibleFocusables(panel)
    ;(initialFocusables[0] ?? panel).focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusables = getVisibleFocusables(panel)
      if (focusables.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const idx = current ? focusables.indexOf(current) : -1
      const nextIdx = nextTrappedFocusIndex(idx, focusables.length, event.shiftKey)
      if (nextIdx >= 0) {
        event.preventDefault()
        focusables[nextIdx].focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      if (previous && previous.isConnected) {
        previous.focus()
      }
    }
  }, [dialogRef, active])
}
