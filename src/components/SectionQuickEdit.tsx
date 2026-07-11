import type { CharacterSection, SectionKind } from '../model/characterSheet'
import { Popover } from './Popover'

/** Quick layout choices — mirrors the fuller list in `SectionEditorModal`. */
const KIND_OPTIONS: { value: SectionKind; label: string }[] = [
    { value: 'default', label: 'List' },
    { value: 'abilities', label: 'Ability scores' },
    { value: 'hp', label: 'HP tracker' },
    { value: 'skills', label: 'Skills' },
    { value: 'actions', label: 'Actions' },
    { value: 'hitdice', label: 'Hit dice' },
    { value: 'conditions', label: 'Conditions' },
    { value: 'spellslots', label: 'Spell slots' },
    { value: 'spellcards', label: 'Spell cards' },
    { value: 'initiative', label: 'Initiative' },
    { value: 'currency', label: 'Currency' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'timers', label: 'Buff timers' },
]

/** A handful of accent presets for one-click recolouring. */
const ACCENT_SWATCHES = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777', '#64748b']

interface SectionQuickEditProps {
    section: CharacterSection
    onUpdateSection: (
        patch: Partial<Pick<CharacterSection, 'title' | 'description' | 'accent' | 'kind' | 'scale' | 'meta'>>,
    ) => void
    /** Open the full editor from the popover's "More…" link. */
    onEdit?: () => void
    className?: string
}

/**
 * A ✐ trigger that opens a non-blocking `Popover` for quick section tweaks —
 * rename, accent colour and layout kind — without the heavy editor modal.
 */
export function SectionQuickEdit({ section, onUpdateSection, onEdit, className }: SectionQuickEditProps) {
    return (
        <Popover
            trigger="✐"
            title="Quick edit — rename, colour, layout"
            ariaLabel={`Quick edit ${section.title}`}
            triggerClassName={className}
        >
            {(close) => (
                <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-slate-500">
                        Name
                        <input
                            value={section.title}
                            onChange={(event) => onUpdateSection({ title: event.target.value })}
                            className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm font-semibold text-slate-100"
                            aria-label="Section name"
                            autoFocus
                        />
                    </label>

                    <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-slate-500">
                        Layout
                        <select
                            value={section.kind}
                            onChange={(event) => onUpdateSection({ kind: event.target.value as SectionKind })}
                            className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-200"
                            aria-label="Section layout"
                        >
                            {KIND_OPTIONS.map((k) => (
                                <option key={k.value} value={k.value}>
                                    {k.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-slate-500">
                        Colour
                        <div className="flex flex-wrap items-center gap-1.5">
                            {ACCENT_SWATCHES.map((colour) => (
                                <button
                                    key={colour}
                                    type="button"
                                    onClick={() => onUpdateSection({ accent: colour })}
                                    className={section.accent === colour ? 'h-5 w-5 rounded-full ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-900' : 'h-5 w-5 rounded-full'}
                                    style={{ backgroundColor: colour }}
                                    aria-label={`Set colour ${colour}`}
                                    title={colour}
                                />
                            ))}
                            <input
                                type="color"
                                value={section.accent}
                                onChange={(event) => onUpdateSection({ accent: event.target.value })}
                                className="h-6 w-8 cursor-pointer rounded border border-slate-600 bg-slate-900"
                                aria-label="Custom section colour"
                                title="Custom colour"
                            />
                        </div>
                    </div>

                    {onEdit && (
                        <button
                            type="button"
                            onClick={() => {
                                close()
                                onEdit()
                            }}
                            className="self-start text-xs text-cyan-300 hover:text-cyan-200 hover:underline"
                        >
                            More settings…
                        </button>
                    )}
                </div>
            )}
        </Popover>
    )
}
