import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDrawerDrag, inDrawer } from './useDrawerDrag'
import type { CharacterSheet, SectionLayout } from '../model/characterSheet'

const sheetWith = (
    sections: { id: string; layout: SectionLayout; drawer?: { canvas?: boolean; stack?: boolean }; drawerLayout?: SectionLayout }[],
): CharacterSheet => ({ sections }) as unknown as CharacterSheet

const baseOptions = (sheet: CharacterSheet, overrides: Record<string, unknown> = {}) => ({
    sheet,
    view: 'canvas' as const,
    updateSection: vi.fn(),
    deselect: vi.fn(),
    captureRef: { current: null as HTMLDivElement | null },
    canvasZoom: 1,
    setGridPreview: vi.fn(),
    dragOverDrawerRef: { current: false },
    ...overrides,
})

describe('inDrawer', () => {
    it('reads the per-view drawer flag', () => {
        expect(inDrawer({ drawer: { canvas: true } }, 'canvas')).toBe(true)
        expect(inDrawer({ drawer: { canvas: true } }, 'stack')).toBe(false)
        expect(inDrawer({}, 'canvas')).toBe(false)
    })
})

describe('useDrawerDrag', () => {
    it('hideSection tucks a card into the view drawer, opens it, and deselects', () => {
        const updateSection = vi.fn()
        const deselect = vi.fn()
        const sheet = sheetWith([{ id: 'a', layout: { x: 0, y: 0, w: 240, h: 160 } }])
        const { result } = renderHook(() => useDrawerDrag(baseOptions(sheet, { updateSection, deselect })))
        act(() => result.current.hideSection('a'))
        expect(result.current.drawerOpen).toBe(true)
        expect(deselect).toHaveBeenCalledWith('a')
        const patch = updateSection.mock.calls[0][1]
        expect(patch.drawer.canvas).toBe(true)
        expect(patch.drawerLayout).toBeTruthy()
    })

    it('showSection clears the view drawer flag', () => {
        const updateSection = vi.fn()
        const sheet = sheetWith([
            { id: 'a', layout: { x: 0, y: 0, w: 240, h: 160 }, drawer: { canvas: true }, drawerLayout: { x: 16, y: 16, w: 200, h: 120 } },
        ])
        const { result } = renderHook(() => useDrawerDrag(baseOptions(sheet, { updateSection })))
        act(() => result.current.showSection('a'))
        expect(updateSection).toHaveBeenCalledWith('a', { drawer: { canvas: false } })
    })

    it('onCardDragEnd resets drag state and clears the grid preview', () => {
        const setGridPreview = vi.fn()
        const dragOverDrawerRef = { current: true }
        const sheet = sheetWith([{ id: 'a', layout: { x: 0, y: 0, w: 240, h: 160 } }])
        const { result } = renderHook(() =>
            useDrawerDrag(baseOptions(sheet, { setGridPreview, dragOverDrawerRef })),
        )
        act(() => {
            result.current.setDraggingId('a')
        })
        let handled = true
        act(() => {
            handled = result.current.onCardDragEnd('a', 0, 0, false)
        })
        // A no-op click on a canvas card isn't "handled" (the caller commits nothing).
        expect(handled).toBe(false)
        expect(result.current.draggingId).toBeNull()
        expect(setGridPreview).toHaveBeenCalledWith(null)
        expect(dragOverDrawerRef.current).toBe(false)
    })

    it('setDrawerOpen toggles the panel', () => {
        const sheet = sheetWith([{ id: 'a', layout: { x: 0, y: 0, w: 240, h: 160 } }])
        const { result } = renderHook(() => useDrawerDrag(baseOptions(sheet)))
        expect(result.current.drawerOpen).toBe(false)
        act(() => result.current.setDrawerOpen(true))
        expect(result.current.drawerOpen).toBe(true)
    })
})
