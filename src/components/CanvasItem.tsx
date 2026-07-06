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
    onLayoutCommit: (layout: SectionLayout) => void
    /** Reports active alignment guides while dragging (empty on release). */
    onGuidesChange?: (guides: SnapGuide[]) => void
    children: ReactNode
}

const MIN_W = 180
const MIN_H = 80
const GRID = 8
const SNAP = 7
const HANDLE_H = 20

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

export function CanvasItem({ layout, siblings, onLayoutCommit, onGuidesChange, children }: CanvasItemProps) {
    const [live, setLive] = useState<SectionLayout | null>(null)
    const drag = useRef<DragState>({ mode: 'idle' })
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

    const fitToContent = () => {
        const el = contentRef.current
        if (!el) return
        const h = Math.max(MIN_H, el.scrollHeight + HANDLE_H + 4)
        onLayoutCommit({ ...layout, h })
    }

    return (
        <div
            className={clsx('group absolute', live && 'z-20 select-none')}
            style={{ left: current.x, top: current.y, width: current.w, height: current.h }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
        >
            <div
                onPointerDown={(e) => beginDrag('move', e)}
                className="flex h-5 cursor-move items-center gap-2 rounded-t-lg bg-slate-800/70 px-2 text-[10px] tracking-widest text-slate-500 opacity-40 transition-opacity group-hover:opacity-100"
                title="Drag to move"
            >
                <span>⠿</span>
                <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={fitToContent}
                    className="ml-auto rounded px-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                    title="Fit height to content"
                >
                    ⤢ fit
                </button>
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
