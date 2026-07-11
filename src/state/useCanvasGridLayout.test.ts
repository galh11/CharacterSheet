import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCanvasGridLayout } from './useCanvasGridLayout'
import { gridWidth, gridMetrics } from '../model/layout'
import type { CharacterSheet, SectionLayout } from '../model/characterSheet'
import type { CanvasItemHandle } from '../components/CanvasItem'

const sheetWith = (
    sections: { id: string; layout: SectionLayout; drawer?: { canvas?: boolean; stack?: boolean } }[],
): CharacterSheet => ({ sections }) as unknown as CharacterSheet

const baseOptions = (sheet: CharacterSheet, overrides: Record<string, unknown> = {}) => ({
    sheet,
    gridCols: 12,
    setGridCols: vi.fn(),
    setSectionLayouts: vi.fn(),
    fitRefs: { current: new Map<string, CanvasItemHandle>() },
    containerWidth: 800,
    fitWidth: false,
    densityZoom: 1,
    ...overrides,
})

describe('useCanvasGridLayout', () => {
    it('derives the grid from the column count', () => {
        const sheet = sheetWith([{ id: 'a', layout: { x: 0, y: 0, w: 200, h: 100 } }])
        const { result } = renderHook(() => useCanvasGridLayout(baseOptions(sheet, { gridCols: 6 })))
        expect(result.current.grid.cols).toBe(6)
    })

    it('sizes the canvas to at least the full grid width', () => {
        const sheet = sheetWith([{ id: 'a', layout: { x: 0, y: 0, w: 200, h: 100 } }])
        const { result } = renderHook(() => useCanvasGridLayout(baseOptions(sheet)))
        expect(result.current.canvasSize.width).toBe(gridWidth(gridMetrics(12)))
    })

    it('ignores drawer-tucked cards when measuring the canvas extent', () => {
        const sheet = sheetWith([
            { id: 'a', layout: { x: 0, y: 0, w: 200, h: 100 } },
            { id: 'b', layout: { x: 5000, y: 0, w: 200, h: 100 }, drawer: { canvas: true } },
        ])
        const { result } = renderHook(() => useCanvasGridLayout(baseOptions(sheet)))
        // The tucked card at x=5000 must not stretch the canvas.
        expect(result.current.canvasSize.maxX).toBe(200)
    })

    it('uses density zoom when fit-to-width is off, and fit zoom when on', () => {
        const sheet = sheetWith([{ id: 'a', layout: { x: 0, y: 0, w: 400, h: 100 } }])
        const off = renderHook(() => useCanvasGridLayout(baseOptions(sheet, { densityZoom: 0.8 })))
        expect(off.result.current.canvasZoom).toBe(0.8)
        const on = renderHook(() =>
            useCanvasGridLayout(baseOptions(sheet, { fitWidth: true, containerWidth: 800, densityZoom: 0.8 })),
        )
        // fitZoom = clamp(containerWidth / (maxX - minX)) = 800 / 400 = 2
        expect(on.result.current.canvasZoom).toBe(2)
    })

    it('commitLayout writes the reflowed layouts once', () => {
        const setSectionLayouts = vi.fn()
        const sheet = sheetWith([
            { id: 'a', layout: { x: 0, y: 0, w: 200, h: 100 } },
            { id: 'b', layout: { x: 300, y: 0, w: 200, h: 100 } },
        ])
        const { result } = renderHook(() => useCanvasGridLayout(baseOptions(sheet, { setSectionLayouts })))
        act(() => result.current.commitLayout('a', { x: 300, y: 0, w: 200, h: 100 }))
        expect(setSectionLayouts).toHaveBeenCalledTimes(1)
        expect(Array.isArray(setSectionLayouts.mock.calls[0][0])).toBe(true)
    })

    it('changeGridCols persists the count and re-packs onto the new grid', () => {
        const setGridCols = vi.fn()
        const setSectionLayouts = vi.fn()
        const sheet = sheetWith([{ id: 'a', layout: { x: 0, y: 0, w: 200, h: 100 } }])
        const { result } = renderHook(() =>
            useCanvasGridLayout(baseOptions(sheet, { setGridCols, setSectionLayouts })),
        )
        act(() => result.current.changeGridCols(8))
        expect(setGridCols).toHaveBeenCalledWith(8)
        expect(setSectionLayouts).toHaveBeenCalledTimes(1)
    })

    it('onGridDrag builds a live reflow preview', () => {
        const sheet = sheetWith([
            { id: 'a', layout: { x: 0, y: 0, w: 200, h: 100 } },
            { id: 'b', layout: { x: 300, y: 0, w: 200, h: 100 } },
        ])
        const { result } = renderHook(() => useCanvasGridLayout(baseOptions(sheet)))
        expect(result.current.gridPreview).toBeNull()
        act(() => result.current.onGridDrag('a', { x: 300, y: 0, w: 200, h: 100 }))
        expect(result.current.gridPreview).toBeInstanceOf(Map)
    })
})
