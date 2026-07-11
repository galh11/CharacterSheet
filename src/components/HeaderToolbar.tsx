import { clsx } from 'clsx'
import { useRef, type Dispatch, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, type SetStateAction } from 'react'
import type { CharacterSheet, CharacterSection } from '../model/characterSheet'
import { Menu, MenuItem, MenuDivider, MenuLabel } from './Menu'
import { SectionNav } from './SectionNav'
import { SidebarStats } from './SidebarStats'
import {
    PORTRAIT_SIZE_CLASSES,
    SIDEBAR_DEFAULT_W,
    SIDEBAR_MAX_W,
    SIDEBAR_MIN_W,
    type PortraitSize,
    type SidebarStatsPrefs,
    type SidebarTab,
} from '../state/sidebarPrefs'
import { SECTION_TEMPLATES, type SectionTemplate } from '../state/templates'
import { exportSheetToFile } from '../state/transfer'
import { listBackups } from '../state/backups'
import type { Presets } from '../state/presets'
import { APP_VERSION } from '../version'

type Density = 'compact' | 'normal' | 'comfortable'

interface HeaderToolbarProps {
    theme: string
    setTheme: Dispatch<SetStateAction<string>>
    mobileNavOpen: boolean
    setMobileNavOpen: Dispatch<SetStateAction<boolean>>
    sidebarTab: SidebarTab
    setSidebarTab: Dispatch<SetStateAction<SidebarTab>>
    sidebarWidth: number
    setSidebarWidth: Dispatch<SetStateAction<number>>
    portraitRef: RefObject<HTMLInputElement | null>
    sheet: CharacterSheet
    setPortrait: (portrait?: string) => void
    handlePortrait: (file: File | undefined) => void
    renameSheet: (name: string) => void
    inspirationField: { field: { value: string } } | null
    toggleInspiration: () => void
    portraitSize: PortraitSize
    setPortraitSize: Dispatch<SetStateAction<PortraitSize>>
    sidebarStats: SidebarStatsPrefs
    setSidebarStats: Dispatch<SetStateAction<SidebarStatsPrefs>>
    rollLogDocked: boolean
    setRollLogDocked: Dispatch<SetStateAction<boolean>>
    scope: Record<string, number>
    hpWidget: ReactNode
    onRollAbility: (label: string, mod: number) => void
    onRollInitiative: (mod: number) => void
    rollLog: ReactNode
    startShortRest: () => void
    doRest: (kind: 'short' | 'long') => void
    activeId: string
    characters: readonly { id: string; name: string }[]
    switchCharacter: (id: string) => void
    newCharacter: () => void
    duplicateCharacter: () => void
    handleRestore: (ts: number) => void
    handleReset: () => void
    handleDeleteCharacter: () => void
    undo: () => void
    redo: () => void
    canUndo: boolean
    canRedo: boolean
    undoLabel: string | null
    redoLabel: string | null
    query: string
    setQuery: Dispatch<SetStateAction<string>>
    navSections: { id: string; title: string; accent?: string }[]
    activeIds: Set<string>
    onJumpToSection: (id: string) => void
    navMatchIds: Set<string>
    searchMatchCount: number
    onSearchSubmit: () => void
    queryActive: boolean
    addSection: () => void
    addTemplateSection: (template: SectionTemplate) => void
    stackView: boolean
    setStackView: Dispatch<SetStateAction<boolean>>
    density: Density
    setDensity: Dispatch<SetStateAction<Density>>
    fitWidth: boolean
    setFitWidth: Dispatch<SetStateAction<boolean>>
    handleOrganize: () => void
    gridColOptions: readonly number[]
    changeGridCols: (n: number) => void
    gridCols: number
    savePreset: () => void
    presets: Presets
    applyPreset: (name: string) => void
    drawerOpen: boolean
    setDrawerOpen: Dispatch<SetStateAction<boolean>>
    view: 'canvas' | 'stack'
    drawerSections: CharacterSection[]
    levelField: object | null
    handleLevelUp: () => void
    importRef: RefObject<HTMLInputElement | null>
    handleImport: (file: File | undefined) => void
    handleShare: () => void
    handleExportPng: () => void
    handleCheckUpdate: () => void
    setShowAbout: Dispatch<SetStateAction<boolean>>
    setShowMechanics: Dispatch<SetStateAction<boolean>>
}

/** The right-hand vertical side nav (rail): profile, character switcher, history,
 *  search, add controls, the View / ⋯ More menus, and the theme swatch — plus the
 *  narrow-width hamburger button and its backdrop overlay. Extracted from App so
 *  the rail's JSX lives in one place; it renders identically. */
