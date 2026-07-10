import { clsx } from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
    createStarterSheet,
    slugify,
    type SectionLayout,
} from './model/characterSheet'
import { resolveSheet, listReferences, listResourceReferences } from './model/compute'
import {
    compactLayouts,
    tidyLayouts,
    alignEdge,
    matchDimension,
    distribute as distributeLayout,
    type Placed,
    type AlignEdge,
} from './model/layout'
import { CanvasItem, type SnapGuide, type CanvasItemHandle } from './components/CanvasItem'
import { SectionCard } from './components/SectionCard'
import { SectionEditorModal } from './components/SectionEditorModal'
import { HitDiceModal, type HitDieEntry } from './components/HitDiceModal'
import { AboutModal } from './components/AboutModal'
import { UpdateToast } from './components/UpdateToast'
import { RollLog } from './components/RollLog'
import { Menu, MenuItem, MenuDivider, MenuLabel } from './components/Menu'
import { APP_VERSION } from './version'
import { useAppUpdate } from './state/useAppUpdate'
import { exportSheetToFile, importSheetFromFile } from './state/transfer'
import { loadPresets, savePresets, type Presets } from './state/presets'
import { buildShareUrl, readSharedSheet, clearShareHash } from './state/share'
import { getActiveId } from './state/roster'
import { pushBackup, listBackups, restoreBackup } from './state/backups'
import { SECTION_TEMPLATES } from './state/templates'
import { useSheet } from './state/useSheet'
import { rollExpr, formatRoll } from './model/dice'
import type { D20Mode, RollLogEntry } from './model/dice'

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

/** Whether a section is tucked into the given view's drawer scratch-pad. */
const inDrawer = (
    section: { drawer?: { canvas?: boolean; stack?: boolean } },
    view: 'canvas' | 'stack',
): boolean => Boolean(section.drawer?.[view])

/** Width of the sliding drawer panel (never wider than the viewport). */
const DRAWER_W = 'min(440px, 92vw)'

