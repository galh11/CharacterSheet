import { clsx } from 'clsx'
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface PopoverProps {
    /** Contents of the trigger button. */
    trigger: ReactNode
    title?: string
    ariaLabel?: string
    align?: 'left' | 'right'
    /** Extra classes for the trigger button. */
    triggerClassName?: string
    /** Extra classes for the outer wrapper (e.g. `shrink-0` in a flex row). */
    className?: string
    /** Render the panel contents; call `close` to dismiss after an action. */
    children: (close: () => void) => ReactNode
}

/**
 * A lightweight, non-blocking popover anchored to its trigger. Unlike the heavy
 * `SectionEditorModal` it has no backdrop and doesn't trap focus — it just floats
 * a small panel that closes on an outside click or Escape. Used for quick section
 * tweaks (rename / colour / layout) without opening the full editor.
 */
export function Popover({ trigger, title, ariaLabel, align = 'right', triggerClassName, className, children }: PopoverProps) {
    const [open, setOpen] = useState(false)
    const [shift, setShift] = useState(0)
    const ref = useRef<HTMLDivElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const onDown = (event: PointerEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
        }
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('pointerdown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('pointerdown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    // Nudge the panel back on-screen if it would spill past either edge. The
    // panel only renders while open, so (re)measure on open and leave the stale
    // value untouched while closed.
    useEffect(() => {
        if (!open) return
        const el = panelRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const margin = 8
        if (rect.right > window.innerWidth - margin) setShift(window.innerWidth - margin - rect.right)
        else if (rect.left < margin) setShift(margin - rect.left)
        else setShift(0)
    }, [open])

    return (
        <div ref={ref} className={clsx('relative', className)}>
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                title={title}
                aria-label={ariaLabel}
                aria-haspopup="dialog"
                aria-expanded={open}
                className={triggerClassName}
            >
                {trigger}
            </button>
            {open && (
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-label={ariaLabel}
                    style={shift ? { transform: `translateX(${shift}px)` } : undefined}
                    className={clsx(
                        'absolute z-30 mt-1 w-56 max-w-[calc(100vw-1rem)] rounded-lg border border-slate-700 bg-slate-900/95 p-2 text-slate-200 shadow-2xl ring-1 ring-black/20 backdrop-blur',
                        align === 'right' ? 'right-0' : 'left-0',
                    )}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    {children(() => setOpen(false))}
                </div>
            )}
        </div>
    )
}
