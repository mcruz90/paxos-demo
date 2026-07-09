import { describe, it, expect } from 'vitest'
import { loggedIn, loginFailed, sessionExpired, isSessionExpired, initialAuthState } from './session'
import { ApiError } from '../../../lib/api'

describe('session transitions', () => {
  it('holds user_id + csrf_token from a login response', () => {
    const state = loggedIn({ user_id: 'demo', csrf_token: 'tok' })
    expect(state.session).toEqual({ userId: 'demo', csrfToken: 'tok' })
    expect(state.expired).toBe(false)
    expect(state.error).toBeNull()
  })

  it('records a failed-login message with no session', () => {
    const state = loginFailed('Invalid credentials')
    expect(state.session).toBeNull()
    expect(state.error).toBe('Invalid credentials')
  })

  it('drops the session and flags expiry on a mid-flow expiry', () => {
    const state = sessionExpired()
    expect(state.session).toBeNull()
    expect(state.expired).toBe(true)
  })

  it('starts with no session', () => {
    expect(initialAuthState.session).toBeNull()
  })
})

describe('isSessionExpired', () => {
  it('is true for a 401 ApiError', () => {
    expect(isSessionExpired(new ApiError(401, 'nope'))).toBe(true)
  })

  it('is false for other statuses and non-ApiErrors', () => {
    expect(isSessionExpired(new ApiError(500, 'boom'))).toBe(false)
    expect(isSessionExpired(new Error('network'))).toBe(false)
  })
})
