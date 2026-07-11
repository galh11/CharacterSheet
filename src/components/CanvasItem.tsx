import { clsx } from 'clsx'
import { useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import type { SectionLayout } from '../model/characterSheet'
import { snapMove, snapResize, snapToGrid, GRID, type GridMetrics } from '../model/layout'

export interface SnapGuide {
    axis: 'x' | 'y'
    pos: number
}

export interface CanvasItemHandle {
    measureHeight: () => number
    measureWidth: () => number
    measureHeightAtWidth: (w: number) => number
}

interface CanvasItemProps {
    layout: SectionLayout
    /** Other sections' rects, used as snap targets. */
    siblings: SectionLayout[]
    /** When set, the card snaps to this column grid instead of to sibling edges. */
    grid?: GridMetrics
    /** Content zoom (1 = 100%). */
    scale?: number
    /** Environment zoom applied to the canvas (density); used to correct drag deltas. */
    zoom?: number
    selected?: boolean
    onLayoutCommit: (layout: SectionLayout) => void
    onScaleChange?: (scale: number) => void
    /** Reports active alignment guides while dragging (empty on release). */
    onGuidesChange?: (guides: SnapGuide[]) => void
    /** Fired on a click (no drag) of the handle; additive = Shift/Ctrl held. */
    onSelect?: (additive: boolean) => void
    /** The edit control (✎ popover) rendered in the handle bar — quick rename /
     *  colour / layout, plus a "More settings…" link into the full editor. */
    quickEdit?: ReactNode
    /** Tuck this card into the drawer (⊟), or restore it (⊞) in drawer mode. */
    onHide?: () => void
    /** When true this card lives in the drawer scratch-pad, so the tuck button
     *  becomes a “restore” button and drops are not routed back to the drawer. */
    drawerMode?: boolean
    /** Hides the card in place (a floating drag preview stands in for it). */
    dimmed?: boolean
    /** Fired when a move-drag begins, with the pointer's offset from the card's
     *  top-left in screen pixels (so a preview / drop can keep the grabbed point
     *  under the cursor regardless of each container's zoom). */
    onDragStart?: (offsetX: number, offsetY: number) => void
    /** Fired continuously during a move-drag with screen coordinates. */
    onDragMove?: (x: number, y: number) => void
    /** On a column grid, fired continuously during a move-drag with the card's
     *  snapped grid layout, so the parent can reflow the other cards live. */
    onGridDrag?: (layout: SectionLayout) => void
    /** Fired when a move-drag ends. Returning true means the drop was consumed
     *  elsewhere (e.g. tucked into the drawer), so the layout is not committed. */
    onDragEnd?: (x: number, y: number, moved: boolean) => boolean
    handleRef?: React.Ref<CanvasItemHandle>
    children: ReactNode
}

const MIN_W = 180
const MIN_H = 80

type DragState =
    | { mode: 'idle' }
    | { mode: 'move' | 'resize'; pointerId: number; startX: number; startY: number; origin: SectionLayout }

export function CanvasItem({ layout, siblings, grid, scale = 1, zoom = 1, selected, onLayoutCommit, onScaleChange, onGuidesChange, onSelect, quickEdit, onHide, drawerMode, dimmed, onDragStart, onDragMove, onGridDrag, onDragEnd, handleRef, children }: CanvasItemProps) {
    const [live, setLive] = useState<SectionLayout | null>(null)
    const drag = useRef<DragState>({ mode: 'idle' })
    const moved = useRef(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)

    const current = live ?? layout

    const beginDrag = (mode: 'move' | 'resize', event: React.PointerEvent) => {
        event.preventDefault()
        event.stopPropagation()
            ; (event.target as HTMLElement).setPointerCapture(event.pointerId)
        drag.current = { mode, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: layout }
        moved.current = false
        setLive(layout)
        if (mode === 'move') {
            const r = rootRef.current?.getBoundingClientRect()
            onDragStart?.(r ? event.clientX - r.left : 0, r ? event.clientY - r.top : 0)
        }
    }

    const onPointerMove = (event: React.PointerEvent) => {
        const state = drag.current
        if (state.mode === 'idle' || state.pointerId !== event.pointerId) return
        // Divide screen-pixel deltas by the canvas zoom so the card tracks the cursor.
        const dx = (event.clientX - state.startX) / zoom
        const dy = (event.clientY - state.startY) / zoom
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true
        const guides: SnapGuide[] = []

        if (state.mode === 'move') onDragMove?.(event.clientX, event.clientY)

        // On a column grid, snap the moving/resizing rect to whole cells and skip
        // the free-canvas edge guides — the grid is the alignment.
        if (grid) {
            const raw =
                state.mode === 'move'
                    ? { ...state.origin, x: Math.max(0, state.origin.x + dx), y: Math.max(0, state.origin.y + dy) }
                    : { ...state.origin, w: Math.max(MIN_W, state.origin.w + dx), h: Math.max(MIN_H, state.origin.h + dy) }
            const snapped = snapToGrid(raw, grid)
            setLive(snapped)
            if (state.mode === 'move') onGridDrag?.(snapped)
            onGuidesChange?.([])
            return
        }

        if (state.mode === 'move') {
            const xCands = [0, ...siblings.flatMap((s) => [s.x, s.x + s.w / 2, s.x + s.w])]
            const yCands = [0, ...siblings.flatMap((s) => [s.y, s.y + s.h / 2, s.y + s.h])]
            const sx = snapMove(state.origin.x + dx, state.origin.w, xCands)
            const sy = snapMove(state.origin.y + dy, state.origin.h, yCands)
            if (sx.guide != null) guides.push({ axis: 'x', pos: sx.guide })
            if (sy.guide != null) guides.push({ axis: 'y', pos: sy.guide })
            setLive({ ...state.origin, x: Math.max(0, sx.pos), y: Math.max(0, sy.pos) })
        } else {
            const xCands = siblings.flatMap((s) => [s.x, s.x + s.w])
            const yCands = siblings.flatMap((s) => [s.y, s.y + s.h])
            const sw = snapResize(state.origin.x, state.origin.w + dx, xCands)
            const sh = snapResize(state.origin.y, state.origin.h + dy, yCands)
            if (sw.guide != null) guides.push({ axis: 'x', pos: sw.guide })
            if (sh.guide != null) guides.push({ axis: 'y', pos: sh.guide })
            setLive({ ...state.origin, w: Math.max(MIN_W, sw.size), h: Math.max(MIN_H, sh.size) })
        }
        onGuidesChange?.(guides)
    }

    const endDrag = (event: React.PointerEvent) => {
        const state = drag.current
        if (state.mode === 'idle' || state.pointerId !== event.pointerId) return
        const wasClick = state.mode === 'move' && !moved.current
        drag.current = { mode: 'idle' }
        const consumed =
            state.mode === 'move'
                ? (onDragEnd?.(event.clientX, event.clientY, moved.current) ?? false)
                : false
        if (consumed) {
            // App handled the drop (e.g. tucked the card into the drawer); leave
            // the layout where it was and skip selection.
        } else if (wasClick) {
            onSelect?.(event.shiftKey || event.ctrlKey || event.metaKey)
        } else if (live) {
            onLayoutCommit(live)
        }
        setLive(null)
        onGuidesChange?.([])
    }

    /** Measure the content's natural height (without committing). */
    const measureHeight = (): number => {
        const root = rootRef.current
        const content = contentRef.current
        if (!root || !content) return layout.h
        const pr = root.style.height
        const pc = content.style.height
        root.style.height = 'auto'
        content.style.height = 'auto'
        // +2px guards against sub-pixel rounding that would otherwise leave a
        // hairline scrollbar on the fitted card.
        const h = Math.max(MIN_H, Math.round(root.offsetHeight) + 2)
        root.style.height = pr
        content.style.height = pc
        return h
    }

    /** Measure the content's natural width (without committing, capped). */
    const measureWidth = (): number => {
        const root = rootRef.current
        const content = contentRef.current
        if (!root || !content) return layout.w
        const pr = root.style.width
        const pc = content.style.width
        root.style.width = 'max-content'
        content.style.width = 'max-content'
        const w = Math.min(380, Math.max(MIN_W, Math.round(root.offsetWidth) + 2))
        root.style.width = pr
        content.style.width = pc
        return w
    }

    /** Measure the content's natural height at a specific width, so a card fitted
     *  to a narrower grid column isn't cropped (height depends on width). */
    const measureHeightAtWidth = (w: number): number => {
        const root = rootRef.current
        const content = contentRef.current
        if (!root || !content) return layout.h
        const prh = root.style.height
        const prw = root.style.width
        const pch = content.style.height
        root.style.width = `${w}px`
        root.style.height = 'auto'
        content.style.height = 'auto'
        const h = Math.max(MIN_H, Math.round(root.offsetHeight) + 2)
        root.style.height = prh
        root.style.width = prw
        content.style.height = pch
        return h
    }

    useImperativeHandle(handleRef, () => ({ measureHeight, measureWidth, measureHeightAtWidth }))

    const fitHeight = () => onLayoutCommit({ ...layout, h: measureHeight() })
    const fitWidth = () => onLayoutCommit({ ...layout, w: measureWidth() })

    /** Arrow-key nudge when the handle is focused (Shift = grid step). */
    const nudge = (event: React.KeyboardEvent) => {
        const step = event.shiftKey ? GRID : 1
        let { x, y } = layout
        switch (event.key) {
            case 'ArrowLeft': x = Math.max(0, x - step); break
            case 'ArrowRight': x += step; break
            case 'ArrowUp': y = Math.max(0, y - step); break
            case 'ArrowDown': y += step; break
            default: return
        }
        event.preventDefault()
        onLayoutCommit({ ...layout, x, y })
    }

    return (
        <div
            ref={rootRef}
            className={clsx(
                'group absolute rounded-lg',
                live && 'z-20 select-none',
                // Smoothly slide into place when the parent reflows the grid, but not
                // while this card is the one being dragged (it must track the cursor).
                !live && grid && 'transition-[left,top] duration-150 ease-out motion-reduce:transition-none',
                selected && 'z-10 ring-2 ring-cyan-400',
                dimmed && 'opacity-0',
            )}
            style={{ left: current.x, top: current.y, width: current.w, height: current.h }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
        >
            <div
                onPointerDown={(e) => beginDrag('move', e)}
                tabIndex={0}
                onKeyDown={nudge}
                className="flex h-5 cursor-move items-center gap-1 rounded-t-lg bg-slate-800/70 px-2 text-[10px] tracking-widest text-slate-500 opacity-40 transition-opacity focus:opacity-100 focus:outline focus:outline-1 focus:outline-cyan-500 group-hover:opacity-100"
                title="Drag to move — arrow keys nudge (Shift = grid)"
            >
                <span>⠿</span>
                <div className="ml-auto flex items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => onScaleChange?.(Math.max(0.6, Math.round((scale - 0.1) * 10) / 10))} className="rounded px-1 hover:bg-slate-700 hover:text-slate-200" title="Smaller text">A−</button>
                    <button type="button" onClick={() => onScaleChange?.(Math.min(1.8, Math.round((scale + 0.1) * 10) / 10))} className="rounded px-1 hover:bg-slate-700 hover:text-slate-200" title="Larger text">A+</button>
                    <button type="button" onClick={fitHeight} className="rounded px-1 hover:bg-slate-700 hover:text-slate-200" title="Fit height to content">↕</button>
                    <button type="button" onClick={fitWidth} className="rounded px-1 hover:bg-slate-700 hover:text-slate-200" title="Fit width to content">↔</button>
                    {quickEdit}
                    {onHide && (
                        <button type="button" onClick={onHide} className="rounded px-1 text-slate-300 hover:bg-slate-700 hover:text-slate-100" title={drawerMode ? 'Restore to the sheet' : 'Move to drawer'} aria-label={drawerMode ? 'Restore section from drawer' : 'Move section to drawer'}>{drawerMode ? '⊞' : '⊟'}</button>
                    )}
                </div>
            </div>
            <div ref={contentRef} className="h-[calc(100%-1.25rem)] overflow-auto rounded-b-lg">
                {children}
            </div>
            <div
                onPointerDown={(e) => beginDrag('resize', e)}
                className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize rounded-tl bg-slate-600/60 opacity-40 transition-opacity group-hover:opacity-100"
                title="Drag to resize"
            />
        </div>
    )
}
