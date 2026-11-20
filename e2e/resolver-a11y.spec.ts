import { test, expect } from '@playwright/test'

test('exception modal usability, focus trap, Escape return focus, Find patient records, and empty search guard', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Case Queue' }).click()
  await page.getByText('Case #PH-5177').first().click()

  const opener = page.getByRole('button', { name: /Resolve Exception/ }).first()
  await opener.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  const focusInside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))
  expect(focusInside).toBe(true)

  const policyToggle = dialog.getByRole('button', { name: 'Show policy detail' })
  await expect(policyToggle).toHaveAttribute('aria-expanded', 'false')
  await policyToggle.click()
  await expect(dialog.getByRole('button', { name: 'Hide policy detail' })).toHaveAttribute('aria-expanded', 'true')
  await expect(dialog.getByText(/whose criteria are not fully in the submitted record/)).toBeVisible()

  await expect(dialog.getByRole('button', { name: 'Find patient records' })).toBeVisible()
  await expect(dialog.getByText(/Auto-verify EHR/)).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Find patient records' }).click()
  await dialog.getByRole('button', { name: 'Attach local excerpt' }).click({ timeout: 3000 })

  const evidenceBar = dialog.getByTestId('selected-evidence-bar')
  await expect(evidenceBar).toContainText('SureScripts dispense history')
  await evidenceBar.getByRole('button', { name: /Remove/ }).first().click()
  await expect(evidenceBar).not.toContainText('SureScripts dispense history')

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const focusReturned = await opener.evaluate(el => document.activeElement === el)
  expect(focusReturned).toBe(true)

  await page.getByRole('button', { name: 'Back to Queue' }).click()
  await page.getByText('Case #PH-3101').first().click()
  await page.getByRole('button', { name: /Resolve Exception/ }).first().click()
  const gapDialog = page.getByRole('dialog')
  await gapDialog.getByRole('button', { name: 'Find patient records' }).click()
  await expect(gapDialog.getByText(/No supporting or conflicting patient records/i)).toBeVisible({ timeout: 3000 })
  await gapDialog.getByRole('button', { name: /Record Clinician Assessment/ }).click()
  await expect(gapDialog.getByRole('button', { name: 'Attach & Reassess Criterion' })).toBeDisabled()
})
