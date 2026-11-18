import { test, expect, type Page } from '@playwright/test'

async function goToQueue(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Case Queue' }).click()
  await expect(page.getByRole('heading', { name: 'Case Queue' })).toBeVisible()
}

test('PH-3098 initial PA: unified Epic workspace keeps Operate focus, open packet → approve & file', async ({ page }) => {
  await goToQueue(page)
  await page.getByText('Case #PH-3098').first().click()

  // Opens directly inside unified SplitPortfolioView while Operate focus holds
  await expect(page.getByText('Prior Auth Criteria Checklist')).toBeVisible()
  await expect(page.getByText(/^Operate ·/)).toBeVisible()

  // Open Packet tab → wait for simulated assembly → explicitly Open Packet → Approve & File
  await page.getByRole('button', { name: /2\. PA Packet/ }).click()
  await page.getByRole('button', { name: 'Open Packet' }).click({ timeout: 6000 })
  await page.getByRole('button', { name: /Approve & File Prior Auth/ }).click()

  await expect(page.getByText(/Prior Auth Submitted via Da Vinci PAS/)).toBeVisible()
  await page.screenshot({ path: 'e2e/__screens__/case-approved.png', fullPage: true })
})

test('PH-3101 pre-submission doc gap: resolver modal dispatches query cleanly', async ({ page }) => {
  await goToQueue(page)
  await page.getByText('Case #PH-3101').first().click()

  await page.getByRole('button', { name: /Resolve Exception/ }).click()
  await page.getByText('Send Provider In-Basket / Outbound Query').click()
  await page.getByRole('button', { name: /Send Query to/ }).click()

  await expect(page.getByText(/Outbound Provider Query Dispatched|Awaiting Docs/).first()).toBeVisible()
})
