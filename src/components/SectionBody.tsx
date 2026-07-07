import { useState } from 'react'
import { clsx } from 'clsx'
import type { FormulaResult } from '../model/formula'
import { slugify, type CharacterField, type CharacterSection } from '../model/characterSheet'
import { interpolate } from '../model/compute'
import {
    rollD20,
    rollExpr,
    rollDamage,
    parseModifier,
    formatRoll,
    type D20Mode,
    type RollLogEntry,
} from '../model/dice'
import { Tooltip } from './Tooltip'

interface SectionBodyProps {
    section: CharacterSection
    results: Map<string, FormulaResult>
    onUpdateField: (fieldId: string, patch: Partial<CharacterField>) => void
    onUpdateSection?: (patch: Partial<Pick<CharacterSection, 'meta'>>) => void
    /** slug -> numeric value, for proficiency-aware skills and CON-based healing. */
    scope?: Record<string, number>
    rollMode?: D20Mode
    onRoll?: (entry: Omit<RollLogEntry, 'id'>) => void
    onHeal?: (amount: number) => void
}

const toNum = (v: string): number => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
}
const signed = (n: number): string => (n >= 0 ? `+${n}` : String(n))
const abilityMod = (score: number): number => Math.floor((score - 10) / 2)
/** Double each NdM dice count in an expression (crit hits), leaving flat bonuses. */
const doubleDice = (expr: string): string =>
    expr.replace(/(\d*)d(\d+)/gi, (_, count: string, sides: string) => `${(count === '' ? 1 : Number(count)) * 2}d${sides}`)

const displayValue = (field: CharacterField, results: Map<string, FormulaResult>): string => {
    if (field.type === 'computed') {
        const r = results.get(field.id)
        return r?.ok && r.value !== null ? String(r.value) : '—'
    }
    if (field.type === 'boolean') return field.value === 'true' ? 'Yes' : 'No'
    return field.value || '—'
}

/** Colour accents for damage-type pills. */
const DAMAGE_COLORS: Record<string, string> = {
    fire: 'bg-orange-500/20 text-orange-300 ring-orange-500/40',
    cold: 'bg-cyan-500/20 text-cyan-300 ring-cyan-500/40',
    force: 'bg-violet-500/20 text-violet-300 ring-violet-500/40',
    radiant: 'bg-amber-400/20 text-amber-200 ring-amber-400/40',
    necrotic: 'bg-emerald-800/30 text-emerald-300 ring-emerald-700/40',
    lightning: 'bg-sky-500/20 text-sky-300 ring-sky-500/40',
    thunder: 'bg-indigo-500/20 text-indigo-300 ring-indigo-500/40',
    acid: 'bg-lime-500/20 text-lime-300 ring-lime-500/40',
    poison: 'bg-green-600/20 text-green-300 ring-green-600/40',
    psychic: 'bg-fuchsia-500/20 text-fuchsia-300 ring-fuchsia-500/40',
    slashing: 'bg-rose-500/20 text-rose-300 ring-rose-500/40',
    piercing: 'bg-amber-500/20 text-amber-300 ring-amber-500/40',
    bludgeoning: 'bg-slate-400/20 text-slate-200 ring-slate-400/40',
}
const damageColor = (type?: string): string =>
    (type && DAMAGE_COLORS[type.toLowerCase()]) || 'bg-slate-600/30 text-slate-200 ring-slate-500/40'

/* ── Interactive field widgets ─────────────────────────────────────────── */

