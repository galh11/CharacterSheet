import { clsx } from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
    createStarterSheet,
    slugify,
    type SectionLayout,
} from './model/characterSheet'
import { resolveSheet, listReferences, listResourceReferences } from './model/compute'
import { CanvasItem, type SnapGuide, type CanvasItemHandle } from './components/CanvasItem'
import { SectionCard } from './components/SectionCard'
import { SectionQuickEdit } from './components/SectionQuickEdit'
import { SectionEditorModal } from './components/SectionEditorModal'
import { HeaderToolbar } from './components/HeaderToolbar'
import { HitDiceModal, type HitDieEntry } from './components/HitDiceModal'
import { AboutModal } from './components/AboutModal'
import { UpdateToast } from './components/UpdateToast'
import { useToast } from './components/toastContext'
import { RollLog } from './components/RollLog'
import { EmptyCanvas } from './components/EmptyCanvas'
import { useAppUpdate } from './state/useAppUpdate'
import { importSheetFromFile } from './state/transfer'
import { buildShareUrl, readSharedSheet, clearShareHash } from './state/share'
import { getActiveId } from './state/roster'
import { pushBackup, restoreBackup } from './state/backups'
import { useSheet } from './state/useSheet'
import { usePersistentState, boolCodec, type Codec } from './state/usePersistentState'
import { useRollLog } from './state/useRollLog'
import { useSelection } from './state/useSelection'
import { usePresets } from './state/usePresets'
import { useCanvasGridLayout } from './state/useCanvasGridLayout'
import { useDrawerDrag, inDrawer } from './state/useDrawerDrag'
import { rollExpr, formatRoll } from './model/dice'
import type { D20Mode } from './model/dice'

/** Read an image file, downscale it to fit within `max` px (keeping aspect
 *  ratio), and return a compact JPEG data URL suitable for localStorage. */
const readImageAsDataUrl = (file: File, max: number): Promise<string> =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
            URL.revokeObjectURL(url)
            const scale = Math.min(1, max / Math.max(img.width, img.height))
            const w = Math.max(1, Math.round(img.width * scale))
            const h = Math.max(1, Math.round(img.height * scale))
            const canvas = document.createElement('canvas')
            canvas.width = w
            canvas.height = h
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('no canvas context'))
                return
            }
            ctx.drawImage(img, 0, 0, w, h)
            resolve(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error('image load failed'))
        }
        img.src = url
    })

/** Width of the sliding drawer panel (never wider than the viewport). */
const DRAWER_W = 'min(440px, 92vw)'

/** Column-count presets for the dashboard grid (chosen in the View menu). */
const GRID_COL_OPTIONS = [6, 8, 12] as const

/** Whole-sheet zoom preset (persisted). */
type Density = 'compact' | 'normal' | 'comfortable'

/** Codec for the density preset, validating unknown stored values back to normal. */
const densityCodec: Codec<Density> = {
    parse: (raw) => (raw === 'compact' || raw === 'comfortable' ? raw : 'normal'),
    serialize: (value) => value,
}

/** Codec for the grid column count, clamped to the allowed presets. */
const gridColsCodec: Codec<number> = {
    parse: (raw) => {
        const n = Number(raw)
        return (GRID_COL_OPTIONS as readonly number[]).includes(n) ? n : 12
    },
    serialize: (value) => String(value),
}

