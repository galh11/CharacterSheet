import { clsx } from 'clsx'
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface MenuProps {
    label: ReactNode
    title?: string
    align?: 'left' | 'right'
    className?: string
    /** Render menu contents; call `close` to dismiss after an action. */
    children: (close: () => void) => ReactNode
}

/** A lightweight dropdown menu that closes on outside click or Escape. */
export function Menu({ label, title, align = 'left', className, children }: MenuProps) {
    const [open, setOpen] = useState(false)
    const [shift, setShift] = useState(0)
    const ref = useRef<HTMLDivElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)

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

    // Nudge the panel back on-screen if it would spill past either edge (the
    // toolbar wraps, so a button can end up anywhere across the width).
    useEffect(() => {
        if (!open) {
            setShift(0)
            return
        }
        const el = menuRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const margin = 8
        if (rect.right > window.innerWidth - margin) setShift(window.innerWidth - margin - rect.right)
        else if (rect.left < margin) setShift(margin - rect.left)
    }, [open])

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                title={title}
                aria-haspopup="menu"
                aria-expanded={open}
                className={clsx(
                    'rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800',
                    className,
                )}
            >
                {label}
            </button>
            {open && (
                <div
                    ref={menuRef}
                    role="menu"
                    style={shift ? { transform: `translateX(${shift}px)` } : undefined}
                    className={clsx(
                        'absolute z-30 mt-1 max-h-[70vh] min-w-[11rem] max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-md border border-slate-700 bg-slate-900 p-1 shadow-xl',
                        align === 'right' ? 'right-0' : 'left-0',
                    )}
                >
                    {children(() => setOpen(false))}
                </div>
            )}
        </div>
    )
}

/** A single clickable row inside a `Menu`. */
export function MenuItem({
    onClick,
    children,
    danger,
    disabled,
    title,
}: {
    onClick: () => void
    children: ReactNode
    danger?: boolean
    disabled?: boolean
    title?: string
}) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={clsx(
                'block w-full rounded px-3 py-1.5 text-left text-sm',
                disabled
                    ? 'cursor-not-allowed text-slate-600'
                    : danger
                        ? 'text-rose-300 hover:bg-rose-900/40'
                        : 'text-slate-200 hover:bg-slate-800',
            )}
        >
            {children}
        </button>
    )
}

/** A thin divider between groups of menu items. */
export function MenuDivider() {
    return <div className="my-1 border-t border-slate-700" role="separator" />
}

/** A small muted section heading inside a menu. */
export function MenuLabel({ children }: { children: ReactNode }) {
    return <div className="px-3 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">{children}</div>
}
