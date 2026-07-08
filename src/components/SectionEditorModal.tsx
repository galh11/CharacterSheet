import { clsx } from 'clsx'
import { useEffect, useState } from 'react'
import type { FormulaResult } from '../model/formula'
import type { FieldReference } from '../model/compute'
import {
    type CharacterField,
    type CharacterSection,
    type FieldType,
    type SectionKind,
} from '../model/characterSheet'

interface SectionEditorModalProps {
    section: CharacterSection
    results: Map<string, FormulaResult>
    references: FieldReference[]
    onClose: () => void
    onUpdateSection: (
        patch: Partial<Pick<CharacterSection, 'title' | 'description' | 'accent' | 'kind' | 'scale' | 'meta'>>,
    ) => void
    onDeleteSection: () => void
    onDuplicateSection: () => void
    onAddField: (overrides?: Partial<CharacterField>) => void
    onUpdateField: (fieldId: string, patch: Partial<CharacterField>) => void
    onDeleteField: (fieldId: string) => void
    onMoveField: (fieldId: string, direction: -1 | 1) => void
}

const FIELD_TYPES: FieldType[] = ['text', 'number', 'boolean', 'computed', 'counter', 'resource']

const SECTION_KINDS: { value: SectionKind; label: string }[] = [
    { value: 'default', label: 'List' },
    { value: 'abilities', label: 'Ability scores' },
    { value: 'hp', label: 'HP tracker' },
    { value: 'skills', label: 'Skills' },
    { value: 'actions', label: 'Actions' },
    { value: 'hitdice', label: 'Hit dice' },
    { value: 'deathsaves', label: 'Death saves' },
    { value: 'conditions', label: 'Conditions' },
    { value: 'spellslots', label: 'Spell slots' },
    { value: 'initiative', label: 'Initiative' },
    { value: 'currency', label: 'Currency' },
    { value: 'timers', label: 'Buff timers' },
]

/** A compact "type to search" inserter for field references, so a formula editor
 *  isn't buried under a wall of every slug on the sheet. */