function App() {
    const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
    // Collapse the side nav down to a slim icon rail (persisted, desktop only).
    const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState('character-sheet:sidebar-collapsed', false, boolCodec)
    // Open the side nav as an overlay on narrow (mobile) widths.
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const [showHitDice, setShowHitDice] = useState(false)
    const [showAbout, setShowAbout] = useState(false)
    const toast = useToast()
    const appUpdate = useAppUpdate()
    const handleCheckUpdate = async () => {
        toast('Checking for updates…')
        const found = await appUpdate.checkForUpdate()
        if (!found) toast("You're on the latest version.")
    }
    const [guides, setGuides] = useState<SnapGuide[]>([])
    const [rollMode, setRollMode] = useState<D20Mode>('normal')
    const [situational, setSituational] = useState(0)
    const [bonusDie, setBonusDie] = useState(0)
    const [repeat, setRepeat] = useState(1)
    const [stackView, setStackView] = useState(false)
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
    const [pinned, setPinned] = useState<Set<string>>(new Set())
    // Drag-to-reorder in the stack view: the section being dragged and the one
    // currently hovered as a drop target.
    const [stackDragId, setStackDragId] = useState<string | null>(null)
    const [stackOverId, setStackOverId] = useState<string | null>(null)
    const [containerWidth, setContainerWidth] = useState(0)
    const [fitWidth, setFitWidth] = usePersistentState('character-sheet:fit-width', false, boolCodec)
    const [density, setDensity] = usePersistentState<Density>('character-sheet:density', 'normal', densityCodec)
    const [gridCols, setGridCols] = usePersistentState('character-sheet:grid-cols', 12, gridColsCodec)
    const [query, setQuery] = useState('')
    const [theme, setTheme] = useState<string>(() => {
        try {
            return localStorage.getItem(`character-sheet:theme:${getActiveId()}`) || '#8b5cf6'
        } catch {
            return '#8b5cf6'
        }
    })
    const importRef = useRef<HTMLInputElement>(null)
    const captureRef = useRef<HTMLDivElement>(null)
    const portraitRef = useRef<HTMLInputElement>(null)
    const canvasScrollRef = useRef<HTMLDivElement>(null)
    const panRef = useRef<{ pointerId: number; startX: number; startY: number; left: number; top: number; moved: boolean } | null>(null)
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
        setPortrait,
        updateSection,
        setSectionLayout,
        setSectionLayouts,
        addSection,
        addTemplateSection,
        deleteSection,
        duplicateSection,
        deleteSections,
        duplicateSections,
        recolorSections,
        moveSection,
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

    const { rollLog, setRollLog, pushRoll } = useRollLog(activeId)
    const { selectedIds, clearSelection, handleSelect, deselect, align, match, distribute } = useSelection(sheet, setSectionLayout)
    const { presets, savePreset, applyPreset } = usePresets(sheet, updateSection, (m) => toast(m, 'success'))

    const resolved = useMemo(() => resolveSheet(sheet), [sheet])
    const computed = resolved.results
    const contributions = resolved.contributions
    const effectTags = resolved.tags
    const references = useMemo(() => listReferences(sheet, computed), [sheet, computed])
    const resourceReferences = useMemo(() => listResourceReferences(sheet), [sheet])
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

    // The drawer is per-view: tucking a card in the canvas doesn't hide it in the
    // stack, and vice-versa. `view` picks which view's drawer we're acting on.
    const view: 'canvas' | 'stack' = stackView ? 'stack' : 'canvas'

    const densityZoom = density === 'compact' ? 0.8 : density === 'comfortable' ? 1.2 : 1

    // Dashboard grid canvas geometry + layout handlers (grid, canvas size, zoom,
    // drop/reflow/auto-arrange). Owns the live reflow preview + drag-over-drawer flag.
    const {
        grid,
        canvasSize,
        canvasZoom,
        gridPreview,
        setGridPreview,
        dragOverDrawerRef,
        commitLayout,
        onGridDrag,
        handleOrganize,
        changeGridCols,
    } = useCanvasGridLayout({
        sheet,
        gridCols,
        setGridCols,
        setSectionLayouts,
        fitRefs,
        containerWidth,
        fitWidth,
        densityZoom,
    })

    // Drawer + canvas card drag/tuck/restore behaviour (drawer state, drag move/end
    // handlers). Consumes canvasZoom + the grid hook's reflow preview / drawer flag.
    const {
        drawerOpen,
        setDrawerOpen,
        draggingId,
        setDraggingId,
        dropHot,
        dragPoint,
        dragGrab,
        setDragGrab,
        drawerTabRef,
        drawerPanelRef,
        drawerCanvasRef,
        hideSection,
        showSection,
        onCardDragMove,
        onCardDragEnd,
    } = useDrawerDrag({
        sheet,
        view,
        updateSection,
        deselect,
        captureRef,
        canvasZoom,
        setGridPreview,
        dragOverDrawerRef,
    })

    // Reload the theme when switching characters (its storage key is per-character).
    const prevActiveRef = useRef(activeId)
    useEffect(() => {
        if (prevActiveRef.current === activeId) return
        prevActiveRef.current = activeId
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
            toast('No Luck Points left.')
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
    }

    // A short rest refills short-rest resources, then prompts to spend hit dice.
    const startShortRest = () => {
        doRest('short')
        if (hitDiceEntries.length > 0) setShowHitDice(true)
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
        toast(`Leveled up to ${next}. Update HP max, hit dice, and features as needed.`, 'success')
    }

    // Hit-dice pools live as resource/counter fields tagged with `meta.die`
    // (anywhere on the sheet) and are spent through the Hit Dice popup.
    const hitDiceEntries: HitDieEntry[] = sheet.sections.flatMap((s) =>
        s.fields
            .filter((f) => f.meta?.die && (f.type === 'resource' || f.type === 'counter'))
            .map((f) => ({
                sectionId: s.id,
                fieldId: f.id,
                die: f.meta!.die!,
                available: Number(f.value) || 0,
                max: f.max ?? (Number(f.value) || 0),
            })),
    )
    const spendHitDice = (
        spends: { sectionId: string; fieldId: string; count: number }[],
        heal: number,
        detail: string,
    ) => {
        for (const s of spends) {
            const field = sheet.sections.find((x) => x.id === s.sectionId)?.fields.find((f) => f.id === s.fieldId)
            if (field) updateField(s.sectionId, s.fieldId, { value: String(Math.max(0, (Number(field.value) || 0) - s.count)) })
        }
        if (heal > 0) healHp(heal)
        pushRoll({ title: 'Hit Dice', detail, total: heal, kind: 'heal' })
        setShowHitDice(false)
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
            toast('Sheet imported.', 'success')
        } else {
            toast(result.error ?? 'Could not import that file.', 'error')
        }
    }

    const handlePortrait = async (file: File | undefined) => {
        if (!file) return
        if (!file.type.startsWith('image/')) {
            toast('Please choose an image file.', 'error')
            return
        }
        try {
            const dataUrl = await readImageAsDataUrl(file, 256)
            setPortrait(dataUrl)
            toast('Portrait updated.', 'success')
        } catch {
            toast('Could not read that image.', 'error')
        }
    }

    const handleReset = () => {
        if (window.confirm('Reset to a fresh starter sheet? This cannot be undone.')) {
            replaceSheet(createStarterSheet())
            toast('Sheet reset.', 'success')
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
            toast('Exported PNG.', 'success')
        } catch {
            toast('PNG export failed.', 'error')
        }
    }

    const handleShare = async () => {
        const url = buildShareUrl(sheet)
        try {
            await navigator.clipboard.writeText(url)
            toast('Share link copied to clipboard.', 'success')
        } catch {
            window.prompt('Copy this share link:', url)
        }
    }

    const handleDeleteCharacter = () => {
        const name = characters.find((c) => c.id === activeId)?.name ?? 'this character'
        if (window.confirm(`Delete “${name}”? This cannot be undone.`)) {
            deleteCharacter(activeId)
            toast('Character deleted.', 'success')
        }
    }

    const handleRestore = (ts: number) => {
        const restored = restoreBackup(activeId, ts)
        if (restored) {
            replaceSheet(restored)
            toast('Restored an earlier version.', 'success')
        }
    }

    // Bulk actions on the current multi-selection (beyond the layout-only align /
    // match / distribute from useSelection): delete, duplicate, tuck into the
    // drawer, or recolour every selected card at once.
    const bulkDelete = () => {
        const ids = [...selectedIds]
        if (ids.length === 0) return
        if (!window.confirm(`Delete ${ids.length} selected section${ids.length > 1 ? 's' : ''}? This can be undone.`)) return
        deleteSections(ids)
        clearSelection()
        toast(`Deleted ${ids.length} section${ids.length > 1 ? 's' : ''}.`, 'success')
    }

    const bulkDuplicate = () => {
        const ids = [...selectedIds]
        if (ids.length === 0) return
        duplicateSections(ids)
        toast(`Duplicated ${ids.length} section${ids.length > 1 ? 's' : ''}.`, 'success')
    }

    const bulkTuck = () => {
        const ids = [...selectedIds]
        if (ids.length === 0) return
        for (const id of ids) hideSection(id)
        toast(`Tucked ${ids.length} section${ids.length > 1 ? 's' : ''} into the drawer.`, 'success')
    }

    const bulkRecolor = (accent: string) => {
        const ids = [...selectedIds]
        if (ids.length === 0) return
        recolorSections(ids, accent)
        toast(`Recoloured ${ids.length} section${ids.length > 1 ? 's' : ''}.`, 'success')
    }

    // Drag empty canvas background to pan (scroll) the viewport. A click that
    // doesn't move clears the current selection.
    const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return
        const scroller = canvasScrollRef.current
        if (!scroller) return
        e.currentTarget.setPointerCapture(e.pointerId)
        panRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            left: scroller.scrollLeft,
            top: scroller.scrollTop,
            moved: false,
        }
    }

    const onCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const pan = panRef.current
        const scroller = canvasScrollRef.current
        if (!pan || pan.pointerId !== e.pointerId || !scroller) return
        const dx = e.clientX - pan.startX
        const dy = e.clientY - pan.startY
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pan.moved = true
        scroller.scrollLeft = pan.left - dx
        scroller.scrollTop = pan.top - dy
    }

    const onCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        const pan = panRef.current
        if (!pan || pan.pointerId !== e.pointerId) return
        panRef.current = null
        if (!pan.moved) clearSelection()
    }

    useEffect(() => {
        const shared = readSharedSheet()
        if (!shared) return
        // Defer past the effect's synchronous phase before prompting/committing.
        queueMicrotask(() => {
            if (window.confirm(`Load shared character “${shared.name}”? This replaces your current sheet.`)) {
                replaceSheet(shared)
                toast('Shared character loaded.', 'success')
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

    // Track the canvas viewport width so "Fill width" and the fit-to-width zoom
    // can spread/scale tiles to the actual window (which already reflects the
    // browser's page zoom, since clientWidth is measured in CSS pixels).
    useEffect(() => {
        const el = canvasScrollRef.current
        if (!el) return
        const measure = () => setContainerWidth(el.clientWidth)
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [stackView])

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

    const matchesQuery = (section: (typeof sheet.sections)[number]) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        if (section.title.toLowerCase().includes(q)) return true
        return section.fields.some(
            (f) => f.label.toLowerCase().includes(q) || (f.description ?? '').toLowerCase().includes(q),
        )
    }
    const canvasSections = sheet.sections.filter((s) => !inDrawer(s, 'canvas') && matchesQuery(s))
    const stackVisible = sheet.sections.filter((s) => !inDrawer(s, 'stack') && matchesQuery(s))
    const stackSections = [...stackVisible].sort(
        (a, b) => (pinned.has(a.id) ? 0 : 1) - (pinned.has(b.id) ? 0 : 1),
    )
    // Sections tucked into the current view's drawer, plus their effective
    // scratch-pad positions (default-placing any that lack a saved spot).
    const drawerSections = sheet.sections.filter((s) => inDrawer(s, view))
    const showDrawerTab = drawerSections.length > 0 || draggingId != null
    // A drawer card being dragged straddles out over the canvas, so the scratch-pad
    // must not clip it while that drag is in progress.
    const draggingDrawerCard = draggingId != null && drawerSections.some((s) => s.id === draggingId)
    const drawerPlaced = drawerSections.reduce<{ items: { section: typeof drawerSections[number]; layout: SectionLayout }[]; y: number }>(
        (acc, s) => {
            const layout = s.drawerLayout ?? {
                x: 16,
                y: acc.y,
                w: Math.min(300, Math.max(180, s.layout.w)),
                h: Math.min(220, Math.max(80, s.layout.h)),
            }
            return {
                items: [...acc.items, { section: s, layout }],
                y: s.drawerLayout ? acc.y : layout.y + layout.h + 16,
            }
        },
        { items: [], y: 16 },
    ).items
    const drawerCanvasSize = {
        width: Math.max(300, ...drawerPlaced.map((p) => p.layout.x + p.layout.w + 24)),
        height: Math.max(300, ...drawerPlaced.map((p) => p.layout.y + p.layout.h + 24)),
    }
    const editingSection = editingSectionId ? sheet.sections.find((s) => s.id === editingSectionId) ?? null : null

    const renderCard = (section: (typeof sheet.sections)[number], collapsible: boolean) => (
        <SectionCard
            section={section}
            results={computed}
            contributions={contributions}
            effectTags={effectTags}
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
            onEdit={collapsible ? () => setEditingSectionId(section.id) : undefined}
            onHide={collapsible ? () => hideSection(section.id) : undefined}
            onUpdateSection={(patch) => updateSection(section.id, patch)}
            onAddField={(overrides) => addField(section.id, overrides)}
            onUpdateField={(fieldId, patch) => updateField(section.id, fieldId, patch)}
            collapsed={collapsible ? collapsed.has(section.id) : undefined}
            onToggleCollapse={collapsible ? () => toggleCollapse(section.id) : undefined}
            pinned={collapsible ? pinned.has(section.id) : undefined}
            onTogglePin={collapsible ? () => togglePin(section.id) : undefined}
        />
    )

    return (
        <main className="flex min-h-screen w-full">
            <HeaderToolbar
                theme={theme}
                setTheme={setTheme}
                mobileNavOpen={mobileNavOpen}
                setMobileNavOpen={setMobileNavOpen}
                sidebarCollapsed={sidebarCollapsed}
                setSidebarCollapsed={setSidebarCollapsed}
                portraitRef={portraitRef}
                sheet={sheet}
                setPortrait={setPortrait}
                handlePortrait={handlePortrait}
                renameSheet={renameSheet}
                inspirationField={inspirationField}
                toggleInspiration={toggleInspiration}
                startShortRest={startShortRest}
                doRest={doRest}
                activeId={activeId}
                characters={characters}
                switchCharacter={switchCharacter}
                newCharacter={newCharacter}
                duplicateCharacter={duplicateCharacter}
                handleRestore={handleRestore}
                handleReset={handleReset}
                handleDeleteCharacter={handleDeleteCharacter}
                undo={undo}
                redo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                undoLabel={undoLabel}
                redoLabel={redoLabel}
                query={query}
                setQuery={setQuery}
                addSection={addSection}
                addTemplateSection={addTemplateSection}
                stackView={stackView}
                setStackView={setStackView}
                density={density}
                setDensity={setDensity}
                fitWidth={fitWidth}
                setFitWidth={setFitWidth}
                handleOrganize={handleOrganize}
                gridColOptions={GRID_COL_OPTIONS}
                changeGridCols={changeGridCols}
                gridCols={gridCols}
                savePreset={savePreset}
                presets={presets}
                applyPreset={applyPreset}
                drawerOpen={drawerOpen}
                setDrawerOpen={setDrawerOpen}
                view={view}
                drawerSections={drawerSections}
                levelField={levelField}
                handleLevelUp={handleLevelUp}
                importRef={importRef}
                handleImport={handleImport}
                handleShare={handleShare}
                handleExportPng={handleExportPng}
                handleCheckUpdate={handleCheckUpdate}
                setShowAbout={setShowAbout}
            />

            <div className="order-1 flex min-w-0 flex-1 flex-col gap-3 p-4 md:px-8">
            <section className={clsx('w-full', !fitWidth && 'mx-auto max-w-7xl')}>
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
                        <span className="mx-1 h-4 w-px bg-slate-700" aria-hidden="true" />
                        <button type="button" onClick={bulkDuplicate} className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-800" title="Duplicate selected sections">Duplicate</button>
                        <button type="button" onClick={bulkTuck} className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-800" title="Tuck selected sections into the drawer">Tuck</button>
                        <label className="flex cursor-pointer items-center gap-1 rounded border border-slate-600 px-2 py-1 hover:bg-slate-800" title="Recolour selected sections">
                            <span>Recolour</span>
                            <input
                                type="color"
                                onChange={(e) => bulkRecolor(e.target.value)}
                                aria-label="Recolour selected sections"
                                className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                            />
                        </label>
                        <button type="button" onClick={bulkDelete} className="rounded border border-rose-800/70 px-2 py-1 text-rose-300 hover:bg-rose-950/40" title="Delete selected sections">Delete</button>
                        <button type="button" onClick={() => clearSelection()} className="ml-auto rounded border border-slate-700 px-2 py-1 text-slate-400 hover:bg-slate-800">Clear</button>
                    </div>
                )}

                {sheet.sections.length === 0 ? (
                    <EmptyCanvas onAddSection={addSection} onAddTemplate={addTemplateSection} />
                ) : stackView ? (
                    <div ref={captureRef} className="columns-1 gap-4 md:columns-2 xl:columns-3" style={{ zoom: densityZoom }}>
                        {stackSections.map((section) => {
                            const isTarget = stackDragId != null && stackOverId === section.id && stackDragId !== section.id
                            return (
                                <div
                                    key={section.id}
                                    className="mb-4 break-inside-avoid"
                                    onDragOver={
                                        stackDragId
                                            ? (e) => {
                                                  e.preventDefault()
                                                  if (stackOverId !== section.id) setStackOverId(section.id)
                                              }
                                            : undefined
                                    }
                                    onDrop={
                                        stackDragId
                                            ? (e) => {
                                                  e.preventDefault()
                                                  moveSection(stackDragId, section.id)
                                                  setStackDragId(null)
                                                  setStackOverId(null)
                                              }
                                            : undefined
                                    }
                                >
                                    <div className={clsx('group relative rounded-xl', isTarget && 'ring-2 ring-violet-400/70')}>
                                        <button
                                            type="button"
                                            draggable
                                            onDragStart={(e) => {
                                                setStackDragId(section.id)
                                                e.dataTransfer.effectAllowed = 'move'
                                                e.dataTransfer.setData('text/plain', section.id)
                                            }}
                                            onDragEnd={() => {
                                                setStackDragId(null)
                                                setStackOverId(null)
                                            }}
                                            aria-label="Drag to reorder section"
                                            title="Drag to reorder"
                                            className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 cursor-grab rounded-full border border-slate-600 bg-slate-800/90 px-2 text-xs leading-5 text-slate-400 opacity-0 transition-opacity hover:text-slate-200 active:cursor-grabbing group-hover:opacity-100 print:hidden"
                                        >
                                            ⠿
                                        </button>
                                        {renderCard(section, true)}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div ref={canvasScrollRef} className={clsx(fitWidth ? 'overflow-y-auto overflow-x-hidden' : 'overflow-auto')}>
                        <div
                            ref={captureRef}
                            onPointerDown={onCanvasPointerDown}
                            onPointerMove={onCanvasPointerMove}
                            onPointerUp={onCanvasPointerUp}
                            onPointerCancel={onCanvasPointerUp}
                            className={clsx(
                                'relative cursor-grab touch-none rounded-lg active:cursor-grabbing',
                                'bg-[radial-gradient(circle,_rgba(148,163,184,0.08)_1px,_transparent_1px)] [background-size:16px_16px]',
                            )}
                            style={{
                                width: fitWidth ? canvasSize.maxX : canvasSize.width,
                                height: canvasSize.height,
                                zoom: canvasZoom,
                                ...(fitWidth ? { marginLeft: -canvasSize.minX } : null),
                            }}
                        >
                            {/* Column guides: show the grid the cards snap to while dragging. */}
                            {draggingId && Array.from({ length: grid.cols }, (_, i) => (
                                <div
                                    key={`col-${i}`}
                                    className="pointer-events-none absolute top-0 z-0 rounded bg-cyan-400/[0.04] ring-1 ring-inset ring-cyan-400/10"
                                    style={{
                                        left: grid.pad + i * (grid.colWidth + grid.margin),
                                        width: grid.colWidth,
                                        height: canvasSize.height,
                                    }}
                                />
                            ))}
                            {canvasSections.map((section) => (
                                <CanvasItem
                                    key={section.id}
                                    layout={draggingId && draggingId !== section.id
                                        ? (gridPreview?.get(section.id) ?? section.layout)
                                        : section.layout}
                                    scale={section.scale}
                                    zoom={canvasZoom}
                                    grid={grid}
                                    selected={selectedIds.has(section.id)}
                                    siblings={sheet.sections
                                        .filter((s) => s.id !== section.id && !inDrawer(s, 'canvas'))
                                        .map((s) => s.layout)}
                                    onLayoutCommit={(layout) => commitLayout(section.id, layout)}
                                    onScaleChange={(scale) => updateSection(section.id, { scale })}
                                    onGuidesChange={setGuides}
                                    onSelect={(additive) => handleSelect(section.id, additive)}
                                    quickEdit={
                                        <SectionQuickEdit
                                            section={section}
                                            onUpdateSection={(patch) => updateSection(section.id, patch)}
                                            onEdit={() => setEditingSectionId(section.id)}
                                            className="rounded px-1 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
                                        />
                                    }
                                    onHide={() => hideSection(section.id)}
                                    dimmed={draggingId === section.id && dropHot}
                                    onDragStart={(ox, oy) => { setDraggingId(section.id); setDragGrab({ x: ox, y: oy }) }}
                                    onDragMove={(x, y) => onCardDragMove(section.id, x, y)}
                                    onGridDrag={(layout) => onGridDrag(section.id, layout)}
                                    onDragEnd={(x, y, moved) => onCardDragEnd(section.id, x, y, moved)}
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

            {showHitDice && (
                <HitDiceModal
                    entries={hitDiceEntries}
                    conMod={scope['con_mod'] ?? 0}
                    onClose={() => setShowHitDice(false)}
                    onApply={spendHitDice}
                />
            )}

            {showDrawerTab && (
                <button
                    ref={drawerTabRef}
                    type="button"
                    onClick={() => setDrawerOpen((v) => !v)}
                    className={clsx(
                        'fixed top-1/2 z-40 flex h-28 w-10 -translate-y-1/2 flex-col items-center justify-center gap-1.5 rounded-r-2xl border-2 border-l-0 font-semibold shadow-xl transition-colors print:hidden',
                        dropHot
                            ? 'border-emerald-300 bg-emerald-500 text-white ring-4 ring-emerald-300/50'
                            : draggingId
                                ? 'animate-pulse border-violet-300 bg-violet-500 text-white'
                                : 'border-violet-400 bg-violet-600 text-white hover:bg-violet-500',
                    )}
                    style={{ left: drawerOpen ? DRAWER_W : 0 }}
                    title={draggingId ? 'Drop here to tuck this card into the drawer' : drawerOpen ? 'Close the drawer' : 'Open the drawer'}
                    aria-label={`${drawerOpen ? 'Close' : 'Open'} the drawer`}
                >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="7" rx="1" />
                        <rect x="3" y="13" width="18" height="7" rx="1" />
                        <line x1="10" y1="7.5" x2="14" y2="7.5" />
                        <line x1="10" y1="16.5" x2="14" y2="16.5" />
                    </svg>
                    <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] uppercase tracking-widest">Drawer</span>
                    {drawerSections.length > 0 && (
                        <span className="rounded-full bg-white px-1 text-[10px] font-bold leading-tight text-violet-700">{drawerSections.length}</span>
                    )}
                </button>
            )}

            {drawerOpen && (
                <div
                    ref={drawerPanelRef}
                    className={clsx(
                        'fixed left-0 z-30 flex flex-col border-r-2 bg-slate-950/95 shadow-2xl backdrop-blur transition-colors print:hidden',
                        dropHot ? 'border-emerald-400' : 'border-violet-500/60',
                    )}
                    style={{ top: 0, bottom: 0, width: DRAWER_W }}
                >
                    <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2 text-xs font-medium text-violet-200">
                        <span className="whitespace-nowrap font-semibold">Drawer · {view === 'stack' ? 'Stack' : 'Canvas'}</span>
                        <span className="truncate text-slate-500">— drag cards in and out; ⊞ restores</span>
                        <button type="button" onClick={() => setDrawerOpen(false)} className="ml-auto rounded border border-slate-700 px-2 py-0.5 text-slate-400 hover:bg-slate-800">Close</button>
                    </div>
                    <div className={clsx('relative flex-1 bg-[radial-gradient(circle,_rgba(148,163,184,0.08)_1px,_transparent_1px)] [background-size:16px_16px]', draggingDrawerCard ? 'overflow-visible' : 'overflow-auto')}>
                        <div ref={drawerCanvasRef} className="relative" style={{ width: drawerCanvasSize.width, height: drawerCanvasSize.height }}>
                            {drawerPlaced.map(({ section, layout }) => (
                                <CanvasItem
                                    key={section.id}
                                    layout={layout}
                                    scale={section.scale}
                                    zoom={1}
                                    drawerMode
                                    siblings={drawerPlaced
                                        .filter((p) => p.section.id !== section.id)
                                        .map((p) => p.layout)}
                                    onLayoutCommit={(l) => updateSection(section.id, { drawerLayout: l })}
                                    onScaleChange={(scale) => updateSection(section.id, { scale })}
                                    quickEdit={
                                        <SectionQuickEdit
                                            section={section}
                                            onUpdateSection={(patch) => updateSection(section.id, patch)}
                                            onEdit={() => setEditingSectionId(section.id)}
                                            className="rounded px-1 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
                                        />
                                    }
                                    onHide={() => showSection(section.id)}
                                    onDragStart={(ox, oy) => { setDraggingId(section.id); setDragGrab({ x: ox, y: oy }) }}
                                    onDragMove={(x, y) => onCardDragMove(section.id, x, y)}
                                    onDragEnd={(x, y, moved) => onCardDragEnd(section.id, x, y, moved)}
                                >
                                    {renderCard(section, false)}
                                </CanvasItem>
                            ))}
                            {drawerPlaced.length === 0 && (
                                <p className="pointer-events-none absolute inset-x-3 top-3 m-0 text-xs text-slate-500">
                                    Nothing tucked away here yet. Drag a card onto the drawer tab, or use the ⊟ button
                                    on a card, to stash it in this {view} drawer.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Floating preview so a card visually straddles the canvas and the
                drawer while being dragged in (where the panel would otherwise hide
                it). Only shown for a canvas card over the drawer; the original is
                dimmed in place meanwhile. */}
            {dragPoint && (() => {
                const dragging = draggingId ? sheet.sections.find((s) => s.id === draggingId) : null
                if (!dragging || inDrawer(dragging, view)) return null
                const grab = dragGrab
                return (
                    <div
                        className="pointer-events-none fixed z-50 rounded-lg opacity-90 shadow-2xl ring-2 ring-violet-400 print:hidden"
                        style={{
                            left: dragPoint.x - grab.x,
                            top: dragPoint.y - grab.y,
                            width: dragging.layout.w,
                            height: dragging.layout.h,
                            transform: `scale(${canvasZoom})`,
                            transformOrigin: '0 0',
                        }}
                    >
                        {renderCard(dragging, false)}
                    </div>
                )
            })()}

            {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

            {editingSection && (
                <SectionEditorModal
                    section={editingSection}
                    results={computed}
                    references={references}
                    resourceReferences={resourceReferences}
                    contributions={contributions}
                    effectTags={effectTags}
                    onClose={() => setEditingSectionId(null)}
                    onUpdateSection={(patch) => updateSection(editingSection.id, patch)}
                    onDeleteSection={() => deleteSection(editingSection.id)}
                    onDuplicateSection={() => duplicateSection(editingSection.id)}
                    onAddField={(overrides) => addField(editingSection.id, overrides)}
                    onUpdateField={(fieldId, patch) => updateField(editingSection.id, fieldId, patch)}
                    onDeleteField={(fieldId) => deleteField(editingSection.id, fieldId)}
                    onMoveField={(fieldId, direction) => moveField(editingSection.id, fieldId, direction)}
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

            <UpdateToast
                show={appUpdate.updateReady}
                onReload={appUpdate.applyUpdate}
                onDismiss={appUpdate.dismiss}
            />
            </div>
        </main>
    )
}

export default App
