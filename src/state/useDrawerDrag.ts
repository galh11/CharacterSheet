import { useRef, useState } from 'react'
import type { CharacterSheet, CharacterSection, SectionLayout } from '../model/characterSheet'

/** Whether a section is tucked into the given view's drawer scratch-pad. */
export const inDrawer = (
    section: { drawer?: { canvas?: boolean; stack?: boolean } },
    view: 'canvas' | 'stack',
): boolean => Boolean(section.drawer?.[view])

type SectionPatch = Partial<
    Pick<CharacterSection, 'title' | 'description' | 'accent' | 'kind' | 'scale' | 'drawer' | 'drawerLayout' | 'layout' | 'meta'>
>

interface DrawerDragOptions {
    sheet: CharacterSheet
    /** Which view's drawer we're acting on (canvas vs stack). */
    view: 'canvas' | 'stack'
    updateSection: (id: string, patch: SectionPatch) => void
    deselect: (id: string) => void
    /** The positioned canvas container, so a drawer card can be restored to it. */
    captureRef: { current: HTMLDivElement | null }
    canvasZoom: number
    /** Clears the live grid reflow preview owned by useCanvasGridLayout. */
    setGridPreview: (value: Map<string, SectionLayout> | null) => void
    /** Set by the drawer while a card is over it, read by the grid reflow. */
    dragOverDrawerRef: { current: boolean }
}

/** Drawer + canvas card drag/tuck/restore behaviour extracted from App: the
 *  drawer open/drag state, the pointer geometry helpers, and the drag move/end
 *  handlers that tuck a canvas card away or restore a drawer card to the canvas. */
