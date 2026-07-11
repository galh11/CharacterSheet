import type { Codec } from './usePersistentState'

/** Per-user sidebar layout preferences (width, portrait size, which core stats
 *  show). All persisted globally in localStorage, like density / grid-cols. */

/** Draggable width of the right-hand side nav, in px. */
export const SIDEBAR_MIN_W = 208
export const SIDEBAR_MAX_W = 520
export const SIDEBAR_DEFAULT_W = 256

/** Codec for the sidebar width, clamped to a sane range. */
export const sidebarWidthCodec: Codec<number> = {
    parse: (raw) => {
        const n = Number(raw)
        return Number.isFinite(n) ? Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, n)) : SIDEBAR_DEFAULT_W
    },
    serialize: (value) => String(Math.round(value)),
}

/** Discrete portrait avatar sizes (chosen in the sidebar-stats settings popover). */
export type PortraitSize = 'sm' | 'md' | 'lg'

/** Avatar button + fallback-icon classes for each portrait size. */
export const PORTRAIT_SIZE_CLASSES: Record<PortraitSize, { avatar: string; icon: string }> = {
    sm: { avatar: 'h-12 w-12', icon: 'h-6 w-6' },
    md: { avatar: 'h-20 w-20', icon: 'h-10 w-10' },
    lg: { avatar: 'h-28 w-28', icon: 'h-14 w-14' },
}

export const PORTRAIT_SIZE_OPTIONS: readonly { value: PortraitSize; label: string }[] = [
    { value: 'sm', label: 'S' },
    { value: 'md', label: 'M' },
    { value: 'lg', label: 'L' },
]

/** Codec for the portrait size, defaulting unknown values to medium. */
export const portraitSizeCodec: Codec<PortraitSize> = {
    parse: (raw) => (raw === 'sm' || raw === 'lg' ? raw : 'md'),
    serialize: (value) => value,
}

/** Which panel the side nav shows — replaces the old collapse arrow with tabs. */
export type SidebarTab = 'stats' | 'tools'

/** Codec for the active sidebar tab, defaulting unknown values to the stats panel. */
export const sidebarTabCodec: Codec<SidebarTab> = {
    parse: (raw) => (raw === 'tools' ? 'tools' : 'stats'),
    serialize: (value) => value,
}

/** The D&D-Beyond-style core stats that can be surfaced in the sidebar. */
export type StatKey = 'abilities' | 'hp' | 'ac' | 'initiative' | 'proficiency' | 'speed' | 'inspiration'

export type SidebarStatsPrefs = Record<StatKey, boolean>

/** Display order + labels for the core-stat toggles. */
export const SIDEBAR_STAT_META: readonly { key: StatKey; label: string }[] = [
    { key: 'abilities', label: 'Ability scores' },
    { key: 'hp', label: 'Hit points' },
    { key: 'ac', label: 'Armor class' },
    { key: 'initiative', label: 'Initiative' },
    { key: 'proficiency', label: 'Proficiency' },
    { key: 'speed', label: 'Speed' },
    { key: 'inspiration', label: 'Inspiration' },
]

/** Every core stat shows by default (the sidebar is the DDB-style home for them). */
export const DEFAULT_SIDEBAR_STATS: SidebarStatsPrefs = {
    abilities: true,
    hp: true,
    ac: true,
    initiative: true,
    proficiency: true,
    speed: true,
    inspiration: true,
}

/** Codec storing the stat-visibility record as JSON, merged over the defaults so
 *  a newly added stat key defaults to visible. */
export const sidebarStatsCodec: Codec<SidebarStatsPrefs> = {
    parse: (raw) => {
        try {
            const parsed = JSON.parse(raw) as Partial<SidebarStatsPrefs>
            return { ...DEFAULT_SIDEBAR_STATS, ...parsed }
        } catch {
            return DEFAULT_SIDEBAR_STATS
        }
    },
    serialize: (value) => JSON.stringify(value),
}

/** Ability-mod slugs the sidebar reads, in display order. */
export const ABILITY_MODS: readonly { slug: string; label: string }[] = [
    { slug: 'str_mod', label: 'STR' },
    { slug: 'dex_mod', label: 'DEX' },
    { slug: 'con_mod', label: 'CON' },
    { slug: 'int_mod', label: 'INT' },
    { slug: 'wis_mod', label: 'WIS' },
    { slug: 'cha_mod', label: 'CHA' },
]

/** Pick the first slug present in `scope` (conventional-name fallbacks). */
export function pickScope(scope: Record<string, number>, ...slugs: string[]): number | undefined {
    for (const s of slugs) {
        if (s in scope && Number.isFinite(scope[s])) return scope[s]
    }
    return undefined
}

/** Format a modifier with an explicit sign (e.g. `+3`, `-1`). */
export function fmtSigned(n: number): string {
    return `${n >= 0 ? '+' : ''}${n}`
}