function App() {
    const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
    const [headerCollapsed, setHeaderCollapsed] = useState(false)
    const [showHitDice, setShowHitDice] = useState(false)
    const [showAbout, setShowAbout] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)
    const appUpdate = useAppUpdate()
    const handleCheckUpdate = async () => {
        setNotice('Checking for updates…')
        const found = await appUpdate.checkForUpdate()
        if (!found) setNotice("You're on the latest version.")
    }
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
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [dropHot, setDropHot] = useState(false)
    const [headerH, setHeaderH] = useState(0)
    const [containerWidth, setContainerWidth] = useState(0)
    const [fitWidth, setFitWidth] = useState(() => {
        try {
            return localStorage.getItem('character-sheet:fit-width') === '1'
        } catch {
            return false
        }
    })
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
    const portraitRef = useRef<HTMLInputElement>(null)
    const canvasScrollRef = useRef<HTMLDivElement>(null)
    const headerRef = useRef<HTMLElement>(null)
    const drawerTabRef = useRef<HTMLButtonElement>(null)
    const drawerPanelRef = useRef<HTMLDivElement>(null)
    const drawerCanvasRef = useRef<HTMLDivElement>(null)
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
        setNotice(`Leveled up to ${next}. Update HP max, hit dice, and features as needed.`)
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
            setNotice('Sheet imported.')
        } else {
            setNotice(result.error)
        }
    }

    const handlePortrait = async (file: File | undefined) => {
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setNotice('Please choose an image file.')
            return
        }
        try {
            const dataUrl = await readImageAsDataUrl(file, 256)
            setPortrait(dataUrl)
            setNotice('Portrait updated.')
        } catch {
            setNotice('Could not read that image.')
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
        const shown = sheet.sections.filter((section) => !inDrawer(section, 'canvas'))
        const width = Math.max(
            960,
            ...shown.map((section) => section.layout.x + section.layout.w + 48),
        )
        const height = Math.max(
            520,
            ...shown.map((section) => section.layout.y + section.layout.h + 80),
        )
        // Real left/right extent of the actual cards (no scroll padding / floor),
        // used by "Fit to width" so content fills the window edge-to-edge.
        const minX = shown.length ? Math.min(...shown.map((s) => s.layout.x)) : 0
        const maxX = shown.length ? Math.max(...shown.map((s) => s.layout.x + s.layout.w)) : width
        return { width, height, minX, maxX }
    }, [sheet.sections])

    const commitLayout = (id: string, layout: SectionLayout) => {
        // Free placement — allow overlap. Dragging a tile onto another no longer
        // shoves it away to an off-screen spot; Tidy compacts things on demand.
        setSectionLayout(id, layout)
    }

    /** Measure every card's natural content size (width clamped so text cards don't
     *  blow out). Best run in play mode — edit mode renders bulky field editors. */
    const fittedItems = (): Placed[] =>
        sheet.sections
            .filter((s) => !inDrawer(s, 'canvas'))
            .map((s) => {
                const handle = fitRefs.current.get(s.id)
                const w = handle ? Math.min(340, handle.measureWidth()) : s.layout.w
                const h = handle ? handle.measureHeight() : s.layout.h
                return { id: s.id, layout: { ...s.layout, w, h } }
            })

    const handleTidy = () => {
        // Fit each card to its content, then compact into clean columns based on
        // how you've arranged them (keeps your columns, removes gaps, no scrollbars).
        setSectionLayouts(compactLayouts(fittedItems()))
    }

    const handleFitAll = () => {
        // Resize each card to its content in place, keeping the current arrangement.
        setSectionLayouts(fittedItems())
    }

    const handleFillWidth = () => {
        // Fit each card to its content, then skyline-pack across the available
        // window width so tiles spread out to the edges instead of stacking narrow.
        const width = containerWidth || canvasScrollRef.current?.clientWidth || canvasSize.width
        setSectionLayouts(tidyLayouts(fittedItems(), width))
    }

    const hideSection = (id: string) => {
        const section = sheet.sections.find((s) => s.id === id)
        if (!section) return
        // Tuck the card into the current view's drawer, placing it on the drawer's
        // free canvas (keep any existing spot, else stack below what's there).
        const tucked = sheet.sections.filter((s) => s.id !== id && inDrawer(s, view) && s.drawerLayout)
        const bottom = tucked.reduce((m, s) => Math.max(m, s.drawerLayout!.y + s.drawerLayout!.h), 0)
        const drawerLayout = section.drawerLayout ?? {
            x: 16,
            y: tucked.length ? bottom + 16 : 16,
            w: Math.min(300, Math.max(180, section.layout.w)),
            h: Math.min(220, Math.max(80, section.layout.h)),
        }
        updateSection(id, { drawer: { ...(section.drawer ?? {}), [view]: true }, drawerLayout })
        setDrawerOpen(true)
        setSelectedIds((prev) => {
            if (!prev.has(id)) return prev
            const next = new Set(prev)
            next.delete(id)
            return next
        })
    }

    const showSection = (id: string) => {
        const section = sheet.sections.find((s) => s.id === id)
        if (!section) return
        updateSection(id, { drawer: { ...(section.drawer ?? {}), [view]: false } })
    }

    const pointInRect = (el: HTMLElement | null, x: number, y: number): boolean => {
        if (!el) return false
        const r = el.getBoundingClientRect()
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    }

    // Whether a screen point is over the open drawer panel / the peeking tab.
    const isOverPanel = (x: number, y: number): boolean => drawerOpen && pointInRect(drawerPanelRef.current, x, y)
    const isOverTab = (x: number, y: number): boolean => pointInRect(drawerTabRef.current, x, y)

    // Map a screen point to a layout inside a positioned container (canvas or the
    // drawer's scratch-pad), grabbing the card near its top-left so it lands under
    // the cursor. `zoom` undoes any CSS zoom on the container.
    const pointToLayout = (
        el: HTMLElement | null,
        x: number,
        y: number,
        zoom: number,
        w: number,
        h: number,
    ): SectionLayout | null => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return {
            x: Math.max(0, Math.round((x - r.left) / zoom - 24)),
            y: Math.max(0, Math.round((y - r.top) / zoom - 12)),
            w,
            h,
        }
    }

    // Live feedback while a card is dragged: auto-open the drawer as a canvas card
    // approaches its tab, and highlight the drop target.
    const onCardDragMove = (id: string, x: number, y: number) => {
        const section = sheet.sections.find((s) => s.id === id)
        if (!section) return
        if (inDrawer(section, view)) {
            // A drawer card straddling out toward the canvas needs no target hint.
            if (dropHot) setDropHot(false)
            return
        }
        if (!drawerOpen && isOverTab(x, y)) setDrawerOpen(true)
        setDropHot(isOverTab(x, y) || isOverPanel(x, y))
    }

    // Decide where a dragged card lands. Canvas cards released over the drawer are
    // tucked away at the drop point; drawer cards released over the canvas are
    // restored there. Returns true when handled so the plain move isn't committed.
    const onCardDragEnd = (id: string, x: number, y: number, moved: boolean): boolean => {
        setDraggingId(null)
        setDropHot(false)
        if (!moved) return false
        const section = sheet.sections.find((s) => s.id === id)
        if (!section) return false
        if (inDrawer(section, view)) {
            // Drag out: restore to the canvas at the drop point (unless dropped back
            // inside the panel, which just rearranges the scratch-pad).
            if (isOverPanel(x, y)) return false
            const drawerPatch = { drawer: { ...(section.drawer ?? {}), [view]: false } }
            if (view === 'canvas') {
                const layout = pointToLayout(captureRef.current, x, y, canvasZoom, section.layout.w, section.layout.h) ?? section.layout
                updateSection(id, { ...drawerPatch, layout })
            } else {
                updateSection(id, drawerPatch)
            }
            return true
        }
        // Canvas card: tuck it into the drawer if released over the panel or tab.
        if (isOverPanel(x, y)) {
            const w = Math.min(300, Math.max(180, section.layout.w))
            const h = Math.min(220, Math.max(80, section.layout.h))
            const drawerLayout = pointToLayout(drawerCanvasRef.current, x, y, 1, w, h) ?? section.drawerLayout
            updateSection(id, { drawer: { ...(section.drawer ?? {}), [view]: true }, drawerLayout })
            setDrawerOpen(true)
            setSelectedIds((prev) => {
                if (!prev.has(id)) return prev
                const next = new Set(prev)
                next.delete(id)
                return next
            })
            return true
        }
        if (isOverTab(x, y)) {
            hideSection(id)
            return true
        }
        return false
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
        if (!pan.moved) setSelectedIds(new Set())
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

    // Track the header's height so the fixed drawer overlay docks just beneath it
    // (the header collapses, so this can't be a constant).
    useEffect(() => {
        const el = headerRef.current
        if (!el) return
        const measure = () => setHeaderH(el.offsetHeight)
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    useEffect(() => {
        try {
            localStorage.setItem('character-sheet:fit-width', fitWidth ? '1' : '0')
        } catch {
            // ignore storage failures (private mode, quota)
        }
    }, [fitWidth])

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
    // "Fit to width" instead scales the whole canvas so its actual content — the
    // real left-to-right extent of the cards, not the padded scroll area — fills
    // the current window width edge-to-edge (up- or down-scaling with the window /
    // page zoom). The canvas is shifted left by the leftmost card so the content
    // touches both edges with no trailing gap.
    const fitContentWidth = Math.max(1, canvasSize.maxX - canvasSize.minX)
    const fitZoom =
        fitWidth && containerWidth > 0
            ? Math.min(3, Math.max(0.3, containerWidth / fitContentWidth))
            : 1
    const canvasZoom = fitWidth ? fitZoom : densityZoom
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
        <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-3 p-4 md:px-8">
            <header ref={headerRef} className="sticky top-0 z-40 -mx-4 border-b border-slate-800 bg-slate-950/85 px-4 py-2 backdrop-blur md:-mx-8 md:px-8" style={{ borderTopColor: theme, borderTopWidth: 2 }}>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="group relative shrink-0">
                        <button
                            type="button"
                            onClick={() => portraitRef.current?.click()}
                            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 bg-slate-900 text-slate-500 hover:text-slate-200"
                            style={{ borderColor: theme }}
                            aria-label={sheet.portrait ? 'Change character portrait' : 'Add character portrait'}
                            title={sheet.portrait ? 'Change portrait' : 'Add a character portrait'}
                        >
                            {sheet.portrait ? (
                                <img src={sheet.portrait} alt="Character portrait" className="h-full w-full object-cover" />
                            ) : (
                                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                                    <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
                                </svg>
                            )}
                        </button>
                        {sheet.portrait && (
                            <button
                                type="button"
                                onClick={() => setPortrait(undefined)}
                                className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-xs leading-none text-slate-300 hover:bg-slate-700 hover:text-white group-hover:flex"
                                aria-label="Remove character portrait"
                                title="Remove portrait"
                            >
                                ×
                            </button>
                        )}
                    </div>
                    <input
                        ref={portraitRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                            void handlePortrait(event.target.files?.[0])
                            event.target.value = ''
                        }}
                    />
                    <input
                        value={sheet.name}
                        onChange={(event) => renameSheet(event.target.value)}
                        aria-label="Character name"
                        title="Click to rename this character"
                        className="min-w-0 rounded-md border border-transparent bg-transparent px-1 text-2xl font-semibold text-slate-100 hover:border-slate-700 focus:border-slate-600 focus:bg-slate-900 focus:outline-none sm:w-64"
                    />
                    {inspirationField && (
                        <button
                            type="button"
                            onClick={toggleInspiration}
                            className={clsx(
                                'rounded-md border px-2.5 py-1.5 text-sm font-medium',
                                inspirationField.field.value === 'true'
                                    ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                                    : 'border-slate-600 text-slate-400 hover:bg-slate-800',
                            )}
                            title="Toggle Inspiration"
                        >
                            ★ Insp.
                        </button>
                    )}
                    <Menu label="Rest ▾" title="Take a short or long rest" align="left">
                        {(close) => (
                            <>
                                <MenuItem onClick={() => { startShortRest(); close() }} title="Refill short-rest resources and spend hit dice">
                                    Short rest…
                                </MenuItem>
                                <MenuItem onClick={() => { doRest('long'); close() }} title="Restore HP, clear temp HP, reduce exhaustion, refill resources">
                                    Long rest
                                </MenuItem>
                            </>
                        )}
                    </Menu>
                    <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
                        <span title="Your sheet is saved automatically in this browser">
                            ✓ Autosaved{notice ? <span className="text-cyan-300"> · {notice}</span> : null}
                        </span>
                        <button
                            type="button"
                            onClick={() => setHeaderCollapsed((c) => !c)}
                            className="rounded-md border border-slate-600 px-3 py-1.5 text-xl leading-none text-slate-200 hover:bg-slate-800 hover:text-white"
                            aria-label={headerCollapsed ? 'Show toolbar' : 'Hide toolbar'}
                            title={headerCollapsed ? 'Show toolbar' : 'Hide toolbar'}
                        >
                            {headerCollapsed ? '▸' : '▾'}
                        </button>
                    </div>
                </div>
                {!headerCollapsed && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
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
                        <span className="mx-1 hidden h-6 w-px bg-slate-700 sm:block" aria-hidden="true" />

                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search sections / fields…"
                            aria-label="Search"
                            className="w-40 rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-200"
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
                        <button
                            type="button"
                            onClick={() => setDrawerOpen((v) => !v)}
                            className={clsx(
                                'rounded-md border px-3 py-2 text-sm',
                                drawerOpen || drawerSections.length > 0
                                    ? 'border-amber-500/70 text-amber-200 hover:bg-slate-800'
                                    : 'border-slate-600 text-slate-200 hover:bg-slate-800',
                            )}
                            title={`Open the ${view} drawer of tucked-away sections`}
                            aria-pressed={drawerOpen}
                        >
                            Drawer{drawerSections.length > 0 ? ` (${drawerSections.length})` : ''}
                        </button>
                        {!stackView && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleTidy}
                                    className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                                    title="Fit every card to its content and pack them into tidy columns"
                                >
                                    Tidy
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFitWidth((v) => !v)}
                                    className={clsx(
                                        'rounded-md border px-3 py-2 text-sm',
                                        fitWidth
                                            ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200'
                                            : 'border-slate-600 text-slate-200 hover:bg-slate-800',
                                    )}
                                    title="Scale the whole canvas so its content fills the window width (adapts as you resize or zoom)"
                                    aria-pressed={fitWidth}
                                >
                                    Fit to width
                                </button>
                                <Menu label="Options ▾" title="Layout options" align="left">
                                    {(close) => (
                                        <>
                                            <MenuItem onClick={() => { handleFitAll(); close() }} title="Resize each card to its content, keeping its position">
                                                Fit all to content
                                            </MenuItem>
                                            <MenuItem onClick={() => { handleFillWidth(); close() }} title="Fit cards to content and spread them across the full window width">
                                                Spread across width
                                            </MenuItem>
                                            <MenuItem onClick={() => { savePreset(); close() }} title="Save the current arrangement as a named layout">
                                                Save this layout…
                                            </MenuItem>
                                            {Object.keys(presets).length > 0 && (
                                                <>
                                                    <MenuDivider />
                                                    <MenuLabel>Apply saved layout</MenuLabel>
                                                    {Object.keys(presets).map((name) => (
                                                        <MenuItem key={name} onClick={() => { applyPreset(name); close() }}>
                                                            {name}
                                                        </MenuItem>
                                                    ))}
                                                </>
                                            )}
                                        </>
                                    )}
                                </Menu>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={addSection}
                            className="rounded-md bg-violet-500 px-3 py-2 text-sm font-medium text-white hover:bg-violet-400"
                        >
                            + Section
                        </button>
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
                        <span className="mx-1 hidden h-6 w-px bg-slate-700 sm:block" aria-hidden="true" />

                        <Menu label="⋯ More" title="Import, export, and share" align="right">
                            {(close) => (
                                <>
                                    {levelField && (
                                        <>
                                            <MenuLabel>Play</MenuLabel>
                                            <MenuItem onClick={() => { handleLevelUp(); close() }} title="Increase your level by one">
                                                Level up
                                            </MenuItem>
                                            <MenuDivider />
                                        </>
                                    )}
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
                                    <MenuDivider />
                                    <MenuLabel>About</MenuLabel>
                                    <MenuItem onClick={() => { void handleCheckUpdate(); close() }} title="Force a check for a newly deployed version and reload onto it">
                                        Check for updates
                                    </MenuItem>
                                    <MenuItem onClick={() => { setShowAbout(true); close() }} title="Show the app version and changelog">
                                        What's new · v{APP_VERSION}
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
                    </div>
                )}
            </header>

            <section>
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
                    <div ref={captureRef} className="columns-1 gap-4 md:columns-2 xl:columns-3" style={{ zoom: densityZoom }}>
                        {stackSections.map((section) => (
                            <div key={section.id} className="mb-4 break-inside-avoid">{renderCard(section, true)}</div>
                        ))}
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
                            {canvasSections.map((section) => (
                                <CanvasItem
                                    key={section.id}
                                    layout={section.layout}
                                    scale={section.scale}
                                    zoom={canvasZoom}
                                    selected={selectedIds.has(section.id)}
                                    siblings={sheet.sections
                                        .filter((s) => s.id !== section.id && !inDrawer(s, 'canvas'))
                                        .map((s) => s.layout)}
                                    onLayoutCommit={(layout) => commitLayout(section.id, layout)}
                                    onScaleChange={(scale) => updateSection(section.id, { scale })}
                                    onGuidesChange={setGuides}
                                    onSelect={(additive) => handleSelect(section.id, additive)}
                                    onEdit={() => setEditingSectionId(section.id)}
                                    onHide={() => hideSection(section.id)}
                                    onDragStart={() => setDraggingId(section.id)}
                                    onDragMove={(x, y) => onCardDragMove(section.id, x, y)}
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
                    style={{ top: headerH, bottom: 0, width: DRAWER_W }}
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
                                    onEdit={() => setEditingSectionId(section.id)}
                                    onHide={() => showSection(section.id)}
                                    onDragStart={() => setDraggingId(section.id)}
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
        </main>
    )
}

export default App
