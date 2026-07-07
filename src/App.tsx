import { clsx } from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
    characterSheetSchema,
    createStarterSheet,
    type SectionLayout,
} from './model/characterSheet'
import { computeSheet, listReferences } from './model/compute'
import {
    resolveOverlap,
    tidyLayouts,
    alignEdge,
    matchDimension,
    distribute as distributeLayout,
    GAP,
    type Placed,
    type AlignEdge,
} from './model/layout'
import { CanvasItem, type SnapGuide, type CanvasItemHandle } from './components/CanvasItem'
import { SectionCard } from './components/SectionCard'
import { QuickStartModal } from './components/QuickStartModal'
import { exportSheetToFile, importSheetFromFile } from './state/transfer'
import { loadPresets, savePresets, type Presets } from './state/presets'
import { useSheet } from './state/useSheet'

function App() {
    const [isEditMode, setIsEditMode] = useState(false)
    const [showQuickStart, setShowQuickStart] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)
    const [guides, setGuides] = useState<SnapGuide[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [presets, setPresets] = useState<Presets>(() => loadPresets())
    const importRef = useRef<HTMLInputElement>(null)
    const fitRefs = useRef(new Map<string, CanvasItemHandle>())
    const {
        sheet,
        canUndo,
        canRedo,
        undo,
        redo,
        replaceSheet,
        renameSheet,
        updateSection,
        setSectionLayout,
        addSection,
        deleteSection,
        duplicateSection,
        rest,
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

    const commitLayout = (id: string, layout: SectionLayout) => {
        const others = sheet.sections.filter((s) => s.id !== id).map((s) => s.layout)
        setSectionLayout(id, resolveOverlap(layout, others))
    }

    const handleTidy = () => {
        const maxWidth = Math.max(1200, ...sheet.sections.map((s) => s.layout.w + GAP * 2))
        const items = sheet.sections.map((s) => ({ id: s.id, layout: s.layout }))
        for (const { id, layout } of tidyLayouts(items, maxWidth)) {
            setSectionLayout(id, layout)
        }
    }

    const handleFitAll = () => {
        for (const s of sheet.sections) {
            const handle = fitRefs.current.get(s.id)
            if (!handle) continue
            setSectionLayout(s.id, { ...s.layout, w: handle.measureWidth(), h: handle.measureHeight() })
        }
    }

    const handleSelect = (id: string, additive: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(additive ? prev : [])
            if (additive && prev.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const selectedItems = (): Placed[] =>
        sheet.sections.filter((s) => selectedIds.has(s.id)).map((s) => ({ id: s.id, layout: s.layout }))

    const applyPlaced = (items: Placed[]) => {
        for (const { id, layout } of items) setSectionLayout(id, layout)
    }

    const align = (edge: AlignEdge) => applyPlaced(alignEdge(selectedItems(), edge))
    const match = (dim: 'w' | 'h') => applyPlaced(matchDimension(selectedItems(), dim))
    const distribute = (axis: 'h' | 'v') => applyPlaced(distributeLayout(selectedItems(), axis))

    const savePreset = () => {
        const name = window.prompt('Save current layout as:')?.trim()
        if (!name) return
        const entries = sheet.sections.map((s) => ({ title: s.title, ...s.layout, scale: s.scale }))
        const next = { ...presets, [name]: entries }
        setPresets(next)
        savePresets(next)
        setNotice(`Layout "${name}" saved.`)
    }

    const applyPreset = (name: string) => {
        const preset = presets[name]
        if (!preset) return
        for (const s of sheet.sections) {
            const entry = preset.find((e) => e.title === s.title)
            if (entry) {
                updateSection(s.id, {
                    layout: { x: entry.x, y: entry.y, w: entry.w, h: entry.h },
                    scale: entry.scale,
                })
            }
        }
        setNotice(`Layout "${name}" applied.`)
    }

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey)) return
            const tag = (event.target as HTMLElement | null)?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
            const key = event.key.toLowerCase()
            if (key === 'z' && !event.shiftKey) {
                event.preventDefault()
                undo()
            } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
                event.preventDefault()
                redo()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [undo, redo])

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
                            onClick={undo}
                            disabled={!canUndo}
                            className={clsx(
                                'rounded-md border border-slate-600 px-3 py-2 text-sm',
                                canUndo ? 'text-slate-200 hover:bg-slate-800' : 'cursor-not-allowed text-slate-600',
                            )}
                            title="Undo (Ctrl+Z)"
                        >
                            ↶ Undo
                        </button>
                        <button
                            type="button"
                            onClick={redo}
                            disabled={!canRedo}
                            className={clsx(
                                'rounded-md border border-slate-600 px-3 py-2 text-sm',
                                canRedo ? 'text-slate-200 hover:bg-slate-800' : 'cursor-not-allowed text-slate-600',
                            )}
                            title="Redo (Ctrl+Shift+Z)"
                        >
                            ↷ Redo
                        </button>
                        <button
                            type="button"
                            onClick={() => rest('short')}
                            className="rounded-md border border-amber-700/50 px-3 py-2 text-sm text-amber-200 hover:bg-amber-900/30"
                            title="Short rest — refill short-rest resources"
                        >
                            Short rest
                        </button>
                        <button
                            type="button"
                            onClick={() => rest('long')}
                            className="rounded-md border border-indigo-700/50 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-900/30"
                            title="Long rest — restore HP, clear temp HP, reduce exhaustion, refill resources"
                        >
                            Long rest
                        </button>
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
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleTidy}
                            className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                            title="Auto-arrange sections into tidy rows"
                        >
                            Tidy
                        </button>
                        <button
                            type="button"
                            onClick={handleFitAll}
                            className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                            title="Shrink every section to its content (width + height)"
                        >
                            Fit all
                        </button>
                        <button
                            type="button"
                            onClick={savePreset}
                            className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                            title="Save the current arrangement as a named layout"
                        >
                            Save layout
                        </button>
                        {Object.keys(presets).length > 0 && (
                            <select
                                value=""
                                onChange={(event) => {
                                    if (event.target.value) applyPreset(event.target.value)
                                }}
                                className="rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                                aria-label="Apply saved layout"
                            >
                                <option value="" disabled>
                                    Apply layout…
                                </option>
                                {Object.keys(presets).map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        )}
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
                </div>

                {selectedIds.size > 0 && (
                    <div className="mb-3 flex flex-wrap items-center gap-1 rounded-md border border-cyan-800/50 bg-slate-900/60 p-2 text-xs text-slate-300">
                        <span className="mr-1 font-medium text-cyan-300">{selectedIds.size} selected</span>
                        {(
                            [
                                ['left', 'Left'],
                                ['hcenter', 'Center'],
                                ['right', 'Right'],
                                ['top', 'Top'],
                                ['vmiddle', 'Middle'],
                                ['bottom', 'Bottom'],
                            ] as const
                        ).map(([edge, label]) => (
                            <button
                                key={edge}
                                type="button"
                                onClick={() => align(edge)}
                                className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-800"
                                title={`Align ${label.toLowerCase()} (2+ selected)`}
                            >
                                {label}
                            </button>
                        ))}
                        <button type="button" onClick={() => match('w')} className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-800" title="Match width to first selected">Match W</button>
                        <button type="button" onClick={() => match('h')} className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-800" title="Match height to first selected">Match H</button>
                        <button type="button" onClick={() => distribute('h')} className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-800" title="Distribute horizontally (3+ selected)">Dist H</button>
                        <button type="button" onClick={() => distribute('v')} className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-800" title="Distribute vertically (3+ selected)">Dist V</button>
                        <button type="button" onClick={() => setSelectedIds(new Set())} className="ml-auto rounded border border-slate-700 px-2 py-1 text-slate-400 hover:bg-slate-800">Clear</button>
                    </div>
                )}

                <div className="overflow-auto">
                    <div
                        onPointerDown={(e) => {
                            if (e.target === e.currentTarget) setSelectedIds(new Set())
                        }}
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
                                scale={section.scale}
                                selected={selectedIds.has(section.id)}
                                siblings={sheet.sections
                                    .filter((s) => s.id !== section.id)
                                    .map((s) => s.layout)}
                                onLayoutCommit={(layout) => commitLayout(section.id, layout)}
                                onScaleChange={(scale) => updateSection(section.id, { scale })}
                                onGuidesChange={setGuides}
                                onSelect={(additive) => handleSelect(section.id, additive)}
                                handleRef={(h) => {
                                    if (h) fitRefs.current.set(section.id, h)
                                    else fitRefs.current.delete(section.id)
                                }}
                            >
                                <SectionCard
                                    section={section}
                                    isEditMode={isEditMode}
                                    results={computed}
                                    references={references}
                                    onUpdateSection={(patch) => updateSection(section.id, patch)}
                                    onDeleteSection={() => deleteSection(section.id)}
                                    onDuplicateSection={() => duplicateSection(section.id)}
                                    onAddField={() => addField(section.id)}
                                    onUpdateField={(fieldId, patch) => updateField(section.id, fieldId, patch)}
                                    onDeleteField={(fieldId) => deleteField(section.id, fieldId)}
                                    onMoveField={(fieldId, direction) => moveField(section.id, fieldId, direction)}
                                />
                            </CanvasItem>
                        ))}
                        {guides.map((g, i) => (
                            <div
                                key={i}
                                className="pointer-events-none absolute z-30 bg-cyan-400/70"
                                style={
                                    g.axis === 'x'
                                        ? { left: g.pos, top: 0, width: 1, height: canvasSize.height }
                                        : { top: g.pos, left: 0, height: 1, width: canvasSize.width }
                                }
                            />
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
