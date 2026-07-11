import { test, expect } from '@playwright/test'

// Each test starts with a fresh browser (empty localStorage), so the app boots
// with the built-in starter sheet.
test.beforeEach(async ({ page }) => {
    await page.goto('/')
})

test('loads the starter sheet', async ({ page }) => {
    await expect(page.getByLabel('Character name')).toHaveValue('New Character')
    await expect(page.getByRole('heading', { name: 'Ability Scores' })).toBeVisible()
})

test('drag handles and the section editor are available without an edit mode', async ({ page }) => {
    // Cards can be moved/resized straight away.
    await expect(page.getByTitle(/Drag to move/).first()).toBeVisible()
    // The pencil in the handle bar opens a per-section editor modal.
    await page.getByRole('button', { name: 'Edit section' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('adding a section increases the section count', async ({ page }) => {
    await expect(page.locator('article')).toHaveCount(3)
    await page.getByRole('button', { name: '+ Section' }).click()
    await expect(page.locator('article')).toHaveCount(4)
})

test('dragging a section moves it on the canvas', async ({ page }) => {
    const handle = page.getByTitle('Drag to move').first()
    const before = await handle.boundingBox()
    expect(before).not.toBeNull()

    // Simulate a real click-and-drag with the mouse. Grab the ⠿ grip on the
    // left of the bar (its right side holds the handle buttons), then drag well
    // past a whole column (>104px) to be sure the card crosses into a
    // further-right column on the grid.
    await handle.hover({ position: { x: 6, y: 8 } })
    await page.mouse.down()
    await page.mouse.move(before!.x + 360, before!.y, { steps: 12 })
    await page.mouse.up()

    const after = await handle.boundingBox()
    expect(after).not.toBeNull()
    // On the column grid the card snaps to a new column and the sheet compacts
    // upward, so dragging right lands it in a further-right column.
    expect(after!.x).toBeGreaterThan(before!.x)
})

test('a newly added section survives a page reload (persistence)', async ({ page }) => {
    await page.getByRole('button', { name: '+ Section' }).click()
    await expect(page.locator('article')).toHaveCount(4)

    await page.reload()

    // The sheet is autosaved to localStorage, so the count persists.
    await expect(page.locator('article')).toHaveCount(4)
})

test('tucking a section into the drawer and restoring it', async ({ page }) => {
    // Tuck the first card away using the ⊟ handle button.
    await page.getByRole('button', { name: 'Move section to drawer' }).first().click()

    // The drawer opens as a scratch-pad and its peeking tab appears.
    await expect(page.getByText('Drawer · Canvas')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close the drawer' })).toBeVisible()

    // Closing the drawer leaves the tab peeking because it still holds a card.
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open the drawer' })).toBeVisible()

    // Reopen and restore the card back to the sheet with the ⊞ button.
    await page.getByRole('button', { name: 'Open the drawer' }).click()
    await page.getByRole('button', { name: 'Restore section from drawer' }).first().click()

    // Emptying the drawer auto-closes the panel and removes the tab entirely.
    await expect(page.getByText('Drawer · Canvas')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /the drawer/ })).toHaveCount(0)
})

test('dragging a card onto the drawer tab tucks it seamlessly', async ({ page }) => {
    const handle = page.getByTitle('Drag to move').first()
    const box = await handle.boundingBox()
    expect(box).not.toBeNull()

    // Grab a canvas card by its ⠿ grip and drag it toward the left-edge drawer
    // tab; the drawer auto-opens as the pointer approaches, and releasing over
    // it tucks the card.
    await handle.hover({ position: { x: 6, y: 8 } })
    await page.mouse.down()
    await page.mouse.move(box!.x - 60, box!.y, { steps: 6 })
    await page.mouse.move(20, 360, { steps: 12 })
    await page.mouse.up()

    // The drawer is open and now holds the tucked card (restorable with ⊞).
    await expect(page.getByText('Drawer · Canvas')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Restore section from drawer' })).toHaveCount(1)
})

test('an auto-opened empty drawer closes if the card is dropped back on the canvas', async ({ page }) => {
    const handle = page.getByTitle('Drag to move').first()
    const box = await handle.boundingBox()
    expect(box).not.toBeNull()

    await handle.hover({ position: { x: 6, y: 8 } })
    await page.mouse.down()
    // Drag toward the left tab so the (empty) drawer auto-opens…
    await page.mouse.move(20, 360, { steps: 12 })
    await expect(page.getByText('Drawer · Canvas')).toBeVisible()
    // …then drop back on the canvas (clear of the panel) instead of in the drawer.
    await page.mouse.move(820, 400, { steps: 12 })
    await page.mouse.up()

    // The auto-opened empty drawer should close and the tab disappear again.
    await expect(page.getByText('Drawer · Canvas')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /the drawer/ })).toHaveCount(0)
})
