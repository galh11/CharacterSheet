import { clsx } from 'clsx'
import { useRef, useState, type ReactNode } from 'react'
import type { SectionLayout } from '../model/characterSheet'

interface CanvasItemProps {
    layout: SectionLayout
    isEditMode: boolean
    onLayoutCommit: (layout: SectionLayout) => void
    children: ReactNode
}

const MIN_W = 200
const MIN_H = 140
const GRID = 8

const snap = (value: number) => Math.round(value / GRID) * GRID

type DragState =
    | { mode: 'idle' }
    | {
          mode: 'move' | 'resize'
          pointerId: number
          startX: number
          startY: number
          origin: SectionLayout
      }

/**
 * Wraps a card on the free canvas, providing drag-to-move (via the top handle)
 * and drag-to-resize (via the bottom-right handle) while in edit mode.
 * Live position is tracked locally and committed on pointer up.
 */
export function CanvasItem({ layout, isEditMode, onLayoutCommit, children }: CanvasItemProps) {
    const [live, setLive] = useState<SectionLayout | null>(null)
    const drag = useRef<DragState>({ mode: 'idle' })

    const current = live ?? layout

    const beginMove = (event: React.PointerEvent) => {
        if (!isEditMode) return
        event.preventDefault()
        ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
        drag.current = {
            mode: 'move',
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            origin: layout,
        }
        setLive(layout)
    }

    const beginResize = (event: React.PointerEvent) => {
        if (!isEditMode) return
        event.preventDefault()
        event.stopPropagation()
        ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
        drag.current = {
            mode: 'resize',
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            origin: layout,
        }
        setLive(layout)
    }

    const onPointerMove = (event: React.PointerEvent) => {
        const state = drag.current
        if (state.mode === 'idle' || state.pointerId !== event.pointerId) return
        const dx = event.clientX - state.startX
        const dy = event.clientY - state.startY
        if (state.mode === 'move') {
            setLive({
                ...state.origin,
                x: Math.max(0, snap(state.origin.x + dx)),
                y: Math.max(0, snap(state.origin.y + dy)),
            })
        } else {
            setLive({
                ...state.origin,
                w: Math.max(MIN_W, snap(state.origin.w + dx)),
                h: Math.max(MIN_H, snap(state.origin.h + dy)),
            })
        }
    }

    const endDrag = (event: React.PointerEvent) => {
        const state = drag.current
        if (state.mode === 'idle' || state.pointerId !== event.pointerId) return
        drag.current = { mode: 'idle' }
        if (live) onLayoutCommit(live)
        setLive(null)
    }

    return (
        <div
            className={clsx('absolute', live && 'z-10 select-none')}
            style={{ left: current.x, top: current.y, width: current.w, height: current.h }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
        >
            {isEditMode && (
                <div
                    onPointerDown={beginMove}
                    className="flex h-5 cursor-move items-center justify-center rounded-t-lg bg-slate-700/80 text-[10px] tracking-widest text-slate-300"
                    title="Drag to move"
                >
                    ⠿ DRAG
                </div>
            )}
            <div className={clsx('h-full overflow-auto', isEditMode ? 'rounded-b-lg' : 'rounded-lg')}>
                {children}
            </div>
            {isEditMode && (
                <div
                    onPointerDown={beginResize}
                    className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize rounded-tl bg-slate-600/80"
                    title="Drag to resize"
                />
            )}
        </div>
    )
}
