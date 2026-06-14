import { clsx } from 'clsx'
import type { FormulaResult } from '../model/formula'
import type { FieldReference } from '../model/compute'
import { Tooltip } from './Tooltip'
import {
    type CharacterField,
    type CharacterSection,
    type FieldType,
} from '../model/characterSheet'

interface SectionCardProps {
    section: CharacterSection
    isEditMode: boolean
    results: Map<string, FormulaResult>
    references: FieldReference[]
    onUpdateSection: (
        patch: Partial<Pick<CharacterSection, 'title' | 'description' | 'accent'>>,
    ) => void
    onDeleteSection: () => void
    onAddField: () => void
    onUpdateField: (fieldId: string, patch: Partial<CharacterField>) => void
    onDeleteField: (fieldId: string) => void
    onMoveField: (fieldId: string, direction: -1 | 1) => void
}

const FIELD_TYPES: FieldType[] = ['text', 'number', 'boolean', 'computed']

const displayValue = (
    field: CharacterField,
    results: Map<string, FormulaResult>,
): string => {
    if (field.type === 'computed') {
        const result = results.get(field.id)
        return result?.ok && result.value !== null ? String(result.value) : '—'
    }
    if (field.type === 'boolean') return field.value === 'true' ? 'Yes' : 'No'
    return field.value || '—'
}

export function SectionCard({
    section,
    isEditMode,
    results,
    references,
    onUpdateSection,
    onDeleteSection,
    onAddField,
    onUpdateField,
    onDeleteField,
    onMoveField,
}: SectionCardProps) {
    return (
        <article
            className="flex h-full min-h-full flex-col rounded-lg border border-slate-700 bg-slate-950/60 p-4"
            style={{ borderTopColor: section.accent, borderTopWidth: 3 }}
        >
            <header className="mb-2 flex items-start justify-between gap-2">
                {isEditMode ? (
                    <input
                        value={section.title}
                        onChange={(event) => onUpdateSection({ title: event.target.value })}
                        className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm font-semibold text-slate-100"
                        aria-label="Section title"
                    />
                ) : (
                    <h3 className="m-0 text-base font-semibold text-slate-100">{section.title}</h3>
                )}
                {isEditMode && (
                    <button
                        type="button"
                        onClick={onDeleteSection}
                        className="shrink-0 rounded-md border border-rose-700/50 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/40"
                        aria-label="Delete section"
                        title="Delete section"
                    >
                        ✕
                    </button>
                )}
            </header>

            {isEditMode ? (
                <input
                    value={section.description}
                    onChange={(event) => onUpdateSection({ description: event.target.value })}
                    placeholder="Section description (optional)"
                    className="mb-3 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300"
                    aria-label="Section description"
                />
            ) : (
                section.description && (
                    <p className="mt-0 mb-3 text-xs text-slate-400">{section.description}</p>
                )
            )}

            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {section.fields.map((field) => {
                    const result = results.get(field.id)
                    const computedError = field.type === 'computed' && result && !result.ok
                    return (
                        <li key={field.id} className="flex flex-col gap-1">
                            {isEditMode ? (
                                <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2">
                                    <div className="flex items-center gap-2">
                                        <input
                                            value={field.label}
                                            onChange={(event) =>
                                                onUpdateField(field.id, { label: event.target.value })
                                            }
                                            className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                                            aria-label="Field label"
                                            placeholder="Label"
                                        />
                                        <select
                                            value={field.type}
                                            onChange={(event) =>
                                                onUpdateField(field.id, {
                                                    type: event.target.value as FieldType,
                                                })
                                            }
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
                                                        onUpdateField(field.id, {
                                                            value: event.target.checked ? 'true' : 'false',
                                                        })
                                                    }
                                                />
                                                Enabled
                                            </label>
                                        ) : (
                                            <input
                                                value={field.value}
                                                onChange={(event) =>
                                                    onUpdateField(field.id, { value: event.target.value })
                                                }
                                                inputMode={field.type === 'number' ? 'decimal' : 'text'}
                                                placeholder={
                                                    field.type === 'computed' ? 'formula e.g. floor((str-10)/2)' : 'value'
                                                }
                                                className={clsx(
                                                    'min-w-0 flex-1 rounded border bg-slate-900 px-2 py-1 text-xs',
                                                    computedError
                                                        ? 'border-rose-600 text-rose-200'
                                                        : 'border-slate-600 text-slate-100',
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

                                    <input
                                        value={field.description}
                                        onChange={(event) =>
                                            onUpdateField(field.id, { description: event.target.value })
                                        }
                                        placeholder="On-hover description (optional)"
                                        className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-400"
                                        aria-label="Field description"
                                    />

                                    {field.type === 'computed' && (
                                        <div className="mt-2">
                                            <div className="flex items-center gap-2 text-[11px]">
                                                <span className="text-slate-500">=</span>
                                                {result?.ok ? (
                                                    <span className="font-mono text-emerald-300">{result.value}</span>
                                                ) : (
                                                    <span className="font-mono text-rose-300">
                                                        {result?.error ?? 'enter a formula'}
                                                    </span>
                                                )}
                                            </div>
                                            {references.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {references.map((ref) => (
                                                        <button
                                                            key={ref.slug}
                                                            type="button"
                                                            onClick={() =>
                                                                onUpdateField(field.id, {
                                                                    value: `${field.value}${ref.slug}`,
                                                                })
                                                            }
                                                            className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 hover:bg-slate-700"
                                                            title={`${ref.label} = ${ref.value}`}
                                                        >
                                                            {ref.slug}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div
                                    className="flex items-center justify-between gap-3 text-sm"
                                >
                                    {field.description ? (
                                        <Tooltip content={field.description}>
                                            <span className="cursor-help text-slate-400 underline decoration-dotted decoration-slate-600 underline-offset-4">
                                                {field.label}
                                            </span>
                                        </Tooltip>
                                    ) : (
                                        <span className="text-slate-400">{field.label}</span>
                                    )}
                                    <span
                                        className={clsx(
                                            'font-mono',
                                            field.type === 'computed'
                                                ? result?.ok
                                                    ? 'text-emerald-300'
                                                    : 'text-rose-300'
                                                : 'text-slate-100',
                                        )}
                                    >
                                        {displayValue(field, results)}
                                    </span>
                                </div>
                            )}
                        </li>
                    )
                })}
                {section.fields.length === 0 && !isEditMode && (
                    <li className="text-xs italic text-slate-500">No fields yet.</li>
                )}
            </ul>

            {isEditMode && (
                <button
                    type="button"
                    onClick={onAddField}
                    className="mt-3 rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                >
                    + Add field
                </button>
            )}
        </article>
    )
}
