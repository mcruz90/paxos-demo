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

test('PH-3101 pre-submission doc gap: dispatch resolves the exception', async ({ page }) => {
  await skipToQueue(page)
  await page.getByText('Case #PH-3101').click()

  // Opening an 'exception' case goes straight to the Exception Report —
  // the doc gap was caught before the PA request was ever filed.
  await expect(page.getByText(/Exception Report/)).toBeVisible()

  // Dispatch the one unresolved criterion (prescriber attestation request)
  await page.getByRole('button', { name: /Dispatch Workflow/ }).click()
  await page.getByRole('button', { name: /Confirm & Dispatch/ }).click()

  // All unresolved criteria dispatched → case moves to the documentation queue
  await expect(page.getByText(/Workflows Dispatched/)).toBeVisible()
})
