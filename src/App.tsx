import { clsx } from 'clsx'
import { useMemo, useState } from 'react'
import { characterSheetSchema } from './model/characterSheet'
import { computeSheet } from './model/compute'
import { SectionCard } from './components/SectionCard'
import { useSheet } from './state/useSheet'

function App() {
    const [isEditMode, setIsEditMode] = useState(false)
    const {
        sheet,
        renameSheet,
        updateSection,
        addSection,
        deleteSection,
        addField,
        updateField,
        deleteField,
        moveField,
    } = useSheet()

    const validation = useMemo(() => characterSheetSchema.safeParse(sheet), [sheet])
    const computed = useMemo(() => computeSheet(sheet), [sheet])

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
            <header className="rounded-xl border border-slate-700 bg-slate-900/75 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">CharacterSheet</p>
                        {isEditMode ? (
                            <input
                                value={sheet.name}
                                onChange={(event) => renameSheet(event.target.value)}
                                className="m-0 mt-1 w-full max-w-md rounded-md border border-slate-600 bg-slate-900 px-3 py-1 text-2xl font-semibold text-slate-100"
                                aria-label="Character name"
                            />
                        ) : (
                            <h1 className="m-0 text-3xl font-semibold text-slate-100">{sheet.name}</h1>
                        )}
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
                        {isEditMode ? 'Done editing' : 'Edit'}
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
                        <SectionCard
                            key={section.id}
                            section={section}
                            isEditMode={isEditMode}
                            results={computed}
                            onUpdateSection={(patch) => updateSection(section.id, patch)}
                            onDeleteSection={() => deleteSection(section.id)}
                            onAddField={() => addField(section.id)}
                            onUpdateField={(fieldId, patch) => updateField(section.id, fieldId, patch)}
                            onDeleteField={(fieldId) => deleteField(section.id, fieldId)}
                            onMoveField={(fieldId, direction) => moveField(section.id, fieldId, direction)}
                        />
                    ))}
                </div>
            </section>
        </main>
    )
}

export default App
