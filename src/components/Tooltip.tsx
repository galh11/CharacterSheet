import { useId, useState, type ReactNode } from 'react'

interface TooltipProps {
    content: string
    children: ReactNode
}

/**
 * Lightweight hover/focus tooltip. Shows the description bubble above the
 * trigger. Accessible via keyboard focus and aria-describedby.
 */
export function Tooltip({ content, children }: TooltipProps) {
    const [open, setOpen] = useState(false)
    const id = useId()

    if (!content) return <>{children}</>

    return (
        <span
            className="relative inline-flex"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
        >
            <span tabIndex={0} aria-describedby={open ? id : undefined} className="outline-none">
                {children}
            </span>
            {open && (
                <span
                    role="tooltip"
                    id={id}
                    className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 w-56 max-w-xs whitespace-pre-line rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] leading-snug text-slate-200 shadow-lg"
                >
                    {content}
                </span>
            )}
        </span>
    )
}
