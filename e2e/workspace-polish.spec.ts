import { test, expect } from '@playwright/test'

test('workspace fits 1280px without tab/timeline overflow, storyboard collapses, and letter footer shows local draft state', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Case Queue' }).click()
  await page.getByText('Case #PH-4201').first().click()

  const tabBar = page.getByTestId('preview-tab-bar')
  await expect(tabBar).toBeVisible()
  const tabOverflow = await tabBar.evaluate(el => el.scrollWidth > el.clientWidth)
  expect(tabOverflow).toBe(false)

  const timeline = page.getByTestId('case-timeline')
  await expect(timeline).toBeVisible()
  const timelineOverflow = await timeline.evaluate(el => el.scrollWidth > el.clientWidth)
  expect(timelineOverflow).toBe(false)

  const beforeWidth = await tabBar.evaluate(el => el.getBoundingClientRect().width)
  await page.getByRole('button', { name: 'Collapse patient storyboard' }).click()
  await expect(page.getByRole('button', { name: 'Expand patient storyboard' })).toBeVisible()
  const afterWidth = await tabBar.evaluate(el => el.getBoundingClientRect().width)
  expect(afterWidth).toBeGreaterThan(beforeWidth)
  await page.getByRole('button', { name: 'Expand patient storyboard' }).click()

  await page.getByRole('button', { name: 'Back to Queue' }).click()
  await page.getByText('Case #PH-3098').first().click()
  await page.getByRole('button', { name: /2\. PA Packet/ }).click()
  await page.getByRole('button', { name: 'Open Packet' }).click({ timeout: 6000 })

  const statusStrip = page.getByTestId('letter-action-status')
  await expect(statusStrip).toBeVisible()
  await expect(statusStrip).toContainText('Unsaved local draft — not validated')
  await expect(statusStrip).toContainText('not evaluated')
})
