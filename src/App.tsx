import { clsx } from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
    createStarterSheet,
    slugify,
    type SectionLayout,
} from './model/characterSheet'
import { computeSheet, listReferences } from './model/compute'
import {
    resolveOverlap,
    tidyLayouts,
    alignEdge,
    matchDimension,
    distribute as distributeLayout,
    type Placed,
    type AlignEdge,
} from './model/layout'
import { CanvasItem, type SnapGuide, type CanvasItemHandle } from './components/CanvasItem'
import { SectionCard } from './components/SectionCard'
import { QuickStartModal } from './components/QuickStartModal'
import { RollLog } from './components/RollLog'
import { Menu, MenuItem, MenuDivider, MenuLabel } from './components/Menu'
import { exportSheetToFile, importSheetFromFile } from './state/transfer'
import { loadPresets, savePresets, type Presets } from './state/presets'
import { buildShareUrl, readSharedSheet, clearShareHash } from './state/share'
import { getActiveId } from './state/roster'
import { pushBackup, listBackups, restoreBackup } from './state/backups'
import { SECTION_TEMPLATES } from './state/templates'
import { useSheet } from './state/useSheet'
import { rollExpr, formatRoll } from './model/dice'
import type { D20Mode, RollLogEntry } from './model/dice'

function App() {
    const [isEditMode, setIsEditMode] = useState(false)
    const [showQuickStart, setShowQuickStart] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)
    const [guides, setGuides] = useState<SnapGuide[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [presets, setPresets] = useState<Presets>(() => loadPresets())
    const [rollMode, setRollMode] = useState<D20Mode>('normal')
    const [situational, setSituational] = useState(0)
    const [bonusDie, setBonusDie] = useState(0)
    const [repeat, setRepeat] = useState(1)
    const [stackView, setStackView] = useState(false)
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
    const [pinned, setPinned] = useState<Set<string>>(new Set())
    const [density, setDensity] = useState<'compact' | 'normal' | 'comfortable'>('normal')
    const [query, setQuery] = useState('')
    const [theme, setTheme] = useState<string>(() => {
        try {
            return localStorage.getItem(`character-sheet:theme:${getActiveId()}`) || '#8b5cf6'
        } catch {
            return '#8b5cf6'
        }
    })
    const [rollLog, setRollLog] = useState<RollLogEntry[]>(() => {
        try {
            const raw = localStorage.getItem(`character-sheet:rolllog:${getActiveId()}`)
            return raw ? (JSON.parse(raw) as RollLogEntry[]) : []
        } catch {
            return []
        }
    })
    const importRef = useRef<HTMLInputElement>(null)
    const captureRef = useRef<HTMLDivElement>(null)
    const canvasScrollRef = useRef<HTMLDivElement>(null)
    const fitRefs = useRef(new Map<string, CanvasItemHandle>())
    const {
        sheet,
        characters,
        activeId,
        switchCharacter,
        newCharacter,
        duplicateCharacter,
        deleteCharacter,
        canUndo,
        canRedo,
        undoLabel,
        redoLabel,
        undo,
        redo,
        replaceSheet,
        renameSheet,
        updateSection,
        setSectionLayout,
        setSectionLayouts,
        addSection,
        addTemplateSection,
        deleteSection,
        duplicateSection,
        rest,
        healHp,
        spendResource,
        toggleField,
        restoreResource,
        applyTempHp,
        setFieldValueSilent,
        addField,
        updateField,
        deleteField,
        moveField,
    } = useSheet()

    const computed = useMemo(() => computeSheet(sheet), [sheet])
    const references = useMemo(() => listReferences(sheet, computed), [sheet, computed])
    const scope = useMemo(() => {
        const s = Object.fromEntries(references.map((r) => [r.slug, r.value]))
        // Overlay resource/counter counts (e.g. moxie_points, luck_points) so
        // action costs and the Luck button can read live remaining values.
        for (const section of sheet.sections) {
            for (const field of section.fields) {
                if (field.type === 'resource' || field.type === 'counter') {
                    const n = Number(field.value)
                    if (!Number.isNaN(n)) s[slugify(field.label)] = n
                }
            }
        }
        return s
    }, [references, sheet])

    const pushRoll = (entry: Omit<RollLogEntry, 'id'>) =>
        setRollLog((log) => [{ ...entry, id: crypto.randomUUID() }, ...log].slice(0, 40))

    // Persist the roll log per character, and reload it when switching characters.
    const prevActiveRef = useRef(activeId)
    useEffect(() => {
        try {
            localStorage.setItem(`character-sheet:rolllog:${activeId}`, JSON.stringify(rollLog))
        } catch {
            /* ignore quota errors */
        }
    }, [rollLog, activeId])

    useEffect(() => {
        if (prevActiveRef.current === activeId) return
        prevActiveRef.current = activeId
        let next: RollLogEntry[]
        try {
            const raw = localStorage.getItem(`character-sheet:rolllog:${activeId}`)
            next = raw ? (JSON.parse(raw) as RollLogEntry[]) : []
        } catch {
            next = []
        }
        setRollLog(next)
        setTheme(localStorage.getItem(`character-sheet:theme:${activeId}`) || '#8b5cf6')
    }, [activeId])

    useEffect(() => {
        try {
            localStorage.setItem(`character-sheet:theme:${activeId}`, theme)
        } catch {
            /* ignore */
        }
    }, [theme, activeId])

    // Periodic local version history (throttled internally to ~1/min).
    useEffect(() => {
        pushBackup(activeId, sheet)
    }, [sheet, activeId])

    // Auto-set the "Bloodied" toggle when Current HP drops to half of Max HP or below.
    useEffect(() => {
        for (const section of sheet.sections) {
            const cur = section.fields.find((f) => f.label.toLowerCase() === 'current hp')
            const max = section.fields.find((f) => f.label.toLowerCase() === 'max hp')
            if (!cur || !max) continue
            const maxN = Number(max.value) || 0
            if (maxN <= 0) continue
            const bloodied = (Number(cur.value) || 0) <= maxN / 2
            for (const s of sheet.sections) {
                const flag = s.fields.find((f) => f.label.toLowerCase() === 'bloodied' && f.type === 'boolean')
                if (flag) {
                    const want = bloodied ? 'true' : 'false'
                    if (flag.value !== want) setFieldValueSilent(flag.id, want)
                }
            }
            break
        }
    }, [sheet, setFieldValueSilent])

    const spendLuck = () => {
        const left = scope['luck_points'] ?? 0
        if (left <= 0) {
            setNotice('No Luck Points left.')
            return
        }
        spendResource('luck_points', 1)
        pushRoll({ title: 'Luck Point', detail: `Spent 1 — Advantage on a d20 (or Disadvantage on an attack vs you) (${left - 1} left)`, total: left - 1, kind: 'raw' })
    }

    const rollFreeDice = (expr: string) => {
        const trimmed = expr.trim()
        if (!trimmed) return
        const r = rollExpr(trimmed)
        pushRoll({ title: trimmed, detail: formatRoll(r), total: r.total, kind: 'raw' })
    }

    const doRest = (kind: 'short' | 'long') => {
        rest(kind)
        pushRoll({
            title: kind === 'long' ? 'Long rest' : 'Short rest',
            detail: kind === 'long' ? 'HP restored, temp cleared, exhaustion −1, resources refilled' : 'Short-rest resources refilled',
            total: 0,
            kind: 'raw',
        })
        if (kind === 'short') setNotice('Short rest taken — spend Hit Dice on the Hit Dice card to heal.')
    }

    const levelField = (() => {
        for (const s of sheet.sections) {
            const f = s.fields.find((x) => x.label.toLowerCase() === 'level')
            if (f) return { sectionId: s.id, field: f }
        }
        return null
    })()
    const handleLevelUp = () => {
        if (!levelField) return
        const next = (Number(levelField.field.value) || 0) + 1
        updateField(levelField.sectionId, levelField.field.id, { value: String(next) })
        setNotice(`Leveled up to ${next}. Update HP max, hit dice, and features as needed.`)
    }

    const inspirationField = (() => {
        for (const s of sheet.sections) {
            const f = s.fields.find((x) => x.label.toLowerCase() === 'inspiration' && x.type === 'boolean')
            if (f) return { sectionId: s.id, field: f }
        }
        return null
    })()
    const toggleInspiration = () => {
        if (inspirationField) {
            updateField(inspirationField.sectionId, inspirationField.field.id, {
                value: inspirationField.field.value === 'true' ? 'false' : 'true',
            })
        }
    }

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

    const handleExportPng = async () => {
        const node = captureRef.current
        if (!node) return
        try {
            const { toPng } = await import('html-to-image')
            const dataUrl = await toPng(node, { backgroundColor: '#0f172a', pixelRatio: 2, cacheBust: true })
            const link = document.createElement('a')
            link.download = `${sheet.name || 'character-sheet'}.png`
            link.href = dataUrl
            link.click()
            setNotice('Exported PNG.')
        } catch {
            setNotice('PNG export failed.')
        }
    }

    const handleShare = async () => {
        const url = buildShareUrl(sheet)
        try {
            await navigator.clipboard.writeText(url)
            setNotice('Share link copied to clipboard.')
        } catch {
            window.prompt('Copy this share link:', url)
        }
    }

    const handleDeleteCharacter = () => {
        const name = characters.find((c) => c.id === activeId)?.name ?? 'this character'
        if (window.confirm(`Delete “${name}”? This cannot be undone.`)) {
            deleteCharacter(activeId)
            setNotice('Character deleted.')
        }
    }

    const handleRestore = (ts: number) => {
        const restored = restoreBackup(activeId, ts)
        if (restored) {
            replaceSheet(restored)
            setNotice('Restored an earlier version.')
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

    /** Measure every card's natural content size (width clamped so text cards don't
     *  blow out). Best run in play mode — edit mode renders bulky field editors. */
    const fittedItems = (): Placed[] =>
        sheet.sections.map((s) => {
            const handle = fitRefs.current.get(s.id)
            const w = handle ? Math.min(340, handle.measureWidth()) : s.layout.w
            const h = handle ? handle.measureHeight() : s.layout.h
            return { id: s.id, layout: { ...s.layout, w, h } }
        })

    const handleTidy = () => {
        // Fit each card to its content, then skyline-pack so tiles sit flush.
        const width = canvasScrollRef.current?.clientWidth ?? 1200
        setSectionLayouts(tidyLayouts(fittedItems(), width))
    }

    const handleFitAll = () => {
        // Resize each card to its content in place, keeping the current arrangement.
        setSectionLayouts(fittedItems())
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
        const shared = readSharedSheet()
        if (!shared) return
        // Defer past the effect's synchronous phase before prompting/committing.
        queueMicrotask(() => {
            if (window.confirm(`Load shared character “${shared.name}”? This replaces your current sheet.`)) {
                replaceSheet(shared)
                setNotice('Shared character loaded.')
            }
            clearShareHash()
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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

    const toggleCollapse = (id: string) =>
        setCollapsed((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })

    const togglePin = (id: string) =>
        setPinned((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })

    const densityZoom = density === 'compact' ? 0.9 : density === 'comfortable' ? 1.12 : 1
    // The free canvas zooms with density in both modes; CanvasItem divides drag
    // deltas by this factor so moving/resizing still tracks the cursor 1:1.
    const canvasZoom = densityZoom
    const matchesQuery = (section: (typeof sheet.sections)[number]) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        if (section.title.toLowerCase().includes(q)) return true
        return section.fields.some(
            (f) => f.label.toLowerCase().includes(q) || (f.description ?? '').toLowerCase().includes(q),
        )
    }
    const visibleSections = sheet.sections.filter(matchesQuery)
    const stackSections = [...visibleSections].sort(
        (a, b) => (pinned.has(a.id) ? 0 : 1) - (pinned.has(b.id) ? 0 : 1),
    )

    const renderCard = (section: (typeof sheet.sections)[number], collapsible: boolean) => (
        <SectionCard
            section={section}
            isEditMode={isEditMode}
            results={computed}
            references={references}
            scope={scope}
            rollMode={rollMode}
            bonus={situational}
            bonusDie={bonusDie}
            repeat={repeat}
            onRoll={pushRoll}
            onHeal={healHp}
            onSpend={spendResource}
            onRestore={restoreResource}
            onToggleFlag={toggleField}
            onTempHp={applyTempHp}
            onUpdateSection={(patch) => updateSection(section.id, patch)}
            onDeleteSection={() => deleteSection(section.id)}
            onDuplicateSection={() => duplicateSection(section.id)}
            onAddField={(overrides) => addField(section.id, overrides)}
            onUpdateField={(fieldId, patch) => updateField(section.id, fieldId, patch)}
            onDeleteField={(fieldId) => deleteField(section.id, fieldId)}
            onMoveField={(fieldId, direction) => moveField(section.id, fieldId, direction)}
            collapsed={collapsible ? collapsed.has(section.id) : undefined}
            onToggleCollapse={collapsible ? () => toggleCollapse(section.id) : undefined}
            pinned={collapsible ? pinned.has(section.id) : undefined}
            onTogglePin={collapsible ? () => togglePin(section.id) : undefined}
        />
    )

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 p-6 md:p-10">
            <header className="rounded-xl border border-slate-700 bg-slate-900/75 p-6" style={{ borderTopColor: theme, borderTopWidth: 3 }}>
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
                        <select
                            value={activeId}
                            onChange={(event) => switchCharacter(event.target.value)}
                            className="max-w-[10rem] rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                            aria-label="Active character"
                            title="Switch character"
                        >
                            {characters.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {(c.id === activeId ? sheet.name : c.name) || 'Unnamed'}
                                </option>
                            ))}
                        </select>
                        <Menu label="Character ▾" title="Character actions" align="left">
                            {(close) => (
                                <>
                                    <MenuItem onClick={() => { newCharacter(); close() }}>+ New character</MenuItem>
                                    <MenuItem onClick={() => { duplicateCharacter(); close() }}>Duplicate character</MenuItem>
                                    {listBackups(activeId).length > 0 && (
                                        <>
                                            <MenuDivider />
                                            <MenuLabel>Restore earlier version</MenuLabel>
                                            {listBackups(activeId).map((b) => (
                                                <MenuItem key={b.ts} onClick={() => { handleRestore(b.ts); close() }}>
                                                    {new Date(b.ts).toLocaleString()}
                                                </MenuItem>
                                            ))}
                                        </>
                                    )}
                                    <MenuDivider />
                                    <MenuItem danger onClick={() => { handleReset(); close() }}>Reset to starter sheet</MenuItem>
                                    <MenuItem danger onClick={() => { handleDeleteCharacter(); close() }}>Delete character</MenuItem>
                                </>
                            )}
                        </Menu>

                        <span className="mx-1 hidden h-6 w-px bg-slate-700 sm:block" aria-hidden="true" />

                        <button
                            type="button"
                            onClick={undo}
                            disabled={!canUndo}
                            className={clsx(
                                'rounded-md border border-slate-600 px-3 py-2 text-sm',
                                canUndo ? 'text-slate-200 hover:bg-slate-800' : 'cursor-not-allowed text-slate-600',
                            )}
                            title={undoLabel ? `Undo: ${undoLabel} (Ctrl+Z)` : 'Undo (Ctrl+Z)'}
                            aria-label="Undo"
                        >
                            ↶
                        </button>
                        <button
                            type="button"
                            onClick={redo}
                            disabled={!canRedo}
                            className={clsx(
                                'rounded-md border border-slate-600 px-3 py-2 text-sm',
                                canRedo ? 'text-slate-200 hover:bg-slate-800' : 'cursor-not-allowed text-slate-600',
                            )}
                            title={redoLabel ? `Redo: ${redoLabel} (Ctrl+Shift+Z)` : 'Redo (Ctrl+Shift+Z)'}
                            aria-label="Redo"
                        >
                            ↷
                        </button>
                        {inspirationField && (
                            <button
                                type="button"
                                onClick={toggleInspiration}
                                className={clsx(
                                    'rounded-md border px-3 py-2 text-sm font-medium',
                                    inspirationField.field.value === 'true'
                                        ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                                        : 'border-slate-600 text-slate-400 hover:bg-slate-800',
                                )}
                                title="Inspiration"
                            >
                                ★ Inspiration
                            </button>
                        )}
                        <Menu label="Rest ▾" title="Take a short or long rest">
                            {(close) => (
                                <>
                                    <MenuItem onClick={() => { doRest('short'); close() }} title="Refill short-rest resources">
                                        Short rest
                                    </MenuItem>
                                    <MenuItem onClick={() => { doRest('long'); close() }} title="Restore HP, clear temp HP, reduce exhaustion, refill resources">
                                        Long rest
                                    </MenuItem>
                                </>
                            )}
                        </Menu>
                        {levelField && (
                            <button
                                type="button"
                                onClick={handleLevelUp}
                                className="rounded-md border border-emerald-700/50 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-900/30"
                                title="Increase your level by one"
                            >
                                Level up
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowQuickStart(true)}
                            className="rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400"
                        >
                            Quick start
                        </button>

                        <span className="mx-1 hidden h-6 w-px bg-slate-700 sm:block" aria-hidden="true" />

                        <Menu label="⋯ More" title="Import, export, and share" align="right">
                            {(close) => (
                                <>
                                    <MenuLabel>Data</MenuLabel>
                                    <MenuItem onClick={() => { exportSheetToFile(sheet); close() }} title="Download this sheet as JSON">
                                        Export JSON
                                    </MenuItem>
                                    <MenuItem onClick={() => { importRef.current?.click(); close() }} title="Load a sheet from a JSON file">
                                        Import JSON…
                                    </MenuItem>
                                    <MenuItem onClick={() => { void handleShare(); close() }} title="Copy a shareable link that contains this whole sheet">
                                        Copy share link
                                    </MenuItem>
                                    <MenuDivider />
                                    <MenuLabel>Export image</MenuLabel>
                                    <MenuItem onClick={() => { window.print(); close() }} title="Print or save the sheet as a PDF">
                                        Print / PDF
                                    </MenuItem>
                                    <MenuItem onClick={() => { void handleExportPng(); close() }} title="Export the canvas as a PNG image">
                                        Export PNG
                                    </MenuItem>
                                </>
                            )}
                        </Menu>
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
                        <label className="flex items-center rounded-md border border-slate-600 px-2 py-1" title="Character colour theme">
                            <input
                                type="color"
                                value={theme}
                                onChange={(e) => setTheme(e.target.value)}
                                aria-label="Theme colour"
                                className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                            />
                        </label>
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

                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span title="Your sheet is saved automatically in this browser">✓ Autosaved locally</span>
                    {notice && <span className="text-cyan-300">{notice}</span>}
                </div>
            </header>

            <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 md:p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                    <h2 className="m-0 text-lg font-semibold text-slate-100">Canvas</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search sections / fields…"
                            aria-label="Search"
                            className="w-44 rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                        />
                        {query && (
                            <button type="button" onClick={() => setQuery('')} className="rounded-md border border-slate-600 px-2 py-2 text-sm text-slate-400 hover:bg-slate-800" title="Clear search">✕</button>
                        )}
                        <button
                            type="button"
                            onClick={() => setDensity((d) => (d === 'compact' ? 'normal' : d === 'normal' ? 'comfortable' : 'compact'))}
                            className="rounded-md border border-slate-600 px-3 py-2 text-sm capitalize text-slate-200 hover:bg-slate-800"
                            title="Cycle display density — Compact / Normal / Comfortable"
                        >
                            {density}
                        </button>
                        <button
                            type="button"
                            onClick={() => setStackView((v) => !v)}
                            className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                            title="Toggle between the free canvas and a responsive stacked layout"
                        >
                            {stackView ? 'Canvas view' : 'Stack view'}
                        </button>
                        {!stackView && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleTidy}
                                    className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                                    title="Fit every card to its content and pack them tightly (best in play mode)"
                                >
                                    Tidy
                                </button>
                                <button
                                    type="button"
                                    onClick={handleFitAll}
                                    className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                                    title="Resize each card to its content, keeping its position"
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
                            </>
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
                        {isEditMode && (
                            <select
                                aria-label="Add section from template"
                                value=""
                                onChange={(e) => {
                                    const tpl = SECTION_TEMPLATES.find((t) => t.id === e.target.value)
                                    if (tpl) addTemplateSection(tpl)
                                    e.target.value = ''
                                }}
                                className="rounded-md border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-slate-200 hover:bg-slate-700"
                            >
                                <option value="">+ Template…</option>
                                {SECTION_TEMPLATES.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
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

                {stackView ? (
                    <div ref={captureRef} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" style={{ zoom: densityZoom }}>
                        {stackSections.map((section) => (
                            <div key={section.id}>{renderCard(section, true)}</div>
                        ))}
                    </div>
                ) : (
                    <div ref={canvasScrollRef} className="overflow-auto">
                        <div
                            ref={captureRef}
                            onPointerDown={(e) => {
                                if (e.target === e.currentTarget) setSelectedIds(new Set())
                            }}
                            className={clsx(
                                'relative rounded-lg',
                                isEditMode && 'bg-[radial-gradient(circle,_rgba(148,163,184,0.12)_1px,_transparent_1px)] [background-size:16px_16px]',
                            )}
                            style={{ width: canvasSize.width, height: canvasSize.height, zoom: canvasZoom }}
                        >
                            {visibleSections.map((section) => (
                                <CanvasItem
                                    key={section.id}
                                    layout={section.layout}
                                    scale={section.scale}
                                    zoom={canvasZoom}
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
                                    {renderCard(section, false)}
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
                )}
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

            <RollLog
                entries={rollLog}
                rollMode={rollMode}
                onRollModeChange={setRollMode}
                bonus={situational}
                onBonusChange={setSituational}
                bonusDie={bonusDie}
                onBonusDieChange={setBonusDie}
                repeat={repeat}
                onRepeatChange={setRepeat}
                luck={scope['luck_points']}
                onSpendLuck={spendLuck}
                onRollDice={rollFreeDice}
                onClear={() => setRollLog([])}
            />
        </main>
    )
}

export default App
