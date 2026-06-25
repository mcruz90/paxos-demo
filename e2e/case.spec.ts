import { test, expect, type Page } from '@playwright/test'

async function skipToQueue(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Skip the tour/ }).click()
  await expect(page.getByRole('heading', { name: 'Case Queue' })).toBeVisible()
}

test('PH-3098 initial PA: sidebar keeps Operate focus, approve → file → approved', async ({ page }) => {
  await skipToQueue(page)
  await page.getByText('Case #PH-3098').click()

  // In the case (POC) — the sidebar lens stays on Operate (the focus-fix)
  await expect(page.getByRole('heading', { name: 'Pipeline Execution' })).toBeVisible()
  await expect(page.getByText(/^Operate ·/)).toBeVisible()

  // Approve → review → confirm → file
  await page.getByRole('button', { name: /Approve & File PA Request/ }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /Confirm & File PA Request/ }).click()

  // Approved determination surfaces (with time-to-therapy)
  await expect(page.getByText(/Payer Determination.*Approved/)).toBeVisible()
  await page.screenshot({ path: 'e2e/__screens__/case-approved.png', fullPage: true })
})

test('PH-3101 denied PA hands off into the appeal flow', async ({ page }) => {
  await skipToQueue(page)
  await page.getByText('Case #PH-3101').click()

  await page.getByRole('button', { name: /Approve & File PA Request/ }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /Confirm & File PA Request/ }).click()

  // Denied → Start Appeal → lands in the appeal flow on the same case
  await expect(page.getByText(/Payer Determination.*Denied/)).toBeVisible()
  await page.getByRole('button', { name: /Start Appeal/ }).click()
  await expect(page.getByRole('button', { name: /Approve & Submit Appeal/ })).toBeVisible()
})
