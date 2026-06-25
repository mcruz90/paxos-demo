import { test, expect, type Page } from '@playwright/test'

// Drives a Joyride tour to completion by clicking the primary button (label is
// "Next (n/m)" until the final step, then "Last"). The regression we're guarding
// against: the tour failing to end and leaving the overlay locking the page.
async function runTourToEnd(page: Page) {
  const overlay = page.locator('.react-joyride__overlay')
  await expect(overlay).toBeVisible({ timeout: 5000 })
  for (let i = 0; i < 24; i++) {
    if (await overlay.count() === 0) break // tour finished — overlay gone
    // The primary ("Next (n of m)" / "Last") carries data-action="primary" — a
    // label-independent, tooltip-scoped handle (avoids app buttons named "Next").
    const primary = page.locator('.react-joyride__tooltip [data-action="primary"]')
    if (await primary.count() === 0) { await page.waitForTimeout(300); continue } // transient re-render
    // Let Joyride's auto-scroll-to-target settle before clicking — clicking
    // mid-scroll makes v3 swallow the step:after/finish event.
    await page.waitForTimeout(800)
    if (await overlay.count() === 0) break
    await primary.first().click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(400)
  }
  // Overlay cleared and the app is interactive again
  await expect(overlay).toHaveCount(0, { timeout: 6000 })
  await page.getByRole('button', { name: 'Case Queue' }).click()
  await expect(page.getByRole('heading', { name: 'Case Queue' })).toBeVisible()
}

const AUDIENCE_TOURS = [
  { name: 'Build', card: 'Evaluating the AI Lead' },
  { name: 'Operate', card: 'A prospective client' },
  { name: 'Scale', card: 'An investor or exec' },
]

for (const t of AUDIENCE_TOURS) {
  test(`${t.name} tour advances and exits cleanly`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(String(e)))
    await page.goto('/')
    await page.getByText(t.card).click()
    if (t.name === 'Build') {
      await expect(page.locator('.react-joyride__overlay')).toBeVisible({ timeout: 5000 })
      await page.screenshot({ path: 'e2e/__screens__/tour-running.png' })
    }
    await runTourToEnd(page)
    expect(errors, errors.join('\n')).toEqual([])
  })
}

test('Overview tour advances and exits cleanly', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /90-second overview/ }).click()
  await runTourToEnd(page)
})