function Counter({ field, onUpdateField }: { field: CharacterField; onUpdateField: SectionBodyProps['onUpdateField'] }) {
    const n = toNum(field.value)
    const set = (next: number) => {
        const clamped = Math.max(0, field.max != null ? Math.min(field.max, next) : next)
        onUpdateField(field.id, { value: String(clamped) })
    }
    return (
        <div className="flex items-center justify-between gap-2">
            <FieldLabel field={field} />
            <div className="flex items-center gap-1">
                <button type="button" onClick={() => set(n - 1)} className="h-6 w-6 rounded bg-slate-800 text-sm text-slate-300 hover:bg-slate-700" aria-label={`Decrease ${field.label}`}>−</button>
                <input
                    value={field.value}
                    onChange={(e) => onUpdateField(field.id, { value: e.target.value.replace(/[^0-9-]/g, '') })}
                    onBlur={() => set(n)}
                    inputMode="numeric"
                    aria-label={field.label}
                    className="w-9 rounded bg-slate-900/50 text-center font-mono text-sm text-slate-100 outline-none focus:bg-slate-800 focus:ring-1 focus:ring-slate-500"
                />
                {field.max != null && <span className="font-mono text-sm text-slate-500">/{field.max}</span>}
                <button type="button" onClick={() => set(n + 1)} className="h-6 w-6 rounded bg-slate-800 text-sm text-slate-300 hover:bg-slate-700" aria-label={`Increase ${field.label}`}>+</button>
            </div>
        </div>
    )
}

