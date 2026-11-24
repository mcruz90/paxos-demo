import { test, expect } from '@playwright/test'

test('pediatric Nexium anchor: tour-case-pediatric id, UHC-CHOICE-2026, DOB 01/15/2019, and 28-of-56-days duration story', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Case Queue' }).click()

  await expect(page.locator('#tour-case-pediatric')).toBeVisible()
  await expect(page.locator('#tour-case-infant')).toHaveCount(0)

  await page.locator('#tour-case-pediatric').click()

  const mainText = page.locator('main, [role="main"], body')
  await expect(mainText).toContainText('01/15/2019')
  await expect(mainText).toContainText('UHC-CHOICE-2026')
  await expect(mainText).toContainText('28 of 56 days')
  await expect(mainText).toContainText('peer-to-peer')
  await expect(mainText).not.toContainText('10mg/day')
  await expect(mainText).not.toContainText('below the labeled dose')
  await expect(mainText).not.toContainText('sub-therapeutic')
})
