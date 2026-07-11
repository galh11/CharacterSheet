import { clsx } from 'clsx'
import { useState } from 'react'

interface SectionNavItem {
    id: string
    title: string
    accent?: string
}

interface SectionNavProps {
    /** The navigable sections (those currently rendered in the active view). */
    sections: SectionNavItem[]
    /** Sections to highlight as active (the current canvas selection). */
    activeIds: Set<string>
    /** Scroll a section's card into view (and select it). */
    onJump: (id: string) => void
}

/** A collapsible list of the sheet's sections in the side nav — the dashboard
 *  "spine". Clicking a row scrolls that card into view and selects it; the row of
 *  the currently selected card is highlighted. Reduces the cognitive load of
 *  finding a card on a crammed canvas. */
export function SectionNav({ sections, activeIds, onJump }: SectionNavProps) {
    const [open, setOpen] = useState(true)
    if (sections.length === 0) return null
    return (
        <div className="flex flex-col">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs font-medium uppercase tracking-wide text-slate-400 hover:text-slate-200"
                aria-expanded={open}
                title={open ? 'Hide the section list' : 'Show the section list'}
            >
                <span>Sections · {sections.length}</span>
                <span aria-hidden="true" className="text-slate-500">{open ? '▾' : '▸'}</span>
            </button>
            {open && (
                <ul className="mt-1 max-h-52 space-y-0.5 overflow-y-auto pr-1">
                    {sections.map((s) => {
                        const active = activeIds.has(s.id)
                        return (
                            <li key={s.id}>
                                <button
                                    type="button"
                                    onClick={() => onJump(s.id)}
                                    aria-label={`Jump to ${s.title || 'Untitled'}`}
                                    title={`Jump to ${s.title || 'Untitled'}`}
                                    className={clsx(
                                        'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm',
                                        active
                                            ? 'bg-slate-700/70 text-slate-100'
                                            : 'text-slate-300 hover:bg-slate-800',
                                    )}
                                >
                                    <span
                                        aria-hidden="true"
                                        className="h-2 w-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: s.accent || '#64748b' }}
                                    />
                                    <span className="truncate">{s.title || 'Untitled'}</span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
