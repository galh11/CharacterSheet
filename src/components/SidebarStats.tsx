import { clsx } from 'clsx'
import { type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { Popover } from './Popover'
import {
    ABILITY_MODS,
    fmtSigned,
    pickScope,
    PORTRAIT_SIZE_OPTIONS,
    SIDEBAR_STAT_META,
    type PortraitSize,
    type SidebarStatsPrefs,
} from '../state/sidebarPrefs'

interface SidebarStatsProps {
    scope: Record<string, number>
    stats: SidebarStatsPrefs
    setStats: Dispatch<SetStateAction<SidebarStatsPrefs>>
    portraitSize: PortraitSize
    setPortraitSize: Dispatch<SetStateAction<PortraitSize>>
    rollLogDocked: boolean
    setRollLogDocked: Dispatch<SetStateAction<boolean>>
    theme: string
    hasInspiration: boolean
    inspirationOn: boolean
    toggleInspiration: () => void
    /** The full HP card widget (or null when there's no HP section / it's hidden). */
    hpWidget: ReactNode
    /** Roll a d20 + the ability's modifier as an ability check. */
    onRollAbility: (label: string, mod: number) => void
    onRollInitiative: (mod: number) => void
}

/** A read-only badge showing a labelled stat value (AC, Speed, Proficiency…). */
function StatBadge({ label, value, title }: { label: string; value: string; title?: string }) {
    return (
        <div
            className="flex min-w-0 flex-col items-center rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1.5"
            title={title}
        >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
            <span className="font-mono text-lg font-bold leading-tight text-slate-100">{value}</span>
        </div>
    )
}

/**
 * The D&D-Beyond-style "core stats" panel at the top of the side nav: ability
 * tiles (score + modifier, click to roll a check), the full interactive HP card,
 * AC, Initiative (roll), Proficiency, Speed and Inspiration. Field-backed values
 * are read live from the resolved compute `scope` by conventional slug. A ⚙
 * popover toggles which stats show, picks the portrait size, and docks / pops out
 * the roll log.
 */
export function SidebarStats({
    scope,
    stats,
    setStats,
    portraitSize,
    setPortraitSize,
    rollLogDocked,
    setRollLogDocked,
    theme,
    hasInspiration,
    inspirationOn,
    toggleInspiration,
    hpWidget,
    onRollAbility,
    onRollInitiative,
}: SidebarStatsProps) {
    // Field-backed badge values (undefined → the badge is hidden entirely).
    const ac = pickScope(scope, 'ac', 'armor_class')
    const init = pickScope(scope, 'initiative', 'dex_mod')
    const prof = pickScope(scope, 'proficiency', 'proficiency_bonus', 'prof')
    const speed = pickScope(scope, 'speed', 'walking_speed')
    const abilities = ABILITY_MODS.map((m) => ({
        ...m,
        mod: pickScope(scope, m.slug),
        score: pickScope(scope, m.slug.replace(/_mod$/, '')),
    })).filter((m) => m.mod !== undefined)

    const showAbilities = stats.abilities && abilities.length > 0
    const showHp = stats.hp && !!hpWidget
    const showAc = stats.ac && ac !== undefined
    const showInit = stats.initiative && init !== undefined
    const showProf = stats.proficiency && prof !== undefined
    const showSpeed = stats.speed && speed !== undefined
    const showInsp = stats.inspiration && hasInspiration
    const badges = showAc || showInit || showProf || showSpeed
    const anything = showAbilities || showHp || badges || showInsp

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stats</span>
                <Popover
                    trigger="⚙"
                    ariaLabel="Sidebar stats settings"
                    title="Choose which stats show, portrait size + roll-log location"
                    align="right"
                    triggerClassName="rounded-md border border-slate-700 px-1.5 py-0.5 text-xs leading-none text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                    {() => (
                        <div className="flex w-52 flex-col gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Show in sidebar
                            </span>
                            {SIDEBAR_STAT_META.map((meta) => (
                                <label key={meta.key} className="flex items-center gap-2 text-sm text-slate-200">
                                    <input
                                        type="checkbox"
                                        checked={stats[meta.key]}
                                        onChange={(e) =>
                                            setStats((prev) => ({ ...prev, [meta.key]: e.target.checked }))
                                        }
                                        aria-label={meta.label}
                                    />
                                    {meta.label}
                                </label>
                            ))}
                            <div className="mt-1 border-t border-slate-800 pt-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    Portrait size
                                </span>
                                <div className="mt-1 flex overflow-hidden rounded-md border border-slate-700" role="radiogroup" aria-label="Portrait size">
                                    {PORTRAIT_SIZE_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={portraitSize === opt.value}
                                            onClick={() => setPortraitSize(opt.value)}
                                            className={clsx(
                                                'flex-1 px-2 py-1 text-sm',
                                                portraitSize === opt.value
                                                    ? 'bg-slate-700 font-semibold text-white'
                                                    : 'text-slate-300 hover:bg-slate-800',
                                            )}
                                            title={`Portrait size ${opt.label}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <label className="mt-1 flex items-center gap-2 border-t border-slate-800 pt-2 text-sm text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={rollLogDocked}
                                    onChange={(e) => setRollLogDocked(e.target.checked)}
                                    aria-label="Dock roll log to sidebar"
                                />
                                Dock roll log here
                            </label>
                        </div>
                    )}
                </Popover>
            </div>

            {!anything && (
                <p className="rounded-md border border-dashed border-slate-700 px-2 py-1.5 text-xs text-slate-500">
                    No core stats detected. Add fields like AC, Speed, Proficiency or an HP section.
                </p>
            )}

            {showAbilities && (
                <div className="grid grid-cols-3 gap-1">
                    {abilities.map((m) => (
                        <button
                            key={m.slug}
                            type="button"
                            onClick={() => onRollAbility(m.label, m.mod!)}
                            className="flex flex-col items-center rounded-md border border-slate-700 bg-slate-900/60 py-1 hover:border-violet-500/60 hover:bg-slate-800"
                            title={`Roll a ${m.label} check (d20 ${fmtSigned(m.mod!)})`}
                        >
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{m.label}</span>
                            <span className="font-mono text-lg font-bold leading-tight text-slate-100">
                                {m.score !== undefined ? m.score : fmtSigned(m.mod!)}
                            </span>
                            <span className="rounded-full bg-slate-800 px-1.5 text-[11px] font-mono leading-tight text-slate-300">
                                {fmtSigned(m.mod!)}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {showHp && <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2">{hpWidget}</div>}

            {badges && (
                <div className="grid grid-cols-2 gap-1">
                    {showAc && <StatBadge label="AC" value={String(ac)} title="Armor class" />}
                    {showInit && (
                        <button
                            type="button"
                            onClick={() => onRollInitiative(init!)}
                            className="flex min-w-0 flex-col items-center rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1.5 hover:border-violet-500/60 hover:bg-slate-800"
                            title="Roll initiative (d20 + mod)"
                        >
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Init 🎲</span>
                            <span className="font-mono text-lg font-bold leading-tight text-slate-100">{fmtSigned(init!)}</span>
                        </button>
                    )}
                    {showProf && <StatBadge label="Prof" value={fmtSigned(prof!)} title="Proficiency bonus" />}
                    {showSpeed && <StatBadge label="Speed" value={String(speed)} title="Walking speed" />}
                </div>
            )}

            {showInsp && (
                <button
                    type="button"
                    onClick={toggleInspiration}
                    className={clsx(
                        'rounded-md border px-2.5 py-1.5 text-sm font-medium',
                        inspirationOn
                            ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                            : 'border-slate-600 text-slate-400 hover:bg-slate-800',
                    )}
                    title="Toggle Inspiration"
                >
                    ★ Inspiration
                </button>
            )}

            <div className="border-t border-slate-800" style={{ borderColor: `${theme}22` }} />
        </div>
    )
}
