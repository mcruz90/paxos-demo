import { describe, expect, it } from 'vitest'
import { parseDevConsole } from './liveMode'

// ADR-0016: LiveApp demotes to a developer console, reachable only via
// ?console=dev — never the default live surface.

describe('parseDevConsole', () => {
  it('opts in only on console=dev', () => {
    expect(parseDevConsole('?console=dev')).toBe(true)
    expect(parseDevConsole('?theme=light&console=dev')).toBe(true)
  })

  it('stays off by default and for other values', () => {
    expect(parseDevConsole('')).toBe(false)
    expect(parseDevConsole('?')).toBe(false)
    expect(parseDevConsole('?console')).toBe(false)
    expect(parseDevConsole('?console=live')).toBe(false)
    expect(parseDevConsole('?debug=1')).toBe(false)
  })
})
