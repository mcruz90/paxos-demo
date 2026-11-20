import { test, expect } from '@playwright/test'

test('citations and icon controls work cleanly via keyboard navigation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Case Queue' }).click()
  await page.getByText('Case #PH-4201').first().click()

  const firstCritBtn = page.getByRole('button', { name: /1\. Confirmed GERD Diagnosis/ })
  await firstCritBtn.focus()
  await page.keyboard.press('Enter')
  await expect(firstCritBtn).toHaveAttribute('aria-pressed', 'true')

  const secondCritBtn = page.getByRole('button', { name: /2\. Documented Oral-Motor Dysphagia/ })
  await secondCritBtn.focus()
  await page.keyboard.press('Space')
  await expect(secondCritBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(firstCritBtn).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('button', { name: 'Snippets', exact: true }).click()
  const snippetBtn = page.locator('[data-cite-index="0"]')
  await expect(snippetBtn).toBeVisible()
  await snippetBtn.focus()
  await page.keyboard.press('Enter')
  await expect(snippetBtn).toHaveAttribute('aria-pressed', 'true')
})