function ReferenceInserter({ references, onInsert }: { references: FieldReference[]; onInsert: (slug: string) => void }) {
    const [query, setQuery] = useState('')
    const q = query.trim().toLowerCase()
    const matches = q
        ? references.filter((r) => r.slug.includes(q) || r.label.toLowerCase().includes(q)).slice(0, 10)
        : []
    return (
        <div className="mt-2">
            <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="+ insert a field… (type to search)"
                aria-label="Insert field reference"
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
            />
            {matches.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                    {matches.map((ref) => (
                        <button
                            key={ref.slug}
                            type="button"
                            onClick={() => {
                                onInsert(ref.slug)
                                setQuery('')
                            }}
                            className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 hover:bg-slate-700"
                            title={`${ref.label} = ${ref.value}`}
                        >
                            {ref.slug}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

/** A focused, roomy editor for a single section: its settings plus a full field
 *  editor with a live result preview for computed fields. Replaces the old
 *  global edit mode — opened per card from the pencil button. */
export function SectionEditorModal({
    section,
    results,
    references,
    onClose,
    onUpdateSection,
    onDeleteSection,
    onDuplicateSection,
    onAddField,
    onUpdateField,
    onDeleteField,
    onMoveField,
}: SectionEditorModalProps) {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])

    const setMeta = (field: CharacterField, key: string, value: string) =>
        onUpdateField(field.id, { meta: { ...field.meta, [key]: value } })

    const handleDelete = () => {
        if (window.confirm(`Delete the “${section.title}” section and all its fields?`)) {
            onDeleteSection()
            onClose()
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Edit ${section.title}`}
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
                <header className="flex items-center gap-2 border-b border-slate-700 px-4 py-3" style={{ borderTopColor: section.accent, borderTopWidth: 3 }}>
                    <h2 className="m-0 flex-1 text-base font-semibold text-slate-100">Edit section</h2>
                    <button
                        type="button"
                        onClick={onDuplicateSection}
                        className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                        title="Duplicate this section"
                    >
                        ⧉ Duplicate
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="rounded-md border border-rose-700/50 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/40"
                        title="Delete this section"
                    >
                        ✕ Delete
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="ml-1 rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800"
                        aria-label="Close editor"
                    >
                        Done
                    </button>
                </header>

                <div className="flex flex-col gap-4 overflow-y-auto p-4">
                    {/* Section settings */}
                    <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-950/50 p-3">
                        <label className="flex flex-col gap-1 text-xs text-slate-400">
                            Title
                            <input
                                value={section.title}
                                onChange={(event) => onUpdateSection({ title: event.target.value })}
                                className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm font-semibold text-slate-100"
                                aria-label="Section title"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-slate-400">
                            Description
                            <input
                                value={section.description}
                                onChange={(event) => onUpdateSection({ description: event.target.value })}
                                placeholder="Optional"
                                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300"
                                aria-label="Section description"
                            />
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 text-xs text-slate-400">
                                Layout
                                <select
                                    value={section.kind}
                                    onChange={(event) => onUpdateSection({ kind: event.target.value as SectionKind })}
                                    className="rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs text-slate-200"
                                    aria-label="Section layout"
                                >
                                    {SECTION_KINDS.map((k) => (
                                        <option key={k.value} value={k.value}>
                                            {k.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-400">
                                Colour
                                <input
                                    type="color"
                                    value={section.accent}
                                    onChange={(event) => onUpdateSection({ accent: event.target.value })}
                                    className="h-6 w-8 cursor-pointer rounded border border-slate-600 bg-slate-900"
                                    aria-label="Section color"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Field editors */}
                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Fields</div>
                        {section.fields.length === 0 && (
                            <p className="text-xs italic text-slate-500">No fields yet — add one below.</p>
                        )}
                        {section.fields.map((field) => {
                            const result = results.get(field.id)
                            const computedError = field.type === 'computed' && result && !result.ok
                            return (
                                <div key={field.id} className="rounded-md border border-slate-700 bg-slate-900/60 p-2">
                                    <div className="flex items-center gap-2">
                                        <input
                                            value={field.label}
                                            onChange={(event) => onUpdateField(field.id, { label: event.target.value })}
                                            className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                                            aria-label="Field label"
                                            placeholder="Label"
                                        />
                                        <select
                                            value={field.type}
                                            onChange={(event) => onUpdateField(field.id, { type: event.target.value as FieldType })}
                                            className="rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs text-slate-200"
                                            aria-label="Field type"
                                        >
                                            {FIELD_TYPES.map((type) => (
                                                <option key={type} value={type}>
                                                    {type}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mt-2 flex items-center gap-2">
                                        {field.type === 'boolean' ? (
                                            <label className="flex items-center gap-2 text-xs text-slate-300">
                                                <input
                                                    type="checkbox"
                                                    checked={field.value === 'true'}
                                                    onChange={(event) =>
                                                        onUpdateField(field.id, { value: event.target.checked ? 'true' : 'false' })
                                                    }
                                                />
                                                Enabled
                                            </label>
                                        ) : (
                                            <input
                                                value={field.value}
                                                onChange={(event) => onUpdateField(field.id, { value: event.target.value })}
                                                inputMode={field.type === 'number' ? 'decimal' : 'text'}
                                                placeholder={field.type === 'computed' ? 'formula e.g. floor((str-10)/2)' : 'value'}
                                                className={clsx(
                                                    'min-w-0 flex-1 rounded border bg-slate-900 px-2 py-1 text-xs',
                                                    computedError ? 'border-rose-600 text-rose-200' : 'border-slate-600 text-slate-100',
                                                    field.type === 'computed' && 'font-mono',
                                                )}
                                                aria-label="Field value or formula"
                                            />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => onMoveField(field.id, -1)}
                                            className="rounded border border-slate-600 px-1 text-xs text-slate-300 hover:bg-slate-700"
                                            aria-label="Move field up"
                                            title="Move up"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onMoveField(field.id, 1)}
                                            className="rounded border border-slate-600 px-1 text-xs text-slate-300 hover:bg-slate-700"
                                            aria-label="Move field down"
                                            title="Move down"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDeleteField(field.id)}
                                            className="rounded border border-rose-700/50 px-1 text-xs text-rose-300 hover:bg-rose-900/40"
                                            aria-label="Delete field"
                                            title="Delete field"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    {(field.type === 'counter' || field.type === 'resource') && (
                                        <input
                                            type="number"
                                            value={field.max ?? ''}
                                            onChange={(event) =>
                                                onUpdateField(field.id, {
                                                    max: event.target.value === '' ? undefined : Number(event.target.value),
                                                })
                                            }
                                            placeholder="max (optional)"
                                            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-400"
                                            aria-label="Max value"
                                        />
                                    )}

                                    {field.type === 'resource' && (
                                        <select
                                            value={field.meta?.recharge ?? 'long'}
                                            onChange={(event) => setMeta(field, 'recharge', event.target.value)}
                                            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                                            aria-label="Recharge"
                                        >
                                            <option value="short">Recharges on short rest</option>
                                            <option value="long">Recharges on long rest</option>
                                            <option value="none">Manual only</option>
                                        </select>
                                    )}

                                    {section.kind === 'skills' && (
                                        <div className="mt-2 grid grid-cols-2 gap-1">
                                            <input
                                                value={field.meta?.ability ?? ''}
                                                onChange={(event) => setMeta(field, 'ability', event.target.value)}
                                                placeholder="ability (e.g. STR)"
                                                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                                                aria-label="Skill ability"
                                            />
                                            <select
                                                value={field.meta?.prof ?? 'none'}
                                                onChange={(event) => setMeta(field, 'prof', event.target.value)}
                                                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                                                aria-label="Proficiency"
                                            >
                                                <option value="none">not proficient</option>
                                                <option value="proficient">proficient</option>
                                                <option value="expertise">expertise</option>
                                            </select>
                                            <input
                                                value={field.meta?.adv ?? ''}
                                                onChange={(event) => setMeta(field, 'adv', event.target.value)}
                                                placeholder="advantage note (optional)"
                                                className="col-span-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                                                aria-label="Advantage"
                                            />
                                            <label className="col-span-2 flex items-center gap-2 text-[11px] text-slate-400">
                                                <input
                                                    type="checkbox"
                                                    checked={field.meta?.auto === 'true'}
                                                    onChange={(event) => setMeta(field, 'auto', event.target.checked ? 'true' : 'false')}
                                                />
                                                Auto modifier (ability + proficiency)
                                            </label>
                                        </div>
                                    )}

                                    {section.kind === 'hitdice' && (
                                        <input
                                            value={field.meta?.die ?? ''}
                                            onChange={(event) => setMeta(field, 'die', event.target.value)}
                                            placeholder="die type (e.g. d12)"
                                            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                                            aria-label="Hit die type"
                                        />
                                    )}

                                    {section.kind === 'initiative' && (
                                        <input
                                            value={field.meta?.mod ?? ''}
                                            onChange={(event) => setMeta(field, 'mod', event.target.value)}
                                            placeholder="initiative modifier (e.g. +2)"
                                            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                                            aria-label="Initiative modifier"
                                        />
                                    )}

                                    {section.kind === 'actions' && (
                                        <div className="mt-2 grid grid-cols-3 gap-1">
                                            {(['hit', 'damage', 'type', 'extra', 'extraType', 'range', 'extraWhen', 'extraLabel', 'temp', 'cost', 'costField', 'costLabel', 'refill', 'refillCost'] as const).map((k) => (
                                                <input
                                                    key={k}
                                                    value={field.meta?.[k] ?? ''}
                                                    onChange={(event) => setMeta(field, k, event.target.value)}
                                                    placeholder={k}
                                                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                                                    aria-label={`Action ${k}`}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                                        Tag colour
                                        <input
                                            type="color"
                                            value={field.meta?.color ?? '#64748b'}
                                            onChange={(event) => setMeta(field, 'color', event.target.value)}
                                            className="h-5 w-7 cursor-pointer rounded border border-slate-700 bg-slate-900"
                                            aria-label="Field tag colour"
                                        />
                                        {field.meta?.color && (
                                            <button
                                                type="button"
                                                onClick={() => setMeta(field, 'color', '')}
                                                className="rounded border border-slate-700 px-1 text-slate-400 hover:bg-slate-800"
                                            >
                                                clear
                                            </button>
                                        )}
                                    </label>

                                    {field.type === 'computed' && (
                                        <div className="mt-2 rounded border border-slate-800 bg-slate-950/60 p-2">
                                            <div className="flex items-center gap-2 text-[11px]">
                                                <span className="text-slate-500">Result =</span>
                                                {result?.ok ? (
                                                    <span className="font-mono text-emerald-300">{result.value}</span>
                                                ) : (
                                                    <span className="font-mono text-rose-300">{result?.error ?? 'enter a formula'}</span>
                                                )}
                                            </div>
                                            {references.length > 0 && (
                                                <ReferenceInserter
                                                    references={references}
                                                    onInsert={(slug) => onUpdateField(field.id, { value: `${field.value}${slug}` })}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                        <button
                            type="button"
                            onClick={() => onAddField()}
                            className="mt-1 self-start rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                        >
                            + Add field
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
