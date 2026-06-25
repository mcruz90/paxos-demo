import { test, expect } from '@playwright/test'

test('case queue: action-needed grouping, Due column, no overdue, no New Case, auto-sync', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Skip the tour/ }).click()

  await expect(page.getByRole('heading', { name: 'Case Queue' })).toBeVisible()

  // Auto-import indicator (no manual entry)
  await expect(page.getByText('Auto-synced from Epic · live')).toBeVisible()
  await expect(page.getByRole('button', { name: /New Case/ })).toHaveCount(0)

  // Grouped by action needed
  await expect(page.getByText('Review & approve')).toBeVisible()
  await expect(page.getByText('Respond to payer')).toBeVisible()
  await expect(page.getByText('Needs investigation')).toBeVisible()

  // Due column present with urgency, and NO overdue tier anywhere
  await expect(page.getByText('Due today').first()).toBeVisible()
  await expect(page.getByText(/Overdue/i)).toHaveCount(0)

  await page.screenshot({ path: 'e2e/__screens__/queue.png', fullPage: true })
})
