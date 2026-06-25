import { test, expect } from '@playwright/test'

test('Ontology Library: lifecycle skeleton flowchart + primitives (dose units) + edit→sandbox', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ontology Library' }).click()

  // Full PA lifecycle skeleton (not appeals-only) — scope to the skeleton so we
  // don't collide with the same words in the orientation copy / node badges.
  const skel = page.locator('#tour-skeleton')
  await expect(skel.getByRole('heading', { name: 'PA Case Skeleton' })).toBeVisible()
  await expect(skel.getByText('Order Intake')).toBeVisible()
  await expect(skel.getByText('Coverage Discovery')).toBeVisible()
  await expect(skel.getByText('Submission')).toBeVisible()
  await expect(skel.getByText('Appeal', { exact: true })).toBeVisible()
  await expect(skel.getByText(/Approved → therapy/)).toBeVisible()       // determination branch
  await expect(skel.getByText(/Gate ·/).first()).toBeVisible()           // entry gates
  await expect(skel.getByText('pa_required').first()).toBeVisible()      // schema shown inline

  // Default theme is light — capture the gate legibility evidence
  await page.screenshot({ path: 'e2e/__screens__/skeleton-light.png', fullPage: true })

  // Universal Rule Primitives include the added dose units
  await expect(page.getByText('Universal Rule Primitives')).toBeVisible()
  await expect(page.getByText(/"mcg"/).first()).toBeVisible()
  await expect(page.getByText(/"mL"/).first()).toBeVisible()

  // Edit the skeleton → editor + sandbox/eval-gate flow appears
  await skel.getByRole('button', { name: 'Edit' }).first().click()
  await expect(skel.getByRole('button', { name: /Add stage/ })).toBeVisible()
  await expect(skel.getByRole('button', { name: /Deploy to sandbox/ })).toBeVisible()
})

test('Workflow Spec: escalation + human-review sections both present', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Workflow Spec' }).click()
  await expect(page.getByRole('heading', { name: 'Escalation Paths' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Human-Review Steps' })).toBeVisible()
})