function ResourcePips({ field, onUpdateField }: { field: CharacterField; onUpdateField: SectionBodyProps['onUpdateField'] }) {
    const max = field.max ?? 0
    const val = Math.max(0, Math.min(max, toNum(field.value)))
    const set = (i: number) => onUpdateField(field.id, { value: String(val === i ? i - 1 : i) })
    return (
        <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
                <FieldLabel field={field} />
                {field.meta?.recharge && field.meta.recharge !== 'none' && (
                    <span
                        className="rounded bg-slate-800 px-1 text-[9px] font-semibold uppercase text-slate-400"
                        title={field.meta.recharge === 'short' ? 'Recharges on a short rest' : 'Recharges on a long rest'}
                    >
                        {field.meta.recharge === 'short' ? 'SR' : 'LR'}
                    </span>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
                {Array.from({ length: max }, (_, idx) => idx + 1).map((i) => (
                    <button
                        key={i}
                        type="button"
                        onClick={() => set(i)}
                        aria-label={`${field.label} ${i} of ${max}`}
                        className={clsx(
                            'h-3.5 w-3.5 rounded-full ring-1 transition-colors',
                            i <= val ? 'bg-emerald-400 ring-emerald-300' : 'bg-transparent ring-slate-600 hover:ring-slate-400',
                        )}
                    />
                ))}
                {max === 0 && <span className="font-mono text-sm text-slate-100">{field.value || '—'}</span>}
            </div>
        </div>
    )
}

function BoolToggle({ field, onUpdateField }: { field: CharacterField; onUpdateField: SectionBodyProps['onUpdateField'] }) {
    const on = field.value === 'true'
    return (
        <div className="flex items-center justify-between gap-2">
            <FieldLabel field={field} />
            <button
                type="button"
                onClick={() => onUpdateField(field.id, { value: on ? 'false' : 'true' })}
                role="switch"
                aria-checked={on}
                aria-label={field.label}
                className={clsx('flex h-5 w-9 items-center rounded-full px-0.5 transition-colors', on ? 'bg-emerald-500' : 'bg-slate-700')}
            >
                <span className={clsx('h-4 w-4 rounded-full bg-white transition-transform', on && 'translate-x-4')} />
            </button>
        </div>
    )
}

function FieldLabel({ field }: { field: CharacterField }) {
    const dot = field.meta?.color ? (
        <span className="mr-1 inline-block h-2 w-2 shrink-0 rounded-full align-middle" style={{ backgroundColor: field.meta.color }} />
    ) : null
    if (field.description) {
        return (
            <Tooltip content={field.description}>
                <span className="cursor-help text-sm text-slate-300 underline decoration-dotted decoration-slate-600 underline-offset-4">
                    {dot}
                    {field.label}
                </span>
            </Tooltip>
        )
    }
    return (
        <span className="text-sm text-slate-400">
            {dot}
            {field.label}
        </span>
    )
}

/* ── Section kinds ─────────────────────────────────────────────────────── */

function DefaultList({ section, results, onUpdateField }: SectionBodyProps) {
    if (section.fields.length === 0) return <p className="text-xs italic text-slate-500">No fields yet.</p>
    return (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {section.fields.map((field) => (
                <li key={field.id}>
                    {field.type === 'counter' ? (
                        <Counter field={field} onUpdateField={onUpdateField} />
                    ) : field.type === 'resource' ? (
                        <ResourcePips field={field} onUpdateField={onUpdateField} />
                    ) : field.type === 'boolean' ? (
                        <BoolToggle field={field} onUpdateField={onUpdateField} />
                    ) : (
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <FieldLabel field={field} />
                            <span className={clsx('font-mono', field.type === 'computed' ? (results.get(field.id)?.ok ? 'text-emerald-300' : 'text-rose-300') : 'text-slate-100')}>
                                {displayValue(field, results)}
                            </span>
                        </div>
                    )}
                </li>
            ))}
        </ul>
    )
}

function StatBlock({ section }: SectionBodyProps) {
    return (
        <div className="grid grid-cols-3 gap-2">
            {section.fields.map((field) => {
                const score = toNum(field.value)
                const mod = abilityMod(score)
                return (
                    <div key={field.id} className="flex flex-col items-center rounded-lg border border-slate-700 bg-slate-900/70 py-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{field.label}</span>
                        <span className="font-mono text-2xl font-bold leading-tight text-slate-100">{signed(mod)}</span>
                        <span className="mt-0.5 rounded-full bg-slate-800 px-2 text-[11px] font-mono text-slate-300">{score}</span>
                    </div>
                )
            })}
        </div>
    )
}

function HpWidget({ section, onUpdateField }: SectionBodyProps) {
    const [amount, setAmount] = useState('')
    const byLabel = (l: string) => section.fields.find((f) => f.label.toLowerCase() === l)
    const cur = byLabel('current hp')
    const max = byLabel('max hp')
    const temp = byLabel('temp hp')
    const reduction = section.fields.find((f) => f.label.toLowerCase() === 'damage reduction')
    const curN = cur ? toNum(cur.value) : 0
    const maxN = max ? toNum(max.value) : 0
    const tempN = temp ? toNum(temp.value) : 0
    const reduceN = reduction ? toNum(reduction.value) : 0
    const pct = maxN > 0 ? Math.max(0, Math.min(100, (curN / maxN) * 100)) : 0

    const apply = (sign: 1 | -1) => {
        const amt = Math.abs(toNum(amount))
        if (!amt || !cur) return
        if (sign === -1) {
            let dmg = Math.max(0, amt - reduceN)
            if (temp && tempN > 0) {
                const absorbed = Math.min(tempN, dmg)
                onUpdateField(temp.id, { value: String(tempN - absorbed) })
                dmg -= absorbed
            }
            if (dmg > 0) onUpdateField(cur.id, { value: String(Math.max(0, curN - dmg)) })
        } else {
            onUpdateField(cur.id, { value: String(maxN > 0 ? Math.min(maxN, curN + amt) : curN + amt) })
        }
        setAmount('')
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-end justify-between">
                <div className="flex items-end gap-1">
                    {cur && (
                        <input
                            value={cur.value}
                            onChange={(e) => onUpdateField(cur.id, { value: e.target.value.replace(/[^0-9]/g, '') })}
                            inputMode="numeric"
                            aria-label="Current HP"
                            className="w-16 rounded bg-slate-900/40 text-center font-mono text-3xl font-bold text-slate-100 outline-none focus:bg-slate-800 focus:ring-1 focus:ring-slate-500"
                        />
                    )}
                    <span className="pb-1 font-mono text-lg text-slate-500">/</span>
                    {max && (
                        <input
                            value={max.value}
                            onChange={(e) => onUpdateField(max.id, { value: e.target.value.replace(/[^0-9]/g, '') })}
                            inputMode="numeric"
                            aria-label="Max HP"
                            className="w-12 rounded bg-slate-900/30 pb-1 text-center font-mono text-lg text-slate-400 outline-none focus:bg-slate-800 focus:ring-1 focus:ring-slate-500"
                        />
                    )}
                </div>
                {temp && (
                    <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-300 ring-1 ring-cyan-500/40">
                        +{tempN} temp
                    </span>
                )}
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div className={clsx('h-full rounded-full transition-all', pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-rose-500')} style={{ width: `${pct}%` }} />
            </div>
            {reduction && (
                <Tooltip content={reduction.description || `Each hit you take is reduced by ${reduceN} before temp HP.`}>
                    <span className="w-fit cursor-help rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/40">
                        −{reduceN} to each hit taken
                    </span>
                </Tooltip>
            )}
            <div className="flex items-center gap-1">
                <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="numeric"
                    placeholder="amount"
                    aria-label="HP amount"
                    className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                />
                <button type="button" onClick={() => apply(-1)} className="rounded bg-rose-600/80 px-2 py-1 text-xs font-medium text-white hover:bg-rose-500">Damage</button>
                <button type="button" onClick={() => apply(1)} className="rounded bg-emerald-600/80 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500">Heal</button>
                {temp && (
                    <input
                        value={temp.value}
                        onChange={(e) => onUpdateField(temp.id, { value: e.target.value.replace(/[^0-9]/g, '') })}
                        inputMode="numeric"
                        aria-label="Temp HP"
                        title="Temp HP"
                        className="ml-auto w-14 rounded border border-cyan-700/50 bg-slate-900 px-2 py-1 text-center text-sm text-cyan-200"
                    />
                )}
            </div>
        </div>
    )
}

const profDot = (state?: string): { cls: string; title: string } => {
    if (state === 'expertise') return { cls: 'bg-amber-400 ring-2 ring-amber-300/50', title: 'Expertise' }
    if (state === 'proficient') return { cls: 'bg-emerald-400', title: 'Proficient' }
    return { cls: 'bg-transparent ring-1 ring-slate-600', title: 'Not proficient' }
}

function SkillRows({ section, scope, rollMode, onRoll }: SectionBodyProps) {
    /** Resolve a skill's modifier: auto from ability + proficiency, or manual value. */
    const skillMod = (field: CharacterField): number => {
        const m = field.meta ?? {}
        if (m.auto === 'true' && m.ability && scope) {
            const score = scope[slugify(m.ability)]
            if (score != null) {
                const pb = scope['proficiency'] ?? scope['proficiency_bonus'] ?? scope['prof'] ?? 0
                const bonus = m.prof === 'expertise' ? pb * 2 : m.prof === 'proficient' ? pb : 0
                return abilityMod(score) + bonus
            }
        }
        return parseModifier(field.value)
    }
    const roll = (field: CharacterField) => {
        const mod = skillMod(field)
        const isSave = section.title.toLowerCase().includes('sav')
        const r = rollD20(mod, rollMode ?? 'normal')
        onRoll?.({
            title: `${field.label} ${isSave ? 'save' : 'check'}`,
            detail: `d20${r.mode !== 'normal' ? ` (${r.rolls.join('/')})` : ''} → ${r.natural} ${signed(mod)} = ${r.total}`,
            total: r.total,
            kind: isSave ? 'save' : 'check',
            crit: r.crit,
        })
    }
    return (
        <ul className="m-0 flex list-none flex-col p-0">
            {section.fields.map((field) => {
                const ability = field.meta?.ability
                const dot = profDot(field.meta?.prof)
                const adv = field.meta?.adv
                const mod = skillMod(field)
                return (
                    <li key={field.id} className="flex items-center gap-2 border-b border-slate-800/70 py-1 last:border-0 text-sm">
                        <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', dot.cls)} title={dot.title} />
                        <button type="button" onClick={() => roll(field)} className="text-left text-slate-200 hover:text-cyan-300" title={`Roll ${field.label}`}>
                            {field.label}
                        </button>
                        {ability && <span className="text-[10px] font-semibold uppercase text-slate-500">{ability}</span>}
                        {adv && (
                            <Tooltip content={adv}>
                                <span className="grid h-4 w-4 cursor-help place-items-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/40">A</span>
                            </Tooltip>
                        )}
                        <button type="button" onClick={() => roll(field)} className="ml-auto font-mono text-slate-100 hover:text-cyan-300" title={`Roll ${field.label}`}>
                            {signed(mod)}
                        </button>
                    </li>
                )
            })}
        </ul>
    )
}

function ActionCards({ section, scope, rollMode, onRoll }: SectionBodyProps) {
    /** Resolve `{...}` formula placeholders in a meta value against the scope. */
    const val = (raw?: string) => interpolate(raw ?? '', scope ?? {})
    /** Extra damage is active unless it is gated on a toggle (meta.extraWhen) that is off. */
    const extraActive = (m: Record<string, string>) => !m.extraWhen || (scope?.[m.extraWhen] ?? 0) > 0
    const rollAttack = (field: CharacterField) => {
        const mod = parseModifier(val(field.meta?.hit))
        const r = rollD20(mod, rollMode ?? 'normal')
        onRoll?.({
            title: `${field.label} — attack`,
            detail: `d20${r.mode !== 'normal' ? ` (${r.rolls.join('/')})` : ''} → ${r.natural} ${signed(mod)} = ${r.total}`,
            total: r.total,
            kind: 'attack',
            crit: r.crit,
        })
    }
    const rollFieldDamage = (field: CharacterField, crit: boolean) => {
        const m = field.meta ?? {}
        const mk = (e?: string) => (crit ? doubleDice(val(e)) : val(e))
        const parts = [{ expr: mk(m.damage), type: m.type }]
        if (extraActive(m)) parts.push({ expr: mk(m.extra), type: m.extraType })
        const dmg = rollDamage(parts)
        if (dmg.parts.length === 0) return
        const detail = dmg.parts.map((p) => `${p.result.total}${p.type ? ` ${p.type}` : ''}`).join(' + ')
        onRoll?.({
            title: `${field.label} — damage${crit ? ' (crit)' : ''}`,
            detail: `${detail}${dmg.parts.length > 1 ? ` = ${dmg.total}` : ''}`,
            total: dmg.total,
            kind: 'damage',
        })
    }
    return (
        <div className="flex flex-col gap-2">
            {section.fields.map((field) => {
                const m = field.meta ?? {}
                const hit = val(m.hit)
                const damage = val(m.damage)
                const extra = val(m.extra)
                const extraOn = extraActive(m)
                const hasMeta = hit || damage || m.type || extra || m.range
                const canAttack = Boolean(m.hit)
                const canDamage = Boolean(m.damage || m.extra)
                return (
                    <div key={field.id} className="rounded-lg border border-slate-700 bg-slate-900/70 p-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-slate-100">{field.label}</span>
                            {hit && <span className="rounded-md bg-slate-700/70 px-1.5 py-0.5 font-mono text-xs text-slate-100 ring-1 ring-slate-600">{hit}</span>}
                            {damage && <span className={clsx('rounded-md px-1.5 py-0.5 font-mono text-xs ring-1', damageColor(m.type))}>{damage}{m.type ? ` ${m.type}` : ''}</span>}
                            {extra && extraOn && <span className={clsx('rounded-md px-1.5 py-0.5 font-mono text-xs ring-1', damageColor(m.extraType))}>{extra}{m.extraType ? ` ${m.extraType}` : ''}</span>}
                            {extra && !extraOn && m.extraWhen && (
                                <span className="rounded-md bg-slate-800/60 px-1.5 py-0.5 font-mono text-xs text-slate-500 ring-1 ring-slate-700" title="Inactive — toggle it on to add this damage">
                                    {extra}{m.extraType ? ` ${m.extraType}` : ''} · off
                                </span>
                            )}
                            {m.range && <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">{m.range}</span>}
                            {!hasMeta && field.value && <span className="font-mono text-xs text-slate-300">{field.value}</span>}
                        </div>
                        {(canAttack || canDamage) && onRoll && (
                            <div className="mt-1.5 flex flex-wrap gap-1 print:hidden">
                                {canAttack && <button type="button" onClick={() => rollAttack(field)} className="rounded bg-cyan-600/80 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-cyan-500">🎲 Attack</button>}
                                {canDamage && <button type="button" onClick={() => rollFieldDamage(field, false)} className="rounded bg-rose-600/80 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-rose-500">🎲 Damage</button>}
                                {canDamage && <button type="button" onClick={() => rollFieldDamage(field, true)} className="rounded border border-amber-500/50 px-2 py-0.5 text-[11px] font-medium text-amber-300 hover:bg-amber-900/30" title="Roll damage with doubled dice (critical hit)">Crit</button>}
                            </div>
                        )}
                        {field.description && <p className="m-0 mt-1 text-xs leading-snug text-slate-400">{field.description}</p>}
                    </div>
                )
            })}
        </div>
    )
}

function HitDicePool({ field, conMod, onUpdateField, onRoll, onHeal }: {
    field: CharacterField
    conMod: number
    onUpdateField: SectionBodyProps['onUpdateField']
    onRoll: SectionBodyProps['onRoll']
    onHeal: SectionBodyProps['onHeal']
}) {
    const [spend, setSpend] = useState('1')
    const die = (field.meta?.die || field.label).match(/d\d+/i)?.[0]?.toLowerCase() ?? 'd8'
    const remaining = toNum(field.value)
    const max = field.max ?? remaining
    const roll = () => {
        const n = Math.max(1, Math.min(remaining, toNum(spend) || 1))
        if (n <= 0 || remaining <= 0) return
        const r = rollExpr(`${n}${die}`)
        const heal = Math.max(0, r.total + n * conMod)
        onHeal?.(heal)
        onUpdateField(field.id, { value: String(remaining - n) })
        onRoll?.({
            title: `Hit dice ${die} ×${n}`,
            detail: `${formatRoll(r)}${conMod ? ` + ${n}×CON(${conMod})` : ''} → heal ${heal}`,
            total: heal,
            kind: 'heal',
        })
    }
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-slate-200">{die}</span>
            <span className="font-mono text-xs text-slate-400">{remaining}/{max}</span>
            <div className="ml-auto flex items-center gap-1 print:hidden">
                <input
                    value={spend}
                    onChange={(e) => setSpend(e.target.value.replace(/[^0-9]/g, ''))}
                    inputMode="numeric"
                    aria-label={`Hit dice to spend (${die})`}
                    className="w-10 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-center text-xs text-slate-100"
                />
                <button
                    type="button"
                    onClick={roll}
                    disabled={remaining <= 0}
                    className={clsx('rounded px-2 py-0.5 text-[11px] font-medium', remaining > 0 ? 'bg-emerald-600/80 text-white hover:bg-emerald-500' : 'cursor-not-allowed bg-slate-800 text-slate-600')}
                >
                    🎲 Spend
                </button>
            </div>
        </div>
    )
}

function HitDiceWidget({ section, scope, onUpdateField, onRoll, onHeal }: SectionBodyProps) {
    const conScore = scope?.['con'] ?? scope?.['constitution']
    const conMod = conScore != null ? abilityMod(conScore) : 0
    if (section.fields.length === 0) return <p className="text-xs italic text-slate-500">No hit dice yet.</p>
    return (
        <div className="flex flex-col gap-2">
            {section.fields.map((field) => (
                <HitDicePool key={field.id} field={field} conMod={conMod} onUpdateField={onUpdateField} onRoll={onRoll} onHeal={onHeal} />
            ))}
            <p className="m-0 text-[10px] text-slate-500">Spend on a short rest to heal (die + CON mod each). Refills on a long rest.</p>
        </div>
    )
}

function PipRow({ label, value, max, color, onSet }: {
    label: string
    value: number
    max: number
    color: string
    onSet: (v: number) => void
}) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="w-16 text-slate-300">{label}</span>
            <div className="flex gap-1">
                {Array.from({ length: max }, (_, i) => i + 1).map((i) => (
                    <button
                        key={i}
                        type="button"
                        onClick={() => onSet(value === i ? i - 1 : i)}
                        aria-label={`${label} ${i} of ${max}`}
                        className={clsx('h-4 w-4 rounded-full ring-1 transition-colors', i <= value ? color : 'bg-transparent ring-slate-600 hover:ring-slate-400')}
                    />
                ))}
            </div>
        </div>
    )
}

function DeathSaves({ section, onUpdateField }: SectionBodyProps) {
    const succ = section.fields.find((f) => f.label.toLowerCase().startsWith('success'))
    const fail = section.fields.find((f) => f.label.toLowerCase().startsWith('fail'))
    const succN = succ ? toNum(succ.value) : 0
    const failN = fail ? toNum(fail.value) : 0
    const status = succN >= 3 ? 'Stable' : failN >= 3 ? 'Dead' : null
    return (
        <div className="flex flex-col gap-2">
            {succ && <PipRow label="Successes" value={succN} max={3} color="bg-emerald-400 ring-emerald-300" onSet={(v) => onUpdateField(succ.id, { value: String(v) })} />}
            {fail && <PipRow label="Failures" value={failN} max={3} color="bg-rose-500 ring-rose-400" onSet={(v) => onUpdateField(fail.id, { value: String(v) })} />}
            <div className="flex items-center gap-2">
                {status && (
                    <span className={clsx('rounded px-2 py-0.5 text-xs font-semibold', status === 'Stable' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300')}>
                        {status}
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => {
                        if (succ) onUpdateField(succ.id, { value: '0' })
                        if (fail) onUpdateField(fail.id, { value: '0' })
                    }}
                    className="ml-auto rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800 print:hidden"
                >
                    Reset
                </button>
            </div>
            {!succ && !fail && <p className="text-xs italic text-slate-500">Add "Successes" and "Failures" fields.</p>}
        </div>
    )
}

function Conditions({ section, onUpdateField }: SectionBodyProps) {
    if (section.fields.length === 0) return <p className="text-xs italic text-slate-500">No conditions yet.</p>
    const active = section.fields.filter((f) => f.value === 'true')
    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
                {section.fields.map((field) => {
                    const on = field.value === 'true'
                    const chip = (
                        <button
                            type="button"
                            onClick={() => onUpdateField(field.id, { value: on ? 'false' : 'true' })}
                            className={clsx(
                                'rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition-colors',
                                on ? 'bg-rose-500/25 text-rose-200 ring-rose-500/50' : 'bg-slate-800 text-slate-400 ring-slate-700 hover:text-slate-200',
                            )}
                        >
                            {field.label}
                        </button>
                    )
                    return <span key={field.id}>{field.description ? <Tooltip content={field.description}>{chip}</Tooltip> : chip}</span>
                })}
            </div>
            {active.some((f) => f.description) && (
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                    {active.filter((f) => f.description).map((f) => (
                        <li key={f.id} className="text-[11px] leading-snug text-rose-300/90">
                            <span className="font-semibold">{f.label}:</span> {f.description}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

function SpellSlots({ section, onUpdateField }: SectionBodyProps) {
    if (section.fields.length === 0) return <p className="text-xs italic text-slate-500">No spell slots yet.</p>
    return (
        <div className="flex flex-col gap-1.5">
            {section.fields.map((field) => (
                <ResourcePips key={field.id} field={field} onUpdateField={onUpdateField} />
            ))}
        </div>
    )
}

function Initiative({ section, onUpdateField, onUpdateSection, rollMode, onRoll }: SectionBodyProps) {
    const turn = section.meta?.turn
    const sorted = [...section.fields].sort((a, b) => toNum(b.value) - toNum(a.value))
    const setTurn = (id: string | undefined) => onUpdateSection?.({ meta: { ...section.meta, turn: id ?? '' } })
    const advance = (dir: 1 | -1) => {
        if (sorted.length === 0) return
        const idx = sorted.findIndex((f) => f.id === turn)
        const nextIdx = idx < 0 ? 0 : (idx + dir + sorted.length) % sorted.length
        setTurn(sorted[nextIdx].id)
    }
    const rollInit = (field: CharacterField) => {
        const mod = parseModifier(field.meta?.mod)
        const r = rollD20(mod, rollMode ?? 'normal')
        onUpdateField(field.id, { value: String(r.total) })
        onRoll?.({ title: `${field.label} — initiative`, detail: `d20 → ${r.natural} ${signed(mod)} = ${r.total}`, total: r.total, kind: 'check' })
    }
    if (section.fields.length === 0) return <p className="text-xs italic text-slate-500">No combatants yet.</p>
    return (
        <div className="flex flex-col gap-1">
            <div className="mb-1 flex gap-1 print:hidden">
                <button type="button" onClick={() => advance(1)} className="rounded bg-cyan-600/80 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-cyan-500">Next turn</button>
                <button type="button" onClick={() => advance(-1)} className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800">Prev</button>
                <button type="button" onClick={() => setTurn(undefined)} className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800">Reset</button>
            </div>
            <ul className="m-0 flex list-none flex-col p-0">
                {sorted.map((field) => (
                    <li
                        key={field.id}
                        className={clsx(
                            'flex items-center gap-2 rounded border-b border-slate-800/70 px-1 py-1 text-sm last:border-0',
                            field.id === turn && 'bg-cyan-500/15 ring-1 ring-cyan-500/40',
                        )}
                    >
                        {field.id === turn ? <span className="text-cyan-300">▶</span> : <span className="w-3" />}
                        <button type="button" onClick={() => setTurn(field.id)} className="text-left text-slate-200 hover:text-cyan-300">
                            {field.label}
                        </button>
                        <button type="button" onClick={() => rollInit(field)} className="ml-auto rounded bg-slate-800 px-1.5 text-[11px] text-slate-300 hover:bg-slate-700 print:hidden" title="Roll initiative">🎲</button>
                        <input
                            value={field.value}
                            onChange={(e) => onUpdateField(field.id, { value: e.target.value.replace(/[^0-9-]/g, '') })}
                            inputMode="numeric"
                            aria-label={`${field.label} initiative`}
                            className="w-10 rounded bg-slate-900/50 text-center font-mono text-slate-100 outline-none focus:bg-slate-800 focus:ring-1 focus:ring-slate-500"
                        />
                    </li>
                ))}
            </ul>
        </div>
    )
}

export function SectionBody(props: SectionBodyProps) {
    switch (props.section.kind) {
        case 'abilities':
            return <StatBlock {...props} />
        case 'hp':
            return <HpWidget {...props} />
        case 'skills':
            return <SkillRows {...props} />
        case 'actions':
            return <ActionCards {...props} />
        case 'hitdice':
            return <HitDiceWidget {...props} />
        case 'deathsaves':
            return <DeathSaves {...props} />
        case 'conditions':
            return <Conditions {...props} />
        case 'spellslots':
            return <SpellSlots {...props} />
        case 'initiative':
            return <Initiative {...props} />
        default:
            return <DefaultList {...props} />
    }
}
