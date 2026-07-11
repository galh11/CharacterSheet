import { useCallback, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
    content: string
    children: ReactNode
}

interface BubblePos {
    left: number
    top: number
}

const WIDTH = 224 // w-56
const GAP = 4 // spacing between the trigger and the bubble, in px
const MARGIN = 8 // keep the bubble this far from the viewport edges

/**
 * Lightweight hover/focus tooltip. The bubble is rendered in a portal on
 * document.body with fixed positioning, so it floats above the whole page and
 * is never clipped by a section card's or canvas item's `overflow`.
 * Accessible via keyboard focus and aria-describedby.
 */
export function Tooltip({ content, children }: TooltipProps) {
    const [open, setOpen] = useState(false)
    const [pos, setPos] = useState<BubblePos | null>(null)
    const triggerRef = useRef<HTMLSpanElement>(null)
    const id = useId()

    // Measure and place the bubble the moment it mounts (a ref callback runs
    // after layout, so we get the trigger's on-screen rect and the bubble's own
    // height). Prefer above the trigger; flip below when there's no room, and
    // clamp horizontally so it never spills past the viewport edges.
    const placeBubble = useCallback((bubble: HTMLSpanElement | null) => {
        if (!bubble) return
        const trigger = triggerRef.current
        if (!trigger) return
        const rect = trigger.getBoundingClientRect()
        const bubbleH = bubble.offsetHeight
        const vw = window.innerWidth
        const vh = window.innerHeight

        const left = Math.max(MARGIN, Math.min(rect.left, vw - WIDTH - MARGIN))
        const fitsAbove = rect.top - bubbleH - GAP >= MARGIN
        const fitsBelow = rect.bottom + bubbleH + GAP <= vh - MARGIN
        const above = fitsAbove || !fitsBelow
        const top = above ? rect.top - bubbleH - GAP : rect.bottom + GAP

        setPos({ left, top })
    }, [])

    const show = () => {
        setPos(null)
        setOpen(true)
    }
    const hide = () => setOpen(false)

    if (!content) return <>{children}</>

    return (
        <span
            ref={triggerRef}
            className="relative inline-flex"
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
        >
            <span tabIndex={0} aria-describedby={open ? id : undefined} className="outline-none">
                {children}
            </span>
            {open &&
                createPortal(
                    <span
                        ref={placeBubble}
                        role="tooltip"
                        id={id}
                        className="pointer-events-none fixed z-[100] w-56 max-w-xs whitespace-pre-line rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] leading-snug text-slate-200 shadow-lg"
                        style={{
                            left: pos?.left ?? -9999,
                            top: pos?.top ?? -9999,
                            visibility: pos ? 'visible' : 'hidden',
                        }}
                    >
                        {content}
                    </span>,
                    document.body,
                )}
        </span>
    )
}
