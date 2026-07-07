import { clsx } from 'clsx'
import { useRef, useState, type ReactNode } from 'react'
import type { SectionLayout } from '../model/characterSheet'

export interface SnapGuide {
    axis: 'x' | 'y'
    pos: number
}

interface CanvasItemProps {
    layout: SectionLayout
    /** Other sections' rects, used as snap targets. */
    siblings: SectionLayout[]
    /** Content zoom (1 = 100%). */
    scale?: number
    onLayoutCommit: (layout: SectionLayout) => void
    onScaleChange?: (scale: number) => void
    /** Reports active alignment guides while dragging (empty on release). */
    onGuidesChange?: (guides: SnapGuide[]) => void
    children: ReactNode
}

const MIN_W = 180
const MIN_H = 80
const GRID = 8
const SNAP = 7

const snapGrid = (v: number) => Math.round(v / GRID) * GRID

/** Snap a moving box's near/center/far edge on one axis to candidate lines. */
function snapMove(pos: number, size: number, candidates: number[]): { pos: number; guide: number | null } {
    const anchors = [pos, pos + size / 2, pos + size]
    let best = { delta: Infinity, guide: null as number | null }
    for (const anchor of anchors) {
        for (const c of candidates) {
            const d = c - anchor
            if (Math.abs(d) < Math.abs(best.delta)) best = { delta: d, guide: c }
        }
    }
    if (Math.abs(best.delta) <= SNAP) return { pos: pos + best.delta, guide: best.guide }
    return { pos: snapGrid(pos), guide: null }
}

/** Snap a resizing box's far edge to candidate lines. */
function snapResize(pos: number, size: number, candidates: number[]): { size: number; guide: number | null } {
    const far = pos + size
    let best = { delta: Infinity, guide: null as number | null }
    for (const c of candidates) {
        const d = c - far
        if (Math.abs(d) < Math.abs(best.delta)) best = { delta: d, guide: c }
    }
    if (Math.abs(best.delta) <= SNAP) return { size: size + best.delta, guide: best.guide }
    return { size: snapGrid(size), guide: null }
}

type DragState =
    | { mode: 'idle' }
    | { mode: 'move' | 'resize'; pointerId: number; startX: number; startY: number; origin: SectionLayout }

export function CanvasItem({ layout, siblings, scale = 1, onLayoutCommit, onScaleChange, onGuidesChange, children }: CanvasItemProps) {
    const [live, setLive] = useState<SectionLayout | null>(null)
    const drag = useRef<DragState>({ mode: 'idle' })
    const rootRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)

    const current = live ?? layout

    const beginDrag = (mode: 'move' | 'resize', event: React.PointerEvent) => {
        event.preventDefault()
        event.stopPropagation()
        ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
        drag.current = { mode, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: layout }
        setLive(layout)
    }

    const onPointerMove = (event: React.PointerEvent) => {
        const state = drag.current
        if (state.mode === 'idle' || state.pointerId !== event.pointerId) return
        const dx = event.clientX - state.startX
        const dy = event.clientY - state.startY
        const guides: SnapGuide[] = []

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
        drag.current = { mode: 'idle' }
        if (live) onLayoutCommit(live)
        setLive(null)
        onGuidesChange?.([])
    }

    /** Shrink-wrap the height to the content's natural height. */
    const fitHeight = () => {
        const root = rootRef.current
        const content = contentRef.current
        if (!root || !content) return
        const pr = root.style.height
        const pc = content.style.height
        root.style.height = 'auto'
        content.style.height = 'auto'
        const h = Math.max(MIN_H, Math.round(root.offsetHeight))
        root.style.height = pr
        content.style.height = pc
        onLayoutCommit({ ...layout, h })
    }

    /** Shrink-wrap the width to the content's natural width (capped). */
    const fitWidth = () => {
        const root = rootRef.current
        const content = contentRef.current
        if (!root || !content) return
        const pr = root.style.width
        const pc = content.style.width
        root.style.width = 'max-content'
        content.style.width = 'max-content'
        const w = Math.min(720, Math.max(MIN_W, Math.round(root.offsetWidth)))
        root.style.width = pr
        content.style.width = pc
        onLayoutCommit({ ...layout, w })
    }

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
            className={clsx('group absolute', live && 'z-20 select-none')}
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
