import { clsx } from 'clsx'
import { useMemo, useRef, useState } from 'react'
import { characterSheetSchema, createStarterSheet } from './model/characterSheet'
import { computeSheet, listReferences } from './model/compute'
import { CanvasItem } from './components/CanvasItem'
import { SectionCard } from './components/SectionCard'
import { QuickStartModal } from './components/QuickStartModal'
import { exportSheetToFile, importSheetFromFile } from './state/transfer'
import { useSheet } from './state/useSheet'

function App() {
    const [isEditMode, setIsEditMode] = useState(false)
    const [showQuickStart, setShowQuickStart] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)
    const importRef = useRef<HTMLInputElement>(null)
    const {
        sheet,
        replaceSheet,
        renameSheet,
        updateSection,
        setSectionLayout,
        addSection,
        deleteSection,
        addField,
        updateField,
        deleteField,
        moveField,
    } = useSheet()

    const validation = useMemo(() => characterSheetSchema.safeParse(sheet), [sheet])
    const computed = useMemo(() => computeSheet(sheet), [sheet])
    const references = useMemo(() => listReferences(sheet, computed), [sheet, computed])

    const handleImport = async (file: File | undefined) => {
        if (!file) return
        const result = await importSheetFromFile(file)
        if (result.ok && result.sheet) {
            replaceSheet(result.sheet)
            setNotice('Sheet imported.')
        } else {
            setNotice(result.error)
        }
    }

    const handleReset = () => {
        if (window.confirm('Reset to a fresh starter sheet? This cannot be undone.')) {
            replaceSheet(createStarterSheet())
            setNotice('Sheet reset.')
        }
    }

    const canvasSize = useMemo(() => {
        const width = Math.max(
            960,
            ...sheet.sections.map((section) => section.layout.x + section.layout.w + 48),
        )
        const height = Math.max(
            520,
            ...sheet.sections.map((section) => section.layout.y + section.layout.h + 80),
        )
        return { width, height }
    }, [sheet.sections])

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 p-6 md:p-10">
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
                            Interactive D&amp;D cheat sheet — drag, resize, and edit anything.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowQuickStart(true)}
                            className="rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400"
                        >
                            Quick start
                        </button>
                        <button
                            type="button"
                            onClick={() => exportSheetToFile(sheet)}
                            className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                        >
                            Export
                        </button>
                        <button
                            type="button"
                            onClick={() => importRef.current?.click()}
                            className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                        >
                            Import
                        </button>
                        <input
                            ref={importRef}
                            type="file"
                            accept="application/json"
                            className="hidden"
                            onChange={(event) => {
                                void handleImport(event.target.files?.[0])
                                event.target.value = ''
                            }}
                        />
                        <button
                            type="button"
                            onClick={handleReset}
                            className="rounded-md border border-rose-700/50 px-3 py-2 text-sm text-rose-300 hover:bg-rose-900/40"
                        >
                            Reset
                        </button>
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
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
                    <span>Sections: {sheet.sections.length}</span>
                    <span className={validation.success ? 'text-emerald-300' : 'text-rose-300'}>
                        Model: {validation.success ? 'valid' : 'invalid'}
                    </span>
                    {notice && <span className="text-cyan-300">{notice}</span>}
                </div>
            </header>

            <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 md:p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                    <h2 className="m-0 text-lg font-semibold text-slate-100">Canvas</h2>
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

                <div className="overflow-auto">
                    <div
                        className={clsx(
                            'relative rounded-lg',
                            isEditMode && 'bg-[radial-gradient(circle,_rgba(148,163,184,0.12)_1px,_transparent_1px)] [background-size:16px_16px]',
                        )}
                        style={{ width: canvasSize.width, height: canvasSize.height }}
                    >
                        {sheet.sections.map((section) => (
                            <CanvasItem
                                key={section.id}
                                layout={section.layout}
                                isEditMode={isEditMode}
                                onLayoutCommit={(layout) => setSectionLayout(section.id, layout)}
                            >
                                <SectionCard
                                    section={section}
                                    isEditMode={isEditMode}
                                    results={computed}
                                    references={references}
                                    onUpdateSection={(patch) => updateSection(section.id, patch)}
                                    onDeleteSection={() => deleteSection(section.id)}
                                    onAddField={() => addField(section.id)}
                                    onUpdateField={(fieldId, patch) => updateField(section.id, fieldId, patch)}
                                    onDeleteField={(fieldId) => deleteField(section.id, fieldId)}
                                    onMoveField={(fieldId, direction) => moveField(section.id, fieldId, direction)}
                                />
                            </CanvasItem>
                        ))}
                    </div>
                </div>
            </section>

            {showQuickStart && (
                <QuickStartModal
                    onClose={() => setShowQuickStart(false)}
                    onConfirm={(imported) => {
                        replaceSheet(imported)
                        setShowQuickStart(false)
                        setIsEditMode(true)
                    }}
                />
            )}
        </main>
    )
}

export default App
