import { test, expect } from '@playwright/test'

test('landing hub is the default view with four role cards and overview entry', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Or explore by role' })).toBeVisible()
  await expect(page.getByText('Evaluating the AI Lead')).toBeVisible()
  await expect(page.getByText('A prospective client')).toBeVisible()
  await expect(page.getByText('An investor or exec')).toBeVisible()
  await expect(page.getByText('Brand / Market Access Analyst')).toBeVisible()

  await expect(page.getByRole('button', { name: /90-second overview/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Case Queue' })).toBeVisible()

  await page.screenshot({ path: 'e2e/__screens__/landing.png', fullPage: true })
  expect(errors, errors.join('\n')).toEqual([])
})
