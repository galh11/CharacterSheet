import { clsx } from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import {
    characterSheetSchema,
    createSection,
    type CharacterSection,
} from './model/characterSheet'
import { computeSheet } from './model/compute'
import { loadSheet, saveSheet } from './state/persistence'

function App() {
    const [isEditMode, setIsEditMode] = useState(false)
    const [sheet, setSheet] = useState(loadSheet)

    useEffect(() => {
        saveSheet(sheet)
    }, [sheet])

    const validation = useMemo(() => characterSheetSchema.safeParse(sheet), [sheet])
    const computed = useMemo(() => computeSheet(sheet), [sheet])

    const updateSection = (
        sectionId: string,
        patch: Partial<Pick<CharacterSection, 'title' | 'description'>>,
    ) => {
        setSheet((current) => ({
            ...current,
            sections: current.sections.map((section) =>
                section.id === sectionId ? { ...section, ...patch } : section,
            ),
        }))
    }

    const updateFieldValue = (sectionId: string, fieldId: string, value: string) => {
        setSheet((current) => ({
            ...current,
            sections: current.sections.map((section) =>
                section.id === sectionId
                    ? {
                          ...section,
                          fields: section.fields.map((field) =>
                              field.id === fieldId ? { ...field, value } : field,
                          ),
                      }
                    : section,
            ),
        }))
    }

    const addSection = () => {
        setSheet((current) => ({
            ...current,
            sections: [...current.sections, createSection(current.sections.length)],
        }))
    }

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
            <header className="rounded-xl border border-slate-700 bg-slate-900/75 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">CharacterSheet</p>
                        <h1 className="m-0 text-3xl font-semibold text-slate-100">{sheet.name}</h1>
                        <p className="mt-2 text-sm text-slate-300">
                            Interactive D&amp;D cheat sheet — typed fields with live calculations.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsEditMode((current) => !current)}
                        className={clsx(
                            'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                            isEditMode
                                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                                : 'bg-slate-700 text-slate-200 hover:bg-slate-600',
                        )}
                    >
                        {isEditMode ? 'Edit mode enabled' : 'Edit mode disabled'}
                    </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
                    <span>Sections: {sheet.sections.length}</span>
                    <span className={validation.success ? 'text-emerald-300' : 'text-rose-300'}>
                        Model: {validation.success ? 'valid' : 'invalid'}
                    </span>
                </div>
            </header>

            <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 md:p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                    <h2 className="m-0 text-lg font-semibold text-slate-100">Canvas Sections</h2>
                    {isEditMode && (
                        <button
                            type="button"
                            onClick={addSection}
                            className="rounded-md bg-violet-500 px-3 py-2 text-sm font-medium text-white hover:bg-violet-400"
                        >
                            Add section
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {sheet.sections.map((section) => (
                        <article
                            key={section.id}
                            className="rounded-lg border border-slate-700 bg-slate-950/60 p-4"
                            style={{ borderTopColor: section.accent, borderTopWidth: 3 }}
                        >
                            {isEditMode ? (
                                <input
                                    value={section.title}
                                    onChange={(event) => updateSection(section.id, { title: event.target.value })}
                                    className="mb-2 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100"
                                    aria-label="Section title"
                                />
                            ) : (
                                <h3 className="m-0 text-base font-semibold text-slate-100">{section.title}</h3>
                            )}

                            {section.description && (
                                <p className="mt-1 mb-2 text-xs text-slate-400">{section.description}</p>
                            )}

                            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                                {section.fields.map((field) => {
                                    const result = computed.get(field.id)
                                    return (
                                        <li
                                            key={field.id}
                                            className="flex items-center justify-between gap-3 text-sm"
                                            title={field.description || undefined}
                                        >
                                            <span className="text-slate-400">{field.label}</span>
                                            {field.type === 'computed' ? (
                                                <span
                                                    className={clsx(
                                                        'font-mono',
                                                        result?.ok ? 'text-emerald-300' : 'text-rose-300',
                                                    )}
                                                >
                                                    {result?.ok ? result.value : '!'}
                                                </span>
                                            ) : isEditMode ? (
                                                <input
                                                    value={field.value}
                                                    onChange={(event) =>
                                                        updateFieldValue(section.id, field.id, event.target.value)
                                                    }
                                                    className="w-24 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-right text-slate-100"
                                                    aria-label={field.label}
                                                />
                                            ) : (
                                                <span className="font-mono text-slate-100">{field.value}</span>
                                            )}
                                        </li>
                                    )
                                })}
                                {section.fields.length === 0 && (
                                    <li className="text-xs italic text-slate-500">No fields yet.</li>
                                )}
                            </ul>
                        </article>
                    ))}
                </div>
            </section>
        </main>
    )
}

export default App
