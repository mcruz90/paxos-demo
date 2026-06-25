import { test, expect } from '@playwright/test'

test('landing hub is the default view with three audience cards + secondary actions', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await page.goto('/')

  // "Who are you?" hub with the three audience cards
  await expect(page.getByText('Who are you?')).toBeVisible()
  await expect(page.getByText('Evaluating the AI Lead')).toBeVisible()
  await expect(page.getByText('A prospective client')).toBeVisible()
  await expect(page.getByText('An investor or exec')).toBeVisible()

  // Secondary actions render as real (clickable) buttons
  await expect(page.getByRole('button', { name: /90-second overview/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Skip the tour/ })).toBeVisible()

  await page.screenshot({ path: 'e2e/__screens__/landing.png', fullPage: true })
  expect(errors, errors.join('\n')).toEqual([])
})
