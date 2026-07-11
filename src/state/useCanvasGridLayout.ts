import { useMemo, useRef, useState } from 'react'
import type { CharacterSheet, SectionLayout } from '../model/characterSheet'
import {
    gridMetrics,
    gridWidth,
    compactGrid,
    placeInGrid,
    toCell,
    fromCell,
    type Placed,
} from '../model/layout'
import type { CanvasItemHandle } from '../components/CanvasItem'
import { inDrawer } from './useDrawerDrag'

interface CanvasGridLayoutOptions {
    sheet: CharacterSheet
    /** Persisted grid column count and its setter (chosen in the View menu). */
    gridCols: number
    setGridCols: (n: number) => void
    /** Apply many layouts in a single undo step (from useSheet). */
    setSectionLayouts: (updates: { id: string; layout: SectionLayout }[]) => void
    /** Per-card imperative handles used to measure natural content sizes. */
    fitRefs: { current: Map<string, CanvasItemHandle> }
    /** The canvas viewport width (measured by App's ResizeObserver). */
    containerWidth: number
    fitWidth: boolean
    /** Whole-sheet density zoom used when "Fit to width" is off. */
    densityZoom: number
}

/** Dashboard grid canvas geometry + layout handlers extracted from App: the
 *  column grid, canvas size, the fit-to-width / density zoom, and the drop /
 *  live-reflow / auto-arrange handlers that keep the canvas overlap-free. */
export function useCanvasGridLayout({
    sheet,
    gridCols,
    setGridCols,
    setSectionLayouts,
    fitRefs,
    containerWidth,
    fitWidth,
    densityZoom,
}: CanvasGridLayoutOptions) {
    // Live grid reflow: while a canvas card is dragged, the other cards' previewed
    // positions (keyed by id). Null when not dragging on the grid.
    const [gridPreview, setGridPreview] = useState<Map<string, SectionLayout> | null>(null)
    const dragOverDrawerRef = useRef(false)

    // The canvas column grid cards snap to (dashboard-style); the column count is a
    // persisted per-user preference chosen in the View menu.
    const grid = useMemo(() => gridMetrics(gridCols), [gridCols])

    const canvasSize = useMemo(() => {
        const shown = sheet.sections.filter((section) => !inDrawer(section, 'canvas'))
        const width = Math.max(
            gridWidth(grid),
            ...shown.map((section) => section.layout.x + section.layout.w + 48),
        )
        const height = Math.max(
            520,
            ...shown.map((section) => section.layout.y + section.layout.h + 80),
        )
        // Real left/right extent of the actual cards (no scroll padding / floor),
        // used by "Fit to width" so content fills the window edge-to-edge.
        const minX = shown.length ? Math.min(...shown.map((s) => s.layout.x)) : 0
        const maxX = shown.length ? Math.max(...shown.map((s) => s.layout.x + s.layout.w)) : width
        return { width, height, minX, maxX }
    }, [sheet.sections, grid])

    const commitLayout = (id: string, layout: SectionLayout) => {
        // Dashboard grid: pin the released card at its dropped cell and reflow the
        // rest around it (what you saw while dragging is exactly what lands). The
        // sheet stays overlap-free; Tidy fully compacts on demand.
        const items = sheet.sections
            .filter((s) => !inDrawer(s, 'canvas'))
            .map((s) => ({ id: s.id, layout: s.id === id ? layout : s.layout }))
        setSectionLayouts(placeInGrid(items, id, toCell(layout, grid), grid))
    }

    // Reflow the other canvas cards live as this one is dragged over the grid.
    const onGridDrag = (id: string, layout: SectionLayout) => {
        if (dragOverDrawerRef.current) {
            if (gridPreview) setGridPreview(null)
            return
        }
        const items = sheet.sections
            .filter((s) => !inDrawer(s, 'canvas'))
            .map((s) => ({ id: s.id, layout: s.id === id ? layout : s.layout }))
        const reflowed = placeInGrid(items, id, toCell(layout, grid), grid)
        setGridPreview(new Map(reflowed.map((p) => [p.id, p.layout])))
    }

    /** Fit every canvas card to its content on the grid: measure each card's
     *  natural content width, snap it to a whole number of columns, then measure
     *  its height AT that snapped width (so a narrowed card isn't cropped). Best
     *  run in play mode — edit mode renders bulky field editors. */
    const organizeItems = (m = grid): Placed[] =>
        sheet.sections
            .filter((s) => !inDrawer(s, 'canvas'))
            .map((s) => {
                const handle = fitRefs.current.get(s.id)
                if (!handle) return { id: s.id, layout: s.layout }
                const cw = toCell({ x: 0, y: 0, w: handle.measureWidth(), h: 1 }, m).cw
                const w = fromCell({ cx: 0, cy: 0, cw, ch: 1 }, m).w
                const h = handle.measureHeightAtWidth(w)
                return { id: s.id, layout: { ...s.layout, w, h } }
            })

    // The one “organize this” action: fit every card to its content and pack them
    // into tidy columns — no overlaps, no gaps, no cropping. Idempotent.
    const handleOrganize = () => {
        setSectionLayouts(compactGrid(organizeItems(), grid))
    }

    // Change the grid's column count (persisted) and re-organize onto the new grid.
    const changeGridCols = (n: number) => {
        setGridCols(n)
        const m = gridMetrics(n)
        setSectionLayouts(compactGrid(organizeItems(m), m))
    }

    // The free canvas zooms with density in both modes; CanvasItem divides drag
    // deltas by this factor so moving/resizing still tracks the cursor 1:1.
    // "Fit to width" instead scales the whole canvas so its actual content — the
    // real left-to-right extent of the cards, not the padded scroll area — fills
    // the current window width edge-to-edge (up- or down-scaling with the window /
    // page zoom). The canvas is shifted left by the leftmost card so the content
    // touches both edges with no trailing gap.
    const fitContentWidth = Math.max(1, canvasSize.maxX - canvasSize.minX)
    const fitZoom =
        fitWidth && containerWidth > 0
            ? Math.min(3, Math.max(0.3, containerWidth / fitContentWidth))
            : 1
    const canvasZoom = fitWidth ? fitZoom : densityZoom

    return {
        grid,
        canvasSize,
        canvasZoom,
        gridPreview,
        setGridPreview,
        dragOverDrawerRef,
        commitLayout,
        onGridDrag,
        handleOrganize,
        changeGridCols,
    }
}