export function HeaderToolbar({
    theme,
    setTheme,
    mobileNavOpen,
    setMobileNavOpen,
    sidebarTab,
    setSidebarTab,
    sidebarWidth,
    setSidebarWidth,
    portraitRef,
    sheet,
    setPortrait,
    handlePortrait,
    renameSheet,
    inspirationField,
    toggleInspiration,
    portraitSize,
    setPortraitSize,
    sidebarStats,
    setSidebarStats,
    rollLogDocked,
    setRollLogDocked,
    scope,
    hpWidget,
    onRollAbility,
    onRollInitiative,
    rollLog,
    startShortRest,
    doRest,
    activeId,
    characters,
    switchCharacter,
    newCharacter,
    duplicateCharacter,
    handleRestore,
    handleReset,
    handleDeleteCharacter,
    undo,
    redo,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    query,
    setQuery,
    navSections,
    activeIds,
    onJumpToSection,
    navMatchIds,
    searchMatchCount,
    onSearchSubmit,
    queryActive,
    addSection,
    addTemplateSection,
    stackView,
    setStackView,
    density,
    setDensity,
    fitWidth,
    setFitWidth,
    handleOrganize,
    gridColOptions,
    changeGridCols,
    gridCols,
    savePreset,
    presets,
    applyPreset,
    drawerOpen,
    setDrawerOpen,
    view,
    drawerSections,
    levelField,
    handleLevelUp,
    importRef,
    handleImport,
    handleShare,
    handleExportPng,
    handleCheckUpdate,
    setShowAbout,
    setShowMechanics,}: HeaderToolbarProps) {
    // Drag the rail's left edge to resize it (it sits on the right, so dragging
    // left widens it); double-click resets to the default width.
    const resizeRef = useRef<{ startX: number; startW: number } | null>(null)
    const onResizeDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        resizeRef.current = { startX: event.clientX, startW: sidebarWidth }
        event.currentTarget.setPointerCapture(event.pointerId)
        event.preventDefault()
    }
    const onResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!resizeRef.current) return
        const dx = event.clientX - resizeRef.current.startX
        const next = Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, resizeRef.current.startW - dx))
        setSidebarWidth(next)
    }
    const onResizeUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!resizeRef.current) return
        resizeRef.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const portraitClasses = PORTRAIT_SIZE_CLASSES[portraitSize]
    return (
        <>
            <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="fixed right-3 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-600 bg-slate-950/85 text-2xl leading-none text-slate-200 shadow-lg backdrop-blur hover:bg-slate-800 md:hidden print:hidden"
                aria-label="Open menu"
                title="Open menu"
            >
                ≡
            </button>
            {mobileNavOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onClick={() => setMobileNavOpen(false)}
                    aria-hidden="true"
                />
            )}
            <header
                className={clsx(
                    'relative order-2 flex flex-col gap-2 overflow-hidden border-l-2 bg-slate-950/85 p-3 backdrop-blur print:hidden',
                    'md:sticky md:top-0 md:h-screen md:max-h-screen md:self-start md:z-30 md:w-[var(--sidebar-w)]',
                    mobileNavOpen ? 'fixed inset-y-0 right-0 z-50 flex w-72 shadow-2xl' : 'hidden md:flex',
                )}
                style={{ borderLeftColor: theme }}
            >
                <div
                    role="separator"
                    aria-label="Resize sidebar"
                    aria-orientation="vertical"
                    onPointerDown={onResizeDown}
                    onPointerMove={onResizeMove}
                    onPointerUp={onResizeUp}
                    onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_W)}
                    title="Drag to resize · double-click to reset"
                    className="absolute inset-y-0 left-0 z-40 hidden w-1.5 cursor-col-resize touch-none hover:bg-slate-600/40 md:block"
                />
                <div className="flex shrink-0 flex-col items-stretch gap-2">
                    <div className="group relative shrink-0 self-center">
                        <button
                            type="button"
                            onClick={() => portraitRef.current?.click()}
                            className={clsx(
                                'flex items-center justify-center overflow-hidden rounded-full border-2 bg-slate-900 text-slate-500 hover:text-slate-200',
                                portraitClasses.avatar,
                            )}
                            style={{ borderColor: theme }}
                            aria-label={sheet.portrait ? 'Change character portrait' : 'Add character portrait'}
                            title={sheet.portrait ? 'Change portrait' : 'Add a character portrait'}
                        >
                            {sheet.portrait ? (
                                <img src={sheet.portrait} alt="Character portrait" className="h-full w-full object-cover" />
                            ) : (
                                <svg viewBox="0 0 24 24" className={portraitClasses.icon} fill="currentColor" aria-hidden="true">
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
                        className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-1 text-xl font-semibold text-slate-100 hover:border-slate-700 focus:border-slate-600 focus:bg-slate-900 focus:outline-none"
                    />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <div role="tablist" aria-label="Sidebar panels" className="flex flex-1 overflow-hidden rounded-md border border-slate-700">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={sidebarTab === 'stats'}
                            onClick={() => setSidebarTab('stats')}
                            className={clsx('flex-1 px-2 py-1.5 text-sm font-medium', sidebarTab === 'stats' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800')}
                        >
                            Stats
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={sidebarTab === 'tools'}
                            onClick={() => setSidebarTab('tools')}
                            className={clsx('flex-1 px-2 py-1.5 text-sm font-medium', sidebarTab === 'tools' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800')}
                        >
                            Tools
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => setMobileNavOpen(false)}
                        className="shrink-0 rounded-md border border-slate-600 px-2 py-1.5 leading-none text-slate-200 hover:bg-slate-800 hover:text-white md:hidden"
                        aria-label="Close menu"
                        title="Close menu"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {sidebarTab === 'stats' ? (
                    <div className="flex flex-col items-stretch gap-2">
                        <SidebarStats
                            scope={scope}
                            stats={sidebarStats}
                            setStats={setSidebarStats}
                            portraitSize={portraitSize}
                            setPortraitSize={setPortraitSize}
                            rollLogDocked={rollLogDocked}
                            setRollLogDocked={setRollLogDocked}
                            theme={theme}
                            hasInspiration={!!inspirationField}
                            inspirationOn={inspirationField?.field.value === 'true'}
                            toggleInspiration={toggleInspiration}
                            hpWidget={hpWidget}
                            onRollAbility={onRollAbility}
                            onRollInitiative={onRollInitiative}
                        />
                        <Menu label="Rest ▾" title="Take a short or long rest" align="right" className="w-full text-left">
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
                        <span className="text-xs text-slate-500" title="Your sheet is saved automatically in this browser">✓ Autosaved</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-stretch gap-1.5">
                        {/* Character group: switch between saved characters + manage them. */}
                        <select
                            value={activeId}
                            onChange={(event) => switchCharacter(event.target.value)}
                            className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                            aria-label="Active character"
                            title="Switch character"
                        >
                            {characters.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {(c.id === activeId ? sheet.name : c.name) || 'Unnamed'}
                                </option>
                            ))}
                        </select>
                        <Menu label="Character ▾" title="Character actions" align="right" className="w-full text-left">
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

                        <span className="my-1 h-px w-full bg-slate-700" aria-hidden="true" />

                        {/* History group: undo / redo. */}
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={undo}
                                disabled={!canUndo}
                                className={clsx(
                                    'flex-1 rounded-md border border-slate-600 px-3 py-2 text-sm',
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
                                    'flex-1 rounded-md border border-slate-600 px-3 py-2 text-sm',
                                    canRedo ? 'text-slate-200 hover:bg-slate-800' : 'cursor-not-allowed text-slate-600',
                                )}
                                title={redoLabel ? `Redo: ${redoLabel} (Ctrl+Shift+Z)` : 'Redo (Ctrl+Shift+Z)'}
                                aria-label="Redo"
                            >
                                ↷
                            </button>
                        </div>

                        <span className="my-1 h-px w-full bg-slate-700" aria-hidden="true" />

                        {/* Search: filters visible sections and fields. */}
                        <div className="relative">
                            <svg
                                viewBox="0 0 24 24"
                                className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                            >
                                <circle cx="11" cy="11" r="7" />
                                <path d="m21 21-4.3-4.3" strokeLinecap="round" />
                            </svg>
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSearchSubmit() } }}
                                placeholder="Search…"
                                aria-label="Search"
                                className="w-full rounded-md border border-slate-600 bg-slate-900 py-2 pl-8 pr-7 text-sm text-slate-200"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-200"
                                    title="Clear search"
                                    aria-label="Clear search"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {queryActive && (
                            <p className={clsx('px-1 text-[11px]', searchMatchCount === 0 ? 'text-amber-400' : 'text-slate-400')}>
                                {searchMatchCount === 0
                                    ? 'No matches'
                                    : `${searchMatchCount} match${searchMatchCount === 1 ? '' : 'es'} · press ↵ to jump`}
                            </p>
                        )}

                        <span className="my-1 h-px w-full bg-slate-700" aria-hidden="true" />

                        {/* Section navigator: jump to a card and highlight the active one. */}
                        <SectionNav sections={navSections} activeIds={activeIds} onJump={onJumpToSection} query={query} matchIds={navMatchIds} />

                        <span className="my-1 h-px w-full bg-slate-700" aria-hidden="true" />

                        {/* Add group: a new blank section or one from a template. */}
                        <button
                            type="button"
                            onClick={addSection}
                            className="w-full rounded-md bg-violet-500 px-3 py-2 text-sm font-medium text-white hover:bg-violet-400"
                        >
                            + Section
                        </button>
                        <Menu label="+ Template ▾" title="Add a section from a ready-made template" align="right" className="w-full text-left">
                            {(close) => (
                                <>
                                    {SECTION_TEMPLATES.map((t) => (
                                        <MenuItem key={t.id} onClick={() => { addTemplateSection(t); close() }}>
                                            {t.label}
                                        </MenuItem>
                                    ))}
                                </>
                            )}
                        </Menu>

                        {/* View group: display mode, density, canvas layout tools, and the drawer. */}
                        <Menu label="View ▾" title="Display mode and layout options" align="right" className="w-full text-left">
                            {(close) => (
                                <>
                                    <MenuLabel>Layout</MenuLabel>
                                    <MenuItem onClick={() => { setStackView(false); close() }} title="Free-form draggable canvas">
                                        <span className="flex items-center gap-2">
                                            <span className="w-3 text-cyan-300">{!stackView ? '✓' : ''}</span>Canvas view
                                        </span>
                                    </MenuItem>
                                    <MenuItem onClick={() => { setStackView(true); close() }} title="Responsive stacked columns">
                                        <span className="flex items-center gap-2">
                                            <span className="w-3 text-cyan-300">{stackView ? '✓' : ''}</span>Stack view
                                        </span>
                                    </MenuItem>
                                    <MenuDivider />
                                    <MenuLabel>Zoom</MenuLabel>
                                    {([['compact', '80%'], ['normal', '100%'], ['comfortable', '120%']] as const).map(([d, pct]) => (
                                        <MenuItem
                                            key={d}
                                            onClick={() => { setDensity(d); close() }}
                                            disabled={fitWidth && !stackView}
                                            title={fitWidth && !stackView ? 'Turn off “Fit to width” to set the zoom manually' : `Scale the whole sheet to ${pct}`}
                                        >
                                            <span className="flex items-center gap-2 capitalize">
                                                <span className="w-3 text-cyan-300">{density === d ? '✓' : ''}</span>{d}
                                                <span className="ml-auto pl-3 text-xs text-slate-500">{pct}</span>
                                            </span>
                                        </MenuItem>
                                    ))}
                                    {fitWidth && !stackView && (
                                        <div className="px-3 pb-1 pt-0.5 text-[10px] text-slate-500">Overridden by “Fit to width”.</div>
                                    )}
                                    {!stackView && (
                                        <>
                                            <MenuDivider />
                                            <MenuLabel>Canvas</MenuLabel>
                                            <MenuItem onClick={() => { handleOrganize(); close() }} title="Fit every card to its content and pack them into tidy columns — no overlaps, no gaps">
                                                Auto-arrange
                                            </MenuItem>
                                            <MenuItem onClick={() => { setFitWidth((v) => !v); close() }} title="Scale the whole canvas so its content fills the window width">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-3 text-cyan-300">{fitWidth ? '✓' : ''}</span>Fit to width
                                                </span>
                                            </MenuItem>
                                            <MenuDivider />
                                            <MenuLabel>Grid columns</MenuLabel>
                                            {gridColOptions.map((n) => (
                                                <MenuItem key={n} onClick={() => { changeGridCols(n); close() }} title={`Snap cards to a ${n}-column grid`}>
                                                    <span className="flex items-center gap-2">
                                                        <span className="w-3 text-cyan-300">{gridCols === n ? '✓' : ''}</span>{n} columns
                                                    </span>
                                                </MenuItem>
                                            ))}
                                            <MenuDivider />
                                            <MenuItem onClick={() => { savePreset(); close() }} title="Save the current arrangement as a named layout">
                                                Save this layout…
                                            </MenuItem>
                                            {Object.keys(presets).length > 0 && (
                                                <>
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
                                    <MenuDivider />
                                    <MenuItem onClick={() => { setDrawerOpen((v) => !v); close() }} title={`Open the ${view} drawer of tucked-away sections`}>
                                        {drawerOpen ? 'Close drawer' : 'Open drawer'}{drawerSections.length > 0 ? ` (${drawerSections.length})` : ''}
                                    </MenuItem>
                                </>
                            )}
                        </Menu>

                        <span className="my-1 h-px w-full bg-slate-700" aria-hidden="true" />

                        <Menu label="⋯ More" title="Import, export, and share" align="right" className="w-full text-left">
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
                                    <MenuLabel>Settings</MenuLabel>
                                    <MenuItem onClick={() => { setShowMechanics(true); close() }} title="Configure house rules like the critical-hit damage rule">
                                        Game mechanics…
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
                        <label className="flex w-full items-center justify-center rounded-md border border-slate-600 px-2 py-1" title="Character colour theme">
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
                </div>
                {rollLog && (
                    <div className="mt-1 shrink-0 border-t border-slate-800 pt-2">{rollLog}</div>
                )}
            </header>
        </>
    )
}