export function useDrawerDrag({
    sheet,
    view,
    updateSection,
    deselect,
    captureRef,
    canvasZoom,
    setGridPreview,
    dragOverDrawerRef,
}: DrawerDragOptions) {
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [dropHot, setDropHot] = useState(false)
    const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null)
    // Pointer offset (card-local px) where a drag was grabbed, so tuck/restore drops
    // and the floating drag preview align the card under the cursor.
    const [dragGrab, setDragGrab] = useState({ x: 0, y: 0 })
    const drawerTabRef = useRef<HTMLButtonElement>(null)
    const drawerPanelRef = useRef<HTMLDivElement>(null)
    const drawerCanvasRef = useRef<HTMLDivElement>(null)

    const hideSection = (id: string) => {
        const section = sheet.sections.find((s) => s.id === id)
        if (!section) return
        // Tuck the card into the current view's drawer, placing it on the drawer's
        // free canvas (keep any existing spot, else stack below what's there).
        const tucked = sheet.sections.filter((s) => s.id !== id && inDrawer(s, view) && s.drawerLayout)
        const bottom = tucked.reduce((m, s) => Math.max(m, s.drawerLayout!.y + s.drawerLayout!.h), 0)
        const drawerLayout = section.drawerLayout ?? {
            x: 16,
            y: tucked.length ? bottom + 16 : 16,
            w: Math.min(300, Math.max(180, section.layout.w)),
            h: Math.min(220, Math.max(80, section.layout.h)),
        }
        updateSection(id, { drawer: { ...(section.drawer ?? {}), [view]: true }, drawerLayout })
        setDrawerOpen(true)
        deselect(id)
    }

    // Collapse the drawer once its last card leaves, so it doesn't linger open and
    // empty. `removedId` is the card being taken out (still present in `sheet`).
    const closeDrawerIfEmpty = (removedId: string) => {
        const remaining = sheet.sections.filter((s) => s.id !== removedId && inDrawer(s, view)).length
        if (remaining === 0) setDrawerOpen(false)
    }

    const showSection = (id: string) => {
        const section = sheet.sections.find((s) => s.id === id)
        if (!section) return
        updateSection(id, { drawer: { ...(section.drawer ?? {}), [view]: false } })
        closeDrawerIfEmpty(id)
    }

    const pointInRect = (el: HTMLElement | null, x: number, y: number): boolean => {
        if (!el) return false
        const r = el.getBoundingClientRect()
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    }

    // Whether a screen point is over the open drawer panel / the peeking tab.
    const isOverPanel = (x: number, y: number): boolean => drawerOpen && pointInRect(drawerPanelRef.current, x, y)
    const isOverTab = (x: number, y: number): boolean => pointInRect(drawerTabRef.current, x, y)

    // Map a screen point to a layout inside a positioned container (canvas or the
    // drawer's scratch-pad), keeping the grabbed point under the cursor so the card
    // lands where you release it. `dragGrab` is the grab offset in screen pixels,
    // subtracted before dividing by the target container's zoom (canvas and drawer
    // can have different zooms, so the offset must be applied at the target scale).
    const pointToLayout = (
        el: HTMLElement | null,
        x: number,
        y: number,
        zoom: number,
        w: number,
        h: number,
    ): SectionLayout | null => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return {
            x: Math.max(0, Math.round((x - dragGrab.x - r.left) / zoom)),
            y: Math.max(0, Math.round((y - dragGrab.y - r.top) / zoom)),
            w,
            h,
        }
    }

    // Live feedback while a card is dragged: auto-open the drawer as a canvas card
    // approaches its tab, highlight the drop target, and drive the floating preview.
    const onCardDragMove = (id: string, x: number, y: number) => {
        const section = sheet.sections.find((s) => s.id === id)
        if (!section) return
        if (inDrawer(section, view)) {
            // A drawer card straddling out toward the canvas needs no target hint.
            if (dropHot) setDropHot(false)
            dragOverDrawerRef.current = false
            return
        }
        if (!drawerOpen && isOverTab(x, y)) setDrawerOpen(true)
        const over = isOverTab(x, y) || isOverPanel(x, y)
        setDropHot(over)
        // Over the drawer the card is leaving the canvas, so stop reflowing the grid.
        dragOverDrawerRef.current = over
        // Only float a preview while the card is over the drawer (where it would
        // otherwise be hidden behind the panel); normal canvas dragging is untouched.
        setDragPoint(over ? { x, y } : null)
    }

    // Decide where a dragged card lands. Canvas cards released over the drawer are
    // tucked away at the drop point; drawer cards released over the canvas are
    // restored there. Returns true when handled so the plain move isn't committed.
    const onCardDragEnd = (id: string, x: number, y: number, moved: boolean): boolean => {
        setDraggingId(null)
        setDropHot(false)
        setDragPoint(null)
        setGridPreview(null)
        dragOverDrawerRef.current = false
        const section = sheet.sections.find((s) => s.id === id)
        if (!section) return false
        const fromDrawer = inDrawer(section, view)
        if (!moved) {
            // A no-op click: if dragging a canvas card past the tab auto-opened an
            // empty drawer, don't leave it hanging open.
            if (!fromDrawer) closeDrawerIfEmpty(id)
            return false
        }
        if (fromDrawer) {
            // Drag out: restore to the canvas at the drop point (unless dropped back
            // inside the panel, which just rearranges the scratch-pad).
            if (isOverPanel(x, y)) return false
            const drawerPatch = { drawer: { ...(section.drawer ?? {}), [view]: false } }
            if (view === 'canvas') {
                const layout = pointToLayout(captureRef.current, x, y, canvasZoom, section.layout.w, section.layout.h) ?? section.layout
                updateSection(id, { ...drawerPatch, layout })
            } else {
                updateSection(id, drawerPatch)
            }
            closeDrawerIfEmpty(id)
            return true
        }
        // Canvas card: tuck it into the drawer if released over the panel or tab.
        if (isOverPanel(x, y)) {
            const w = Math.min(300, Math.max(180, section.layout.w))
            const h = Math.min(220, Math.max(80, section.layout.h))
            const drawerLayout = pointToLayout(drawerCanvasRef.current, x, y, 1, w, h) ?? section.drawerLayout
            updateSection(id, { drawer: { ...(section.drawer ?? {}), [view]: true }, drawerLayout })
            setDrawerOpen(true)
            deselect(id)
            return true
        }
        if (isOverTab(x, y)) {
            hideSection(id)
            return true
        }
        // Dropped back on the canvas without tucking: close the drawer if dragging
        // past its tab auto-opened it while empty.
        closeDrawerIfEmpty(id)
        return false
    }

    return {
        drawerOpen,
        setDrawerOpen,
        draggingId,
        setDraggingId,
        dropHot,
        dragPoint,
        dragGrab,
        setDragGrab,
        drawerTabRef,
        drawerPanelRef,
        drawerCanvasRef,
        hideSection,
        showSection,
        closeDrawerIfEmpty,
        onCardDragMove,
        onCardDragEnd,
    }
}
