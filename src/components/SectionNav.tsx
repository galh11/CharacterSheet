import { clsx } from 'clsx'
import { useState, type ReactNode } from 'react'

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
    /** The active search query, used to highlight matched title text. */
    query?: string
    /** Ids of sections that match the current search; others are dimmed. When
     *  omitted (no active search) every row shows normally. */
    matchIds?: Set<string>
}

/** Highlight each case-insensitive occurrence of `q` within `text`. */
function highlight(text: string, q: string): ReactNode {
    const needle = q.trim().toLowerCase()
    if (!needle) return text
    const parts: ReactNode[] = []
    const lower = text.toLowerCase()
    let i = 0
    let k = 0
    for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, i)) {
        if (at > i) parts.push(text.slice(i, at))
        parts.push(
            <mark key={k++} className="rounded bg-amber-400/30 text-amber-100">
                {text.slice(at, at + needle.length)}
            </mark>,
        )
        i = at + needle.length
    }
    if (i < text.length) parts.push(text.slice(i))
    return parts
}

/** A collapsible list of the sheet's sections in the side nav — the dashboard
 *  "spine". Clicking a row scrolls that card into view and selects it; the row of
 *  the currently selected card is highlighted. During a search, matched title
 *  text is highlighted and non-matching rows are dimmed. Reduces the cognitive
 *  load of finding a card on a crammed canvas. */
export function SectionNav({ sections, activeIds, onJump, query = '', matchIds }: SectionNavProps) {
    const [open, setOpen] = useState(true)
    if (sections.length === 0) return null
    const searching = query.trim().length > 0
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
                        const dimmed = searching && matchIds != null && !matchIds.has(s.id)
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
                                        dimmed && 'opacity-40',
                                    )}
                                >
                                    <span
                                        aria-hidden="true"
                                        className="h-2 w-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: s.accent || '#64748b' }}
                                    />
                                    <span className="truncate">
                                        {searching ? highlight(s.title || 'Untitled', query) : s.title || 'Untitled'}
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
