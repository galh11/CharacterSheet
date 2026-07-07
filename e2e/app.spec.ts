import { test, expect } from '@playwright/test'

// Each test starts with a fresh browser (empty localStorage), so the app boots
// with the built-in starter sheet.
test.beforeEach(async ({ page }) => {
    await page.goto('/')
})

test('loads the starter sheet', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'New Character' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ability Scores' })).toBeVisible()
})

test('drag handles are available in play mode and edit mode', async ({ page }) => {
    // Cards can be moved/resized without entering edit mode.
    await expect(page.getByTitle(/Drag to move/).first()).toBeVisible()

    await page.getByRole('button', { name: 'Edit' }).click()

    await expect(page.getByRole('button', { name: 'Done editing' })).toBeVisible()
    await expect(page.getByTitle(/Drag to move/).first()).toBeVisible()
})

test('adding a section increases the section count', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click()

    await expect(page.locator('article')).toHaveCount(3)
    await page.getByRole('button', { name: 'Add section' }).click()
    await expect(page.locator('article')).toHaveCount(4)
})

test('dragging a section moves it on the canvas', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click()

    const handle = page.getByTitle('Drag to move').first()
    const before = await handle.boundingBox()
    expect(before).not.toBeNull()

    // Simulate a real click-and-drag with the mouse.
    await handle.hover()
    await page.mouse.down()
    await page.mouse.move(before!.x + 160, before!.y + 96, { steps: 12 })
    await page.mouse.up()

    const after = await handle.boundingBox()
    expect(after).not.toBeNull()
    // The card should have moved to a new position.
    expect(after!.x).toBeGreaterThan(before!.x)
    expect(after!.y).toBeGreaterThan(before!.y)
})

test('a newly added section survives a page reload (persistence)', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('button', { name: 'Add section' }).click()
    await expect(page.locator('article')).toHaveCount(4)

    await page.reload()

    // The sheet is autosaved to localStorage, so the count persists.
    await expect(page.locator('article')).toHaveCount(4)
})
