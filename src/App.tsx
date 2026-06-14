import { clsx } from 'clsx'
import { useMemo, useState } from 'react'
import {
    characterSheetSchema,
    createSection,
    createStarterSheet,
    type CharacterSection,
} from './model/characterSheet'

function App() {
    const [isEditMode, setIsEditMode] = useState(false)
    const [sheet, setSheet] = useState(createStarterSheet)

    const validation = useMemo(() => characterSheetSchema.safeParse(sheet), [sheet])

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
                        <h1 className="m-0 text-3xl font-semibold text-slate-100">Editable Canvas Skeleton</h1>
                        <p className="mt-2 text-sm text-slate-300">
                            Phase proof: typed model + add section flow.
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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {sheet.sections.map((section) => (
                        <article key={section.id} className="rounded-lg border border-slate-700 bg-slate-950/60 p-4">
                            {isEditMode ? (
                                <>
                                    <input
                                        value={section.title}
                                        onChange={(event) => updateSection(section.id, { title: event.target.value })}
                                        className="mb-2 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                                        aria-label="Section title"
                                    />
                                    <textarea
                                        value={section.description}
                                        onChange={(event) => updateSection(section.id, { description: event.target.value })}
                                        className="min-h-24 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                                        aria-label="Section description"
                                    />
                                </>
                            ) : (
                                <>
                                    <h3 className="m-0 text-base font-semibold text-slate-100">{section.title}</h3>
                                    <p className="mt-2 text-sm text-slate-300">{section.description}</p>
                                </>
                            )}
                        </article>
                    ))}
                </div>
            </section>
        </main>
    )
}

export default App
