import { test, expect } from '@playwright/test'

/**
 * Visual regression tests: capture a screenshot of the app and compare it to a
 * stored baseline image. If the UI changes unexpectedly, the pixel diff fails.
 *
 * Baselines live in `visual.spec.ts-snapshots/` next to this file. When you make
 * an intentional visual change, refresh them with `npm run test:e2e:update`.
 */
test.beforeEach(async ({ page }) => {
    await page.goto('/')
})

test('view mode matches the visual snapshot', async ({ page }) => {
    await expect(page.getByLabel('Character name')).toHaveValue('New Character')
    await expect(page).toHaveScreenshot('view-mode.png', { fullPage: true })
})

test('the section editor modal matches the visual snapshot', async ({ page }) => {
    // The ✎ button opens the quick-edit popover; "More settings…" opens the full editor.
    await page.getByRole('button', { name: /^Edit / }).first().click()
    await page.getByRole('button', { name: 'More settings…' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page).toHaveScreenshot('section-editor.png', { fullPage: true })
})
