import { clsx } from 'clsx'
import { useState, type Dispatch, type SetStateAction } from 'react'
import type { CharacterSheet } from '../model/characterSheet'
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
    sheet: CharacterSheet
    stats: SidebarStatsPrefs
    setStats: Dispatch<SetStateAction<SidebarStatsPrefs>>
    portraitSize: PortraitSize
    setPortraitSize: Dispatch<SetStateAction<PortraitSize>>
    theme: string
    hasInspiration: boolean
    inspirationOn: boolean
    toggleInspiration: () => void
    onDamage: (amount: number) => void
    onHeal: (amount: number) => void
    onTempHp: (amount: number) => void
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
 * The D&D-Beyond-style "core stats" panel that lives at the top of the side nav:
 * ability modifiers, HP (interactive damage/heal/temp), AC, Initiative (roll),
 * Proficiency, Speed and Inspiration. Values are read live from the resolved
 * compute `scope` (conventional slugs) and the sheet's HP section. A gear opens a
 * popover that toggles which stats show and picks the portrait size.
 */
export function SidebarStats({
    scope,
    sheet,
    stats,
    setStats,
    portraitSize,
    setPortraitSize,
    theme,
    hasInspiration,
    inspirationOn,
    toggleInspiration,
    onDamage,
    onHeal,
    onTempHp,
    onRollInitiative,
}: SidebarStatsProps) {
    const [hpAmount, setHpAmount] = useState('')

    // Interactive HP is sourced from the section that owns current + max HP.
    const hpSection = sheet.sections.find(
        (s) =>
            s.fields.some((f) => f.label.toLowerCase() === 'current hp') &&
            s.fields.some((f) => f.label.toLowerCase() === 'max hp'),
    )
    const hpField = (label: string) => hpSection?.fields.find((f) => f.label.toLowerCase() === label)
    const curN = Number(hpField('current hp')?.value) || 0
    const maxN = Number(hpField('max hp')?.value) || 0
    const tempN = Number(hpField('temp hp')?.value) || 0
    const hpPct = maxN > 0 ? Math.max(0, Math.min(100, (curN / maxN) * 100)) : 0

    // Field-backed badge values (undefined → the badge is hidden entirely).
    const ac = pickScope(scope, 'ac', 'armor_class')
    const init = pickScope(scope, 'initiative', 'dex_mod')
    const prof = pickScope(scope, 'proficiency', 'proficiency_bonus', 'prof')
    const speed = pickScope(scope, 'speed', 'walking_speed')
    const mods = ABILITY_MODS.map((m) => ({ ...m, value: pickScope(scope, m.slug) })).filter(
        (m) => m.value !== undefined,
    )

    const applyHp = (fn: (n: number) => void) => {
        const n = Math.abs(Math.trunc(Number(hpAmount)))
        if (!n) return
        fn(n)
        setHpAmount('')
    }

    const showAbilities = stats.abilities && mods.length > 0
    const showHp = stats.hp && !!hpSection
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
                    title="Choose which stats show + portrait size"
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
                    {mods.map((m) => (
                        <div
                            key={m.slug}
                            className="flex flex-col items-center rounded-md border border-slate-700 bg-slate-900/60 py-1"
                            title={`${m.label} modifier`}
                        >
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{m.label}</span>
                            <span className="font-mono text-base font-bold leading-tight text-slate-100">{fmtSigned(m.value!)}</span>
                        </div>
                    ))}
                </div>
            )}

            {showHp && (
                <div className="flex flex-col gap-1.5 rounded-md border border-slate-700 bg-slate-900/60 p-2">
                    <div className="flex items-baseline justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">HP</span>
                        <span className="font-mono text-sm text-slate-200">
                            <span className="text-lg font-bold text-slate-100">{curN}</span>
                            <span className="text-slate-500"> / {maxN}</span>
                            {tempN > 0 && <span className="ml-1 text-cyan-300">+{tempN}</span>}
                        </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                            className={clsx('h-full rounded-full transition-all', hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-rose-500')}
                            style={{ width: `${hpPct}%` }}
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <input
                            value={hpAmount}
                            onChange={(e) => setHpAmount(e.target.value.replace(/[^0-9]/g, ''))}
                            inputMode="numeric"
                            placeholder="0"
                            aria-label="HP amount"
                            className="w-12 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-center font-mono text-sm text-slate-100 outline-none focus:ring-1 focus:ring-slate-500"
                        />
                        <button
                            type="button"
                            onClick={() => applyHp(onDamage)}
                            className="flex-1 rounded border border-rose-500/40 bg-rose-500/15 px-1 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/25"
                            title="Take damage"
                        >
                            − Dmg
                        </button>
                        <button
                            type="button"
                            onClick={() => applyHp(onHeal)}
                            className="flex-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-1 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25"
                            title="Heal"
                        >
                            + Heal
                        </button>
                        <button
                            type="button"
                            onClick={() => applyHp(onTempHp)}
                            className="rounded border border-cyan-500/40 bg-cyan-500/15 px-1.5 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-500/25"
                            title="Set temporary HP"
                        >
                            Temp
                        </button>
                    </div>
                </div>
            )}

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
