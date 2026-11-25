import { test, expect, type Locator, type Page } from '@playwright/test'

declare const process: { env: Record<string, string | undefined> }

const NOTICE_RE = /Reassessment is not built yet/i

async function loginIfLiveMode(page: Page): Promise<boolean> {
  const loginHeading = page.getByRole('heading', { name: 'ClearAuth — live sign in' })
  const landingHeading = page.getByRole('heading', { name: 'Or explore by role' })
  await expect(loginHeading.or(landingHeading)).toBeVisible()
  if (!(await loginHeading.isVisible())) return false

  await page.getByLabel('Username').fill(process.env.DEMO_USER ?? 'reviewer')
  await page.getByLabel('Password').fill(process.env.DEMO_PASSWORD ?? 'clearauth-demo')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Case Queue' })).toBeVisible()
  return true
}

async function openPediatricAndRecordReadiness(page: Page) {
  await page.getByRole('button', { name: 'Case Queue' }).click()
  await expect(page.locator('#tour-case-pediatric')).toBeVisible()
  await page.locator('#tour-case-pediatric').click()

  const checklist = page.locator('#tour-criteria-checklist')
  const header = checklist.getByText(/backend assessment rev \d+/i)
  const readinessPill = checklist.getByText(/Criteria Met ·/)
  const blockersPill = checklist.getByText(/^Blockers:/)
  await expect(header).toBeVisible()
  await expect(readinessPill).toBeVisible()
  await expect(blockersPill).toBeVisible()

  return {
    headerText: await header.innerText(),
    readinessText: await readinessPill.innerText(),
    blockersText: await blockersPill.innerText(),
  }
}

async function searchDiscoverySources(page: Page): Promise<Locator> {
  const discoverTab = page.getByRole('button', { name: /^Discover(\s*\(\d+\))?$/ })
  await expect(discoverTab).toBeVisible()
  await discoverTab.click()

  await expect(page.getByText(NOTICE_RE)).toBeVisible()
  await page.getByRole('button', { name: 'Find evidence' }).click()

  const attachBtn = page.getByRole('button', { name: /^Attach(ed|ing…)?$/ })
  const fullTextCard = page.locator('div.rounded-lg').filter({ hasText: 'gi-2026-10-21-v1' }).filter({ has: attachBtn })
  const metaCard = page.locator('div.rounded-lg').filter({ hasText: 'outside-records-index-v1' }).filter({ has: attachBtn })

  await expect(fullTextCard).toBeVisible()
  await expect(fullTextCard).toContainText('full_text')
  await expect(fullTextCard.getByTestId('discovery-result-excerpt')).toBeVisible()
  await expect(fullTextCard).toContainText('Age at request: 7 years.')

  await expect(metaCard).toBeVisible()
  await expect(metaCard).toContainText('metadata only: not read')
  await expect(metaCard.locator('p').nth(2)).toHaveText('metadata only: not read')
  await expect(metaCard.getByRole('button', { name: 'Inspect' })).toHaveCount(0)
  await expect(metaCard.getByTestId('discovery-result-excerpt')).toHaveCount(0)

  return fullTextCard
}

async function attachAndRemoveFullText(page: Page, fullTextCard: Locator) {
  await fullTextCard.getByRole('button', { name: 'Attach', exact: true }).click()
  await expect(fullTextCard.getByRole('button', { name: 'Attached', exact: true })).toBeDisabled()

  const attachedRow = page
    .locator('div.rounded-lg')
    .filter({ hasText: 'gi-2026-10-21-v1' })
    .filter({ has: page.getByRole('button', { name: 'Remove gi-2026-10-21-v1' }) })
  await expect(attachedRow).toBeVisible()
  await expect(attachedRow).toContainText('gi-2026-10-21-v1 [0..')

  await attachedRow.getByRole('button', { name: 'Remove gi-2026-10-21-v1' }).click()
  await expect(attachedRow).toHaveCount(0)
  await expect(fullTextCard.getByRole('button', { name: 'Attach', exact: true })).toBeEnabled()
}

test('live discovery: find full_text and metadata_only sources, attach, remove, and keep readiness unchanged', async ({ page }) => {
  await page.goto('/')
  const isLive = await loginIfLiveMode(page)
  test.skip(!isLive, 'Demo mode active (VITE_API_BASE_URL unset); skipping live discovery E2E')

  const initial = await openPediatricAndRecordReadiness(page)
  const fullTextCard = await searchDiscoverySources(page)
  await attachAndRemoveFullText(page, fullTextCard)

  await expect(page.getByText(NOTICE_RE)).toBeVisible()
  const checklist = page.locator('#tour-criteria-checklist')
  await expect(checklist.getByText(/backend assessment rev \d+/i)).toHaveText(initial.headerText)
  await expect(checklist.getByText(/Criteria Met ·/)).toHaveText(initial.readinessText)
  await expect(checklist.getByText(/^Blockers:/)).toHaveText(initial.blockersText)
})
