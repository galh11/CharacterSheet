import { useState } from 'react'
import { clsx } from 'clsx'
import type { FormulaResult } from '../model/formula'
import { slugify, type CharacterField, type CharacterSection, type EffectOp, type ActionToggle, type CritMode } from '../model/characterSheet'
import { interpolate, resolveFieldMax, evalModifier, type Contribution, type EffectTag } from '../model/compute'
import {
    rollD20,
    rollD20Series,
    rollExpr,
    rollDamage,
    critDamage,
    parseModifier,
    formatRoll,
    type D20Mode,
    type D20Series,
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
    /** Situational bonus added to every d20 roll (attack/skill/save/initiative). */
    bonus?: number
    /** Fresh bonus die (sides) added to each d20 roll, e.g. 4 for Bless/Guidance. */
    bonusDie?: number
    /** How many times to roll each d20 check (grouped attacks). */
    repeat?: number
    onRoll?: (entry: Omit<RollLogEntry, 'id'>) => void
    onHeal?: (amount: number) => void
    /** Spend `amount` from the resource field with the given slug. */
    onSpend?: (slug: string, amount: number) => void
    /** Refill a resource to max, optionally paying a cost by adding 1 to a counter. */
    onRestore?: (refillSlug: string, costSlug?: string) => void
    /** Toggle a boolean activation flag anywhere on the sheet, by slug. */
    onToggleFlag?: (slug: string) => void
    /** Set a boolean activation flag to a specific value, by slug. */
    onSetFlag?: (slug: string, value: boolean) => void
    /** Apply temporary HP (kept if higher). */
    onTempHp?: (amount: number) => void
    /** Add a field to this section with the given overrides. */
    onAddField?: (overrides: Partial<CharacterField>) => void
    /** Target slug -> numeric contributions from relational effects. */
    contributions?: Map<string, Contribution[]>
    /** Target slug -> annotation tags from relational effects. */
    effectTags?: Map<string, EffectTag[]>
    /** How critical-hit damage is rolled (per-sheet house rule). */
    critMode?: CritMode
}

const toNum = (v: string): number => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
}
const signed = (n: number): string => (n >= 0 ? `+${n}` : String(n))
const abilityMod = (score: number): number => Math.floor((score - 10) / 2)

/** Format a d20 series into a roll-log detail/total/crit (handles grouped rolls + bonus die). */
const d20Detail = (series: D20Series, mod: number, sit: number, bonusDie: number, mode: D20Mode) => {
    if (series.results.length > 1) {
        return { detail: `[${series.results.map((r) => r.total).join(', ')}] best ${series.best}`, total: series.best, crit: null as 'hit' | 'miss' | null }
    }
    const r = series.results[0]
    const modeStr = mode !== 'normal' ? ` (${mode === 'advantage' ? 'adv' : 'dis'})` : ''
    const bd = bonusDie ? ` +1d${bonusDie}(${r.bonusDie})` : ''
    return {
        detail: `d20${modeStr} → ${r.natural} ${signed(mod)}${sit ? ` ${signed(sit)} sit` : ''}${bd} = ${r.total}`,
        total: r.total,
        crit: r.crit,
    }
}

const displayValue = (field: CharacterField, results: Map<string, FormulaResult>): string => {
    if (field.type === 'computed') {
        const r = results.get(field.id)
        return r?.ok && r.value !== null ? String(r.value) : '—'
    }
    if (field.type === 'boolean') return field.value === 'true' ? 'Yes' : 'No'
    return field.value || '—'
}

/** Display value that reflects relational effects: a plain number field that is
 *  the target of add/sub/set/min/max effects shows its folded scope value (e.g.
 *  Speed 35 → 45 while Large Form is on) rather than its raw base. */
const effectiveDisplay = (
    field: CharacterField,
    results: Map<string, FormulaResult>,
    scope?: Record<string, number>,
    contributions?: Map<string, Contribution[]>,
): string => {
    if (field.type === 'number' && scope) {
        const slug = slugify(field.label)
        if ((contributions?.get(slug)?.length ?? 0) > 0 && slug in scope) return String(scope[slug])
    }
    return displayValue(field, results)
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

/** Common 5e conditions with concise rules text, for the conditions library picker. */
const CONDITION_LIBRARY: [string, string][] = [
    ['Blinded', "Can't see; auto-fail sight checks. Attacks against you have Advantage; your attacks have Disadvantage."],
    ['Charmed', "Can't attack the charmer; they have Advantage on social checks with you."],
    ['Deafened', "Can't hear; auto-fail hearing checks."],
    ['Frightened', 'Disadvantage on checks & attacks while the source is in sight; you can’t move closer to it.'],
    ['Grappled', 'Speed 0; ends if the grappler is Incapacitated or you’re moved away.'],
    ['Incapacitated', "Can't take actions, bonus actions, or reactions."],
    ['Invisible', 'Heavily obscured. Attacks against you have Disadvantage; your attacks have Advantage.'],
    ['Paralyzed', 'Incapacitated, can’t move/speak; auto-fail STR/DEX saves. Attacks have Advantage; hits within 5 ft crit.'],
    ['Petrified', 'Turned to stone; Incapacitated; resistance to all damage; immune to poison & disease.'],
    ['Poisoned', 'Disadvantage on attack rolls and ability checks.'],
    ['Prone', 'Disadvantage on attacks. Melee against you has Advantage, ranged Disadvantage. Half movement to stand.'],
    ['Restrained', 'Speed 0. Attacks against you have Advantage, yours Disadvantage; Disadvantage on DEX saves.'],
    ['Stunned', 'Incapacitated; auto-fail STR/DEX saves. Attacks against you have Advantage.'],
    ['Unconscious', 'Incapacitated & Prone, drop everything; auto-fail STR/DEX saves. Attacks have Advantage; hits within 5 ft crit.'],
]

/* ── Interactive field widgets ─────────────────────────────────────────── */

function Counter({ field, scope, onUpdateField }: { field: CharacterField; scope?: Record<string, number>; onUpdateField: SectionBodyProps['onUpdateField'] }) {
    const n = toNum(field.value)
    const max = resolveFieldMax(field, scope ?? {})
    const isExhaustion = field.label.toLowerCase() === 'exhaustion'
    const set = (next: number) => {
        const clamped = Math.max(0, max != null ? Math.min(max, next) : next)
        onUpdateField(field.id, { value: String(clamped) })
    }
    return (
        <div className="flex flex-col gap-0.5">
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
                    {max != null && <span className="font-mono text-sm text-slate-500">/{max}</span>}
                    <button type="button" onClick={() => set(n + 1)} className="h-6 w-6 rounded bg-slate-800 text-sm text-slate-300 hover:bg-slate-700" aria-label={`Increase ${field.label}`}>+</button>
                </div>
            </div>
            {isExhaustion && n > 0 && (
                <span className="text-[10px] leading-tight text-amber-300/90">
                    {n >= 6 ? 'Dead.' : `−${2 * n} to all d20 tests · −${5 * n} ft Speed`}
                </span>
            )}
        </div>
    )
}

function ResourcePips({ field, scope, onUpdateField }: { field: CharacterField; scope?: Record<string, number>; onUpdateField: SectionBodyProps['onUpdateField'] }) {
    const max = resolveFieldMax(field, scope ?? {}) ?? 0
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

/* ── Relational effect badges ──────────────────────────────────────────── */

const TAG_META: Record<string, { abbr: string; cls: string; title: string }> = {
    advantage: { abbr: 'ADV', cls: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40', title: 'Advantage' },
    disadvantage: { abbr: 'DIS', cls: 'bg-rose-500/20 text-rose-300 ring-rose-500/40', title: 'Disadvantage' },
    resist: { abbr: 'RES', cls: 'bg-sky-500/20 text-sky-300 ring-sky-500/40', title: 'Resistance' },
    immune: { abbr: 'IMM', cls: 'bg-violet-500/20 text-violet-300 ring-violet-500/40', title: 'Immunity' },
    vulnerable: { abbr: 'VUL', cls: 'bg-orange-500/20 text-orange-300 ring-orange-500/40', title: 'Vulnerable' },
    note: { abbr: 'NOTE', cls: 'bg-slate-600/30 text-slate-200 ring-slate-500/40', title: 'Note' },
}

const OP_LABEL: Record<EffectOp, string> = {
    add: '+', sub: '−', set: '=', min: '≥', max: '≤',
    advantage: 'advantage', disadvantage: 'disadvantage', resist: 'resist',
    immune: 'immune to', vulnerable: 'vulnerable to', note: 'note',
}

/** Small badges shown next to a target field: the net numeric bonus (with each
 *  contributing source in the tooltip) plus any advantage/resistance tags. */
function EffectTargetBadges({ slug, contributions, tags }: {
    slug: string
    contributions?: Map<string, Contribution[]>
    tags?: Map<string, EffectTag[]>
}) {
    const contribs = contributions?.get(slug) ?? []
    const tagList = tags?.get(slug) ?? []
    if (contribs.length === 0 && tagList.length === 0) return null
    const net = contribs.filter((c) => c.op === 'add' || c.op === 'sub').reduce((sum, c) => sum + c.amount, 0)
    const hasSet = contribs.some((c) => c.op === 'set')
    const clamps = contribs.filter((c) => c.op === 'min' || c.op === 'max')
    const numTitle = contribs
        .map((c) => `${c.op === 'set' ? '=' : c.op === 'min' ? '≥' : c.op === 'max' ? '≤' : signed(c.amount)} from ${c.sourceLabel}`)
        .join('\n')
    return (
        <span className="ml-1 inline-flex flex-wrap items-center gap-1 align-middle">
            {(net !== 0 || hasSet) && (
                <span
                    className="rounded bg-amber-500/20 px-1 text-[10px] font-semibold text-amber-200 ring-1 ring-amber-500/40"
                    title={numTitle}
                >
                    {hasSet ? '±' : signed(net)}
                </span>
            )}
            {clamps.map((c, i) => (
                <span
                    key={`clamp-${c.sourceId}-${i}`}
                    className="rounded bg-sky-500/20 px-1 text-[10px] font-semibold text-sky-200 ring-1 ring-sky-500/40"
                    title={`${c.op === 'min' ? 'at least' : 'at most'} ${c.amount} — from ${c.sourceLabel}`}
                >
                    {c.op === 'min' ? '≥' : '≤'}{c.amount}
                </span>
            ))}
            {tagList.map((t, i) => {
                const meta = TAG_META[t.op] ?? TAG_META.note
                return (
                    <span
                        key={`${t.sourceId}-${i}`}
                        className={clsx('inline-flex items-center gap-1 rounded px-1 text-[10px] font-semibold ring-1', meta.cls)}
                        title={`${meta.title}${t.value ? ` (${t.value})` : ''} — from ${t.sourceLabel}`}
                    >
                        <span className="uppercase">{meta.abbr}</span>
                        {t.value && <span className="font-normal normal-case opacity-90">{t.value}</span>}
                        <span className="font-normal normal-case opacity-70">· {t.sourceLabel}</span>
                    </span>
                )
            })}
        </span>
    )
}

/** Chips summarizing the effects a source field grants, e.g. "→ +1 ac". */
function FieldGrantChips({ field }: { field: CharacterField }) {
    const effects = (field.effects ?? []).filter((e) => e.target)
    if (effects.length === 0) return null
    const active = field.type === 'boolean' ? field.value === 'true' : field.effectsActive !== false
    return (
        <div className={clsx('mt-0.5 flex flex-wrap gap-1', !active && 'opacity-40')}>
            {effects.map((e, i) => {
                const numeric = e.op === 'add' || e.op === 'sub' || e.op === 'set' || e.op === 'min' || e.op === 'max'
                const label = numeric
                    ? `${OP_LABEL[e.op]}${e.value || '0'} ${e.target}`
                    : `${OP_LABEL[e.op]} ${e.target}${e.value ? `: ${e.value}` : ''}`.trim()
                return (
                    <span
                        key={i}
                        className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 ring-1 ring-slate-700"
                        title={active ? 'Active effect' : 'Inactive — toggle on to apply'}
                    >
                        → {label}
                    </span>
                )
            })}
        </div>
    )
}

/* ── Section kinds ─────────────────────────────────────────────────────── */

function DefaultList({ section, results, scope, onUpdateField, contributions, effectTags }: SectionBodyProps) {
    if (section.fields.length === 0) return <p className="text-xs italic text-slate-500">No fields yet.</p>
    return (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {section.fields.map((field) => (
                <li key={field.id}>
                    {field.type === 'counter' ? (
                        <Counter field={field} scope={scope} onUpdateField={onUpdateField} />
                    ) : field.type === 'resource' ? (
                        <ResourcePips field={field} scope={scope} onUpdateField={onUpdateField} />
                    ) : field.type === 'boolean' ? (
                        <BoolToggle field={field} onUpdateField={onUpdateField} />
                    ) : (
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="flex items-center">
                                <FieldLabel field={field} />
                                <EffectTargetBadges slug={slugify(field.label)} contributions={contributions} tags={effectTags} />
                            </span>
                            <span className={clsx('font-mono', field.type === 'computed' ? (results.get(field.id)?.ok ? 'text-emerald-300' : 'text-rose-300') : 'text-slate-100')}>
                                {effectiveDisplay(field, results, scope, contributions)}
                            </span>
                        </div>
                    )}
                    <FieldGrantChips field={field} />
                </li>
            ))}
        </ul>
    )
}

function StatBlock({ section, results, contributions, effectTags }: SectionBodyProps) {
    const cols = Math.min(6, Math.max(1, Math.round(toNum(section.meta?.cols ?? '')) || 3))
    // Editable modifiers: if the section has a computed `<ability>_mod` field, show
    // its value on the card (so you can change the formula); otherwise derive it.
    const modBySlug = new Map<string, number | null>()
    for (const f of section.fields) {
        if (f.type === 'computed') {
            const r = results.get(f.id)
            modBySlug.set(slugify(f.label), r?.ok ? r.value : null)
        }
    }
    const scoreFields = section.fields.filter((f) => f.type !== 'computed')
    return (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {scoreFields.map((field) => {
                const score = toNum(field.value)
                const custom = modBySlug.get(`${slugify(field.label)}_mod`)
                const mod = custom != null ? custom : abilityMod(score)
                return (
                    <div
                        key={field.id}
                        className="flex flex-col items-center rounded-lg border border-slate-700 bg-slate-900/70 py-2"
                        title={`${field.label} ${score} → modifier ${signed(mod)}${custom != null ? '' : `  ·  floor((${score} − 10) / 2)`}`}
                    >
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{field.label}</span>
                        <span className="font-mono text-2xl font-bold leading-tight text-slate-100">{signed(mod)}</span>
                        <span className="mt-0.5 rounded-full bg-slate-800 px-2 text-[11px] font-mono text-slate-300">{score}</span>
                        <EffectTargetBadges slug={`${slugify(field.label)}_mod`} contributions={contributions} tags={effectTags} />
                    </div>
                )
            })}
        </div>
    )
}

export function HpWidget({ section, onUpdateField, onUpdateSection, onRoll, onHeal, contributions, effectTags }: SectionBodyProps) {
    const [amount, setAmount] = useState('')
    const [dmgType, setDmgType] = useState('')
    const [concSave, setConcSave] = useState<number | null>(null)
    const byLabel = (l: string) => section.fields.find((f) => f.label.toLowerCase() === l)
    const cur = byLabel('current hp')
    const max = byLabel('max hp')
    const temp = byLabel('temp hp')
    const reduction = section.fields.find((f) => f.label.toLowerCase() === 'damage reduction')
    const conc = byLabel('concentration')
    const parseTypes = (v?: string) => new Set((v ?? '').toLowerCase().split(/[,;]/).map((s) => s.trim()).filter(Boolean))
    // Defenses can be authored two ways: legacy free-text HP fields, or (preferred)
    // resist/immune/vulnerable relational-effect tags an item/feature grants to an
    // HP-relevant slug — each tag's value carries the damage type(s). Notes an item
    // attaches to these slugs (op 'note', e.g. armor's flat physical reduction) are
    // surfaced with their source via EffectTargetBadges below.
    const HP_TAG_SLUGS = ['damage_reduction', 'defenses', 'hp', 'hit_points']
    const hpTags = HP_TAG_SLUGS.flatMap((s) => effectTags?.get(s) ?? [])
    const tagTypes = (op: EffectOp) => hpTags.filter((t) => t.op === op).flatMap((t) => [...parseTypes(t.value)])
    const resist = new Set([...parseTypes(byLabel('resistances')?.value), ...tagTypes('resist')])
    const vuln = new Set([...parseTypes(byLabel('vulnerabilities')?.value), ...tagTypes('vulnerable')])
    const immune = new Set(tagTypes('immune'))
    const curN = cur ? toNum(cur.value) : 0
    const maxN = max ? toNum(max.value) : 0
    const tempN = temp ? toNum(temp.value) : 0
    const reduceN = reduction ? toNum(reduction.value) : 0
    // A temporary max-HP modifier (combat effects, a wraith's drain, etc.). The
    // `max` field stays the character's *true* max; this shifts the *effective*
    // cap current HP is measured against, and can be negative.
    const maxMod = Number(section.meta?.maxHpMod) || 0
    const effMaxN = max ? Math.max(0, maxN + maxMod) : 0
    const setMaxMod = (v: number) =>
        onUpdateSection?.({ meta: { ...section.meta, maxHpMod: v === 0 ? '' : String(v) } })
    const pct = effMaxN > 0 ? Math.max(0, Math.min(100, (curN / effMaxN) * 100)) : 0

    // Death saves live in the HP section's meta and only surface once Current HP
    // hits 0 — there is no separate death-saves section.
    const succN = Math.max(0, Math.min(3, Number(section.meta?.deathSuccesses) || 0))
    const failN = Math.max(0, Math.min(3, Number(section.meta?.deathFailures) || 0))
    const dying = !!cur && curN <= 0
    const deathStatus = succN >= 3 ? 'Stable' : failN >= 3 ? 'Dead' : null
    const setDeaths = (s: number, f: number) =>
        onUpdateSection?.({ meta: { ...section.meta, deathSuccesses: String(s), deathFailures: String(f) } })
    const rollDeathSave = () => {
        const r = rollD20(0, 'normal')
        let s = succN
        let f = failN
        let detail: string
        if (r.natural === 20) {
            onHeal?.(1)
            s = 0
            f = 0
            detail = 'Nat 20 — regain 1 HP and wake up!'
        } else if (r.natural === 1) {
            f = Math.min(3, failN + 2)
            detail = 'Nat 1 — two failures'
        } else if (r.natural >= 10) {
            s = Math.min(3, succN + 1)
            detail = `${r.natural} — success`
        } else {
            f = Math.min(3, failN + 1)
            detail = `${r.natural} — failure`
        }
        setDeaths(s, f)
        onRoll?.({ title: 'Death save', detail, total: r.natural, kind: 'save', crit: r.crit })
    }

    const apply = (sign: 1 | -1) => {
        const amt = Math.abs(toNum(amount))
        if (!amt || !cur) return
        if (sign === -1) {
            // The "damage reduction" note is informational only — apply exactly
            // the number you type (resistances/vulnerabilities still adjust it).
            let taken = amt
            const t = dmgType.toLowerCase()
            if (t && immune.has(t)) taken = 0
            else {
                if (t && vuln.has(t)) taken = taken * 2
                if (t && resist.has(t)) taken = Math.floor(taken / 2)
            }
            let dmg = taken
            if (temp && tempN > 0) {
                const absorbed = Math.min(tempN, dmg)
                onUpdateField(temp.id, { value: String(tempN - absorbed) })
                dmg -= absorbed
            }
            if (dmg > 0) onUpdateField(cur.id, { value: String(Math.max(0, curN - dmg)) })
            // Taking damage while already at 0 HP is an automatic death-save failure.
            if (curN <= 0 && taken > 0 && failN < 3) setDeaths(succN, Math.min(3, failN + 1))
            if (conc && conc.value === 'true' && taken > 0) setConcSave(Math.max(10, Math.floor(taken / 2)))
        } else {
            const next = effMaxN > 0 ? Math.min(effMaxN, curN + amt) : curN + amt
            onUpdateField(cur.id, { value: String(next) })
            // Healing above 0 stabilises the character and clears death saves.
            if (next > 0 && (succN || failN)) setDeaths(0, 0)
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
                            title={maxMod !== 0 ? `True max HP (${maxN}); effective cap is ${effMaxN}` : 'Max HP'}
                            className={clsx(
                                'w-12 rounded bg-slate-900/30 pb-1 text-center font-mono text-lg outline-none focus:bg-slate-800 focus:ring-1 focus:ring-slate-500',
                                maxMod !== 0 ? 'text-slate-500 line-through decoration-slate-600' : 'text-slate-400',
                            )}
                        />
                    )}
                    {max && maxMod !== 0 && (
                        <span
                            className={clsx(
                                'pb-1 font-mono text-lg font-bold',
                                maxMod < 0 ? 'text-rose-300' : 'text-emerald-300',
                            )}
                            title={`Effective max HP: true ${maxN} ${maxMod < 0 ? '−' : '+'} ${Math.abs(maxMod)}`}
                        >
                            {effMaxN}
                        </span>
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
            {max && (
                <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400">Max HP mod</span>
                    <button
                        type="button"
                        onClick={() => setMaxMod(maxMod - 1)}
                        aria-label="Decrease max HP modifier"
                        className="flex h-5 w-5 items-center justify-center rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
                    >
                        −
                    </button>
                    <input
                        value={section.meta?.maxHpMod ?? ''}
                        onChange={(e) => onUpdateSection?.({ meta: { ...section.meta, maxHpMod: e.target.value.replace(/[^0-9-]/g, '') } })}
                        inputMode="numeric"
                        placeholder="0"
                        aria-label="Max HP modifier"
                        title="Temporary change to max HP (e.g. −10 from a combat effect). Your true max stays intact."
                        className="w-12 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-center font-mono text-slate-100 outline-none focus:ring-1 focus:ring-slate-500"
                    />
                    <button
                        type="button"
                        onClick={() => setMaxMod(maxMod + 1)}
                        aria-label="Increase max HP modifier"
                        className="flex h-5 w-5 items-center justify-center rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
                    >
                        +
                    </button>
                    {maxMod !== 0 && (
                        <button
                            type="button"
                            onClick={() => setMaxMod(0)}
                            className="ml-auto rounded border border-slate-600 px-1.5 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
                            title="Clear max HP modifier"
                        >
                            Reset
                        </button>
                    )}
                </div>
            )}
            {dying && (
                <div className="flex flex-col gap-2 rounded-md border border-rose-500/40 bg-rose-950/30 p-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-rose-300">Death saves</span>
                        {deathStatus && (
                            <span className={clsx('rounded px-2 py-0.5 text-xs font-semibold', deathStatus === 'Stable' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300')}>
                                {deathStatus}
                            </span>
                        )}
                    </div>
                    <PipRow label="Successes" value={succN} max={3} color="bg-emerald-400 ring-emerald-300" onSet={(v) => setDeaths(v, failN)} />
                    <PipRow label="Failures" value={failN} max={3} color="bg-rose-500 ring-rose-400" onSet={(v) => setDeaths(succN, v)} />
                    <div className="flex items-center gap-2 print:hidden">
                        {onRoll && (
                            <button
                                type="button"
                                onClick={rollDeathSave}
                                className="rounded bg-violet-600/80 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-violet-500"
                            >
                                🎲 Roll save
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setDeaths(0, 0)}
                            className="ml-auto rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            )}
            {reduction && (
                <Tooltip content={reduction.description || `Each hit you take is reduced by ${reduceN} before temp HP.`}>
                    <span className="w-fit cursor-help rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/40">
                        −{reduceN} to each hit taken
                    </span>
                </Tooltip>
            )}
            {HP_TAG_SLUGS.some((s) => (effectTags?.get(s)?.length ?? 0) + (contributions?.get(s)?.length ?? 0) > 0) && (
                <div className="flex flex-wrap items-center gap-1">
                    {HP_TAG_SLUGS.map((s) => (
                        <EffectTargetBadges key={s} slug={s} contributions={contributions} tags={effectTags} />
                    ))}
                </div>
            )}
            {conc && (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            onUpdateField(conc.id, { value: conc.value === 'true' ? 'false' : 'true' })
                            setConcSave(null)
                        }}
                        role="switch"
                        aria-checked={conc.value === 'true'}
                        aria-label="Concentrating"
                        className={clsx('flex h-5 w-9 items-center rounded-full px-0.5 transition-colors', conc.value === 'true' ? 'bg-violet-500' : 'bg-slate-700')}
                    >
                        <span className={clsx('h-4 w-4 rounded-full bg-white transition-transform', conc.value === 'true' && 'translate-x-4')} />
                    </button>
                    <span className="text-xs text-slate-300">Concentrating</span>
                    {concSave != null && (
                        <button
                            type="button"
                            onClick={() => setConcSave(null)}
                            className="ml-auto rounded bg-violet-500/25 px-2 py-0.5 text-[11px] font-semibold text-violet-200 ring-1 ring-violet-500/50 hover:bg-violet-500/40"
                            title="Dismiss"
                        >
                            CON save DC {concSave}
                        </button>
                    )}
                </div>
            )}
            <div className="flex flex-wrap items-center gap-1">
                <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="numeric"
                    placeholder="amount"
                    aria-label="HP amount"
                    className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                />
                {(resist.size > 0 || vuln.size > 0 || immune.size > 0) && (
                    <select
                        value={dmgType}
                        onChange={(e) => setDmgType(e.target.value)}
                        aria-label="Damage type"
                        title="Damage type (applies resistance / vulnerability)"
                        className="rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs text-slate-200"
                    >
                        <option value="">any</option>
                        {Object.keys(DAMAGE_COLORS).map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                )}
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
            {(resist.size > 0 || vuln.size > 0 || immune.size > 0) && (
                <div className="flex flex-wrap gap-1 text-[10px]">
                    {[...resist].map((t) => (
                        <span key={`r-${t}`} className="rounded bg-sky-500/15 px-1 text-sky-300 ring-1 ring-sky-500/30">resist {t}</span>
                    ))}
                    {[...vuln].map((t) => (
                        <span key={`v-${t}`} className="rounded bg-rose-500/15 px-1 text-rose-300 ring-1 ring-rose-500/30">vuln {t}</span>
                    ))}
                    {[...immune].map((t) => (
                        <span key={`i-${t}`} className="rounded bg-violet-500/15 px-1 text-violet-300 ring-1 ring-violet-500/30">immune {t}</span>
                    ))}
                </div>
            )}
        </div>
    )
}

const profDot = (state?: string): { cls: string; title: string } => {
    if (state === 'expertise') return { cls: 'bg-amber-400 ring-2 ring-amber-300/50', title: 'Expertise' }
    if (state === 'proficient') return { cls: 'bg-emerald-400', title: 'Proficient' }
    return { cls: 'bg-transparent ring-1 ring-slate-600', title: 'Not proficient' }
}

function SkillRows({ section, scope, rollMode, bonus, bonusDie, repeat, onRoll, contributions, effectTags }: SectionBodyProps) {
    /** Resolve a skill's modifier: auto from ability + proficiency, or manual value.
     *  Numeric relational effects (add/sub) an item/feature grants to the skill's
     *  slug fold in too, so e.g. Primal Order Magician's +wis_mod to Arcana reaches
     *  the roll (and is attributed by the badge). */
    const skillMod = (field: CharacterField): number => {
        const contribNet = (contributions?.get(slugify(field.label)) ?? [])
            .filter((c) => c.op !== 'set')
            .reduce((sum, c) => sum + c.amount, 0)
        const m = field.meta ?? {}
        if (m.auto === 'true' && m.ability && scope) {
            const score = scope[slugify(m.ability)]
            if (score != null) {
                const pb = scope['proficiency'] ?? scope['proficiency_bonus'] ?? scope['prof'] ?? 0
                const bonus = m.prof === 'expertise' ? pb * 2 : m.prof === 'proficient' ? pb : 0
                return abilityMod(score) + bonus + contribNet
            }
        }
        return parseModifier(field.value) + contribNet
    }
    const roll = (field: CharacterField) => {
        const mod = skillMod(field)
        const sit = bonus ?? 0
        const mode = rollMode ?? 'normal'
        const isSave = section.title.toLowerCase().includes('sav')
        const series = rollD20Series(mod + sit, mode, repeat ?? 1, bonusDie ?? 0)
        const d = d20Detail(series, mod, sit, bonusDie ?? 0, mode)
        onRoll?.({
            title: `${field.label} ${isSave ? 'save' : 'check'}${series.results.length > 1 ? ` ×${series.results.length}` : ''}`,
            detail: d.detail,
            total: d.total,
            kind: isSave ? 'save' : 'check',
            crit: d.crit,
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
                    <li key={field.id} className="flex flex-wrap items-center gap-2 border-b border-slate-800/70 py-1 last:border-0 text-sm">
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
                        <EffectTargetBadges slug={slugify(field.label)} contributions={contributions} tags={effectTags} />
                        <button type="button" onClick={() => roll(field)} className="ml-auto font-mono text-slate-100 hover:text-cyan-300" title={`Roll ${field.label}`}>
                            {signed(mod)}
                        </button>
                    </li>
                )
            })}
        </ul>
    )
}

function ActionCards({ section, scope, rollMode, bonus, bonusDie, repeat, onRoll, onSpend, onRestore, onUpdateField, onToggleFlag, onSetFlag, onTempHp, contributions, effectTags, critMode }: SectionBodyProps) {
    /** Resolve `{...}` formula placeholders in a meta value against the scope. */
    const val = (raw?: string) => interpolate(raw ?? '', scope ?? {})
    /** A toggle is on either from its own `active` flag or, when it's bound to a
     *  boolean `field`, from that field's live value in the scope. */
    const toggleOn = (t: ActionToggle): boolean => (t.field ? (scope?.[t.field] ?? 0) > 0 : t.active)
    const activeToggles = (field: CharacterField): ActionToggle[] => (field.toggles ?? []).filter(toggleOn)

    /** Effective to-hit modifier after applying active toggles (replace overrides,
     *  add sums). Returns null when the action has no attack roll at all. */
    const effectiveHit = (field: CharacterField): number | null => {
        const m = field.meta ?? {}
        const toggles = activeToggles(field)
        const hasHit = Boolean(m.hit) || toggles.some((t) => t.hit)
        if (!hasHit) return null
        let mod = m.hit ? parseModifier(val(m.hit)) : 0
        for (const t of toggles) {
            if (!t.hit) continue
            if (t.hitMode === 'replace') mod = parseModifier(val(t.hit))
            else mod += parseModifier(val(t.hit))
        }
        return mod
    }

    /** Effective damage parts after applying active toggles: a `replace` part
     *  swaps the base weapon damage; `add` parts append extra typed parts. A
     *  toggle's `setType` recolours the whole attack to one damage type. */
    const effectiveParts = (field: CharacterField): { expr: string; type?: string }[] => {
        const m = field.meta ?? {}
        let base = m.damage ? { expr: m.damage, type: m.type || '' } : null
        const added: { expr: string; type?: string }[] = []
        let typeOverride = ''
        for (const t of activeToggles(field)) {
            for (const part of t.parts) {
                if (!part.damage) continue
                if (part.mode === 'replace') base = { expr: part.damage, type: part.type || base?.type || '' }
                else added.push({ expr: part.damage, type: part.type || '' })
            }
            if (t.setType) typeOverride = t.setType
        }
        const parts = [...(base ? [base] : []), ...added]
        return typeOverride ? parts.map((p) => ({ ...p, type: typeOverride })) : parts
    }

    const sit = bonus ?? 0
    const mode = rollMode ?? 'normal'
    /** Flip a toggle: a field-bound toggle flips the shared boolean (so every
     *  place bound to it updates together); a plain toggle flips its own flag. */
    const flipToggle = (field: CharacterField, t: ActionToggle) => {
        if (t.field) onToggleFlag?.(t.field)
        else
            onUpdateField(field.id, {
                toggles: (field.toggles ?? []).map((x) => (x.id === t.id ? { ...x, active: !x.active } : x)),
            })
    }
    const rollAttack = (field: CharacterField) => {
        const mod = effectiveHit(field) ?? 0
        const series = rollD20Series(mod + sit, mode, repeat ?? 1, bonusDie ?? 0)
        const d = d20Detail(series, mod, sit, bonusDie ?? 0, mode)
        onRoll?.({
            title: `${field.label} — attack${series.results.length > 1 ? ` ×${series.results.length}` : ''}`,
            detail: d.detail,
            total: d.total,
            kind: 'attack',
            crit: d.crit,
        })
    }
    const rollFieldDamage = (field: CharacterField, crit: boolean) => {
        const parts = effectiveParts(field).map((p) => ({
            expr: crit ? critDamage(val(p.expr), critMode) : val(p.expr),
            type: p.type,
        }))
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
    const spend = (field: CharacterField) => {
        const m = field.meta ?? {}
        const amount = Number(m.cost) || 1
        onSpend?.(m.costField!, amount)
        // Optionally switch on a linked buff/state boolean (e.g. spending a Large
        // Form use also activates the Large Form buff).
        if (m.activates) onSetFlag?.(m.activates, true)
        onRoll?.({ title: field.label, detail: `Spent ${amount} ${m.costLabel || m.costField}`, total: amount, kind: 'raw' })
    }
    const rollTemp = (field: CharacterField) => {
        const m = field.meta ?? {}
        const r = rollExpr(val(m.temp))
        onTempHp?.(r.total)
        onRoll?.({ title: `${field.label} — temp HP`, detail: `${formatRoll(r)} (kept if higher)`, total: r.total, kind: 'heal' })
    }
    const restore = (field: CharacterField) => {
        const m = field.meta ?? {}
        onRestore?.(m.refill!, m.refillCost || undefined)
        const cost = m.refillCost ? ` (+1 ${m.refillCostLabel || m.refillCost})` : ''
        onRoll?.({ title: field.label, detail: `Restored ${m.refillLabel || m.refill}${cost}`, total: 0, kind: 'heal' })
    }
    return (
        <div className="flex flex-col gap-2">
            {section.fields.map((field) => {
                const m = field.meta ?? {}
                const hitMod = effectiveHit(field)
                const parts = effectiveParts(field)
                const toggles = field.toggles ?? []
                const hasMeta = hitMod !== null || parts.length > 0 || m.range
                const canAttack = hitMod !== null
                const canDamage = parts.length > 0
                const canSpend = Boolean(m.costField)
                const canTemp = Boolean(m.temp)
                const canRestore = Boolean(m.refill)
                const showRow = canAttack || canDamage || canSpend || canTemp || canRestore || toggles.length > 0
                return (
                    <div key={field.id} className="rounded-lg border border-slate-700 bg-slate-900/70 p-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-slate-100">{field.label}</span>
                            <EffectTargetBadges slug={slugify(field.label)} contributions={contributions} tags={effectTags} />
                            {hitMod !== null && <span className="rounded-md bg-slate-700/70 px-1.5 py-0.5 font-mono text-xs text-slate-100 ring-1 ring-slate-600">{signed(hitMod)}</span>}
                            {parts.map((p, i) => (
                                <span key={i} className={clsx('rounded-md px-1.5 py-0.5 font-mono text-xs ring-1', damageColor(p.type))}>
                                    {val(p.expr)}{p.type ? ` ${p.type}` : ''}
                                </span>
                            ))}
                            {m.range && <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">{m.range}</span>}
                            {!hasMeta && field.value && <span className="font-mono text-xs text-slate-300">{field.value}</span>}
                        </div>
                        {showRow && onRoll && (
                            <div className="mt-1.5 flex flex-wrap gap-1 print:hidden">
                                {toggles.map((t) => (
                                    <Tooltip key={t.id} content={t.description || (t.field ? `Linked to “${t.field}” — toggles everywhere at once` : '')}>
                                        <button
                                            type="button"
                                            onClick={() => flipToggle(field, t)}
                                            role="switch"
                                            aria-checked={toggleOn(t)}
                                            aria-label={t.label || 'Toggle'}
                                            className={clsx(
                                                'rounded px-2 py-0.5 text-[11px] font-medium ring-1 transition-colors',
                                                toggleOn(t)
                                                    ? 'bg-amber-400/20 text-amber-200 ring-amber-400/60'
                                                    : 'bg-slate-800 text-slate-400 ring-slate-700 hover:text-slate-200',
                                            )}
                                            title={toggleOn(t) ? `${t.label} active — click to turn off` : `Activate ${t.label}`}
                                        >
                                            {toggleOn(t) ? '🔥' : '○'} {t.label || 'Toggle'}
                                            {t.field && <span className="ml-1 opacity-60" aria-hidden>🔗</span>}
                                        </button>
                                    </Tooltip>
                                ))}
                                {canAttack && <button type="button" onClick={() => rollAttack(field)} className="rounded bg-cyan-600/80 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-cyan-500">🎲 Attack</button>}
                                {canDamage && <button type="button" onClick={() => rollFieldDamage(field, false)} className="rounded bg-rose-600/80 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-rose-500">🎲 Damage</button>}
                                {canDamage && <button type="button" onClick={() => rollFieldDamage(field, true)} className="rounded border border-amber-500/50 px-2 py-0.5 text-[11px] font-medium text-amber-300 hover:bg-amber-900/30" title="Roll damage with doubled dice (critical hit)">Crit</button>}
                                {canTemp && <button type="button" onClick={() => rollTemp(field)} className="rounded bg-cyan-700/70 px-2 py-0.5 text-[11px] font-medium text-cyan-100 hover:bg-cyan-600">🎲 Temp HP</button>}
                                {canSpend && (
                                    <button
                                        type="button"
                                        onClick={() => spend(field)}
                                        disabled={(scope?.[m.costField!] ?? 0) < (Number(m.cost) || 1)}
                                        className={clsx(
                                            'rounded px-2 py-0.5 text-[11px] font-medium',
                                            (scope?.[m.costField!] ?? 0) >= (Number(m.cost) || 1)
                                                ? 'bg-fuchsia-600/80 text-white hover:bg-fuchsia-500'
                                                : 'cursor-not-allowed bg-slate-800 text-slate-600',
                                        )}
                                        title={`Spend ${Number(m.cost) || 1} ${m.costLabel || m.costField}`}
                                    >
                                        −{Number(m.cost) || 1} {m.costLabel || 'spend'}
                                    </button>
                                )}
                                {canRestore && (
                                    <button
                                        type="button"
                                        onClick={() => restore(field)}
                                        className="rounded bg-emerald-700/80 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-emerald-600"
                                        title={`Restore ${m.refillLabel || m.refill}${m.refillCost ? ` (+1 ${m.refillCostLabel || m.refillCost})` : ''}`}
                                    >
                                        ↻ Restore
                                    </button>
                                )}
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

function Conditions({ section, onUpdateField, onAddField }: SectionBodyProps) {
    const active = section.fields.filter((f) => f.value === 'true')
    const have = new Set(section.fields.map((f) => f.label.toLowerCase()))
    const addFromLibrary = (label: string) => {
        if (have.has(label.toLowerCase())) return
        const desc = CONDITION_LIBRARY.find(([l]) => l === label)?.[1] ?? ''
        onAddField?.({ label, type: 'boolean', value: 'true', description: desc })
    }
    return (
        <div className="flex flex-col gap-2">
            {section.fields.length === 0 && <p className="text-xs italic text-slate-500">No conditions yet.</p>}
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
            {onAddField && (
                <select
                    value=""
                    onChange={(e) => {
                        if (e.target.value) addFromLibrary(e.target.value)
                    }}
                    aria-label="Add a condition"
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 print:hidden"
                >
                    <option value="">+ Add a common condition…</option>
                    {CONDITION_LIBRARY.map(([label]) => (
                        <option key={label} value={label} disabled={have.has(label.toLowerCase())}>
                            {label}
                        </option>
                    ))}
                </select>
            )}
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

function SpellSlots({ section, scope, onUpdateField }: SectionBodyProps) {
    if (section.fields.length === 0) return <p className="text-xs italic text-slate-500">No spell slots yet.</p>
    return (
        <div className="flex flex-col gap-1.5">
            {section.fields.map((field) => (
                <ResourcePips key={field.id} field={field} scope={scope} onUpdateField={onUpdateField} />
            ))}
        </div>
    )
}

/** Spell cards: each field is a spell (name + level/school/range/save/damage). A
 *  Cast button spends the linked spell-slot resource (via `onSpend`) and logs the
 *  cast; a Damage button rolls the spell's damage dice. All numeric bits accept
 *  `{expr}` interpolation, so a save DC or damage can reference other fields. */
function SpellCards({ section, scope, onRoll, onSpend, contributions, effectTags, critMode }: SectionBodyProps) {
    const val = (raw?: string) => interpolate(raw ?? '', scope ?? {})
    const cast = (field: CharacterField) => {
        const m = field.meta ?? {}
        const cost = Number(m.cost) || 1
        if (m.slot) onSpend?.(m.slot, cost)
        onRoll?.({
            title: `${field.label} — cast`,
            detail: m.slot ? `Spent ${cost} × ${m.slotLabel || m.slot}` : 'Cast',
            total: cost,
            kind: 'raw',
        })
    }
    const rollSpellDamage = (field: CharacterField, crit: boolean) => {
        const m = field.meta ?? {}
        if (!m.damage) return
        const dmg = rollDamage([{ expr: crit ? critDamage(val(m.damage), critMode) : val(m.damage), type: m.type || '' }])
        if (dmg.parts.length === 0) return
        const detail = dmg.parts.map((p) => `${p.result.total}${p.type ? ` ${p.type}` : ''}`).join(' + ')
        onRoll?.({ title: `${field.label} — damage${crit ? ' (crit)' : ''}`, detail, total: dmg.total, kind: 'damage' })
    }
    if (section.fields.length === 0) return <p className="text-xs italic text-slate-500">No spells yet.</p>
    return (
        <div className="flex flex-col gap-2">
            {section.fields.map((field) => {
                const m = field.meta ?? {}
                const level = m.level ?? ''
                const isCantrip = level === '' || level === '0'
                const cost = Number(m.cost) || 1
                const canCast = Boolean(m.slot)
                const enough = !m.slot || (scope?.[m.slot] ?? 0) >= cost
                return (
                    <div key={field.id} className="rounded-lg border border-slate-700 bg-slate-900/70 p-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-slate-100">{field.label}</span>
                            <EffectTargetBadges slug={slugify(field.label)} contributions={contributions} tags={effectTags} />
                            <span className="rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-medium text-violet-200 ring-1 ring-violet-500/40">
                                {isCantrip ? 'Cantrip' : `Lvl ${level}`}
                            </span>
                            {m.school && <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">{m.school}</span>}
                            {m.range && <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">{m.range}</span>}
                            {m.save && <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-200 ring-1 ring-amber-500/30">{val(m.save)}</span>}
                            {m.damage && (
                                <span className={clsx('rounded-md px-1.5 py-0.5 font-mono text-xs ring-1', damageColor(m.type))}>
                                    {val(m.damage)}{m.type ? ` ${m.type}` : ''}
                                </span>
                            )}
                        </div>
                        {onRoll && (
                            <div className="mt-1.5 flex flex-wrap gap-1 print:hidden">
                                <button
                                    type="button"
                                    onClick={() => cast(field)}
                                    disabled={canCast && !enough}
                                    className={clsx(
                                        'rounded px-2 py-0.5 text-[11px] font-medium',
                                        !canCast
                                            ? 'bg-violet-600/80 text-white hover:bg-violet-500'
                                            : enough
                                              ? 'bg-fuchsia-600/80 text-white hover:bg-fuchsia-500'
                                              : 'cursor-not-allowed bg-slate-800 text-slate-600',
                                    )}
                                    title={canCast ? `Cast — spend ${cost} × ${m.slotLabel || m.slot}` : 'Cast'}
                                >
                                    ✦ Cast{canCast ? ` −${cost}` : ''}
                                </button>
                                {m.damage && <button type="button" onClick={() => rollSpellDamage(field, false)} className="rounded bg-rose-600/80 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-rose-500">🎲 Damage</button>}
                                {m.damage && <button type="button" onClick={() => rollSpellDamage(field, true)} className="rounded border border-amber-500/50 px-2 py-0.5 text-[11px] font-medium text-amber-300 hover:bg-amber-900/30" title="Roll damage with doubled dice (critical hit)">Crit</button>}
                            </div>
                        )}
                        {field.description && <p className="m-0 mt-1 text-xs leading-snug text-slate-400">{field.description}</p>}
                    </div>
                )
            })}
        </div>
    )
}

function Initiative({ section, scope, onUpdateField, onUpdateSection, rollMode, bonus, bonusDie, onRoll }: SectionBodyProps) {
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
        const mod = evalModifier(field.meta?.mod, scope ?? {})
        const sit = bonus ?? 0
        const mode = rollMode ?? 'normal'
        const series = rollD20Series(mod + sit, mode, 1, bonusDie ?? 0)
        const d = d20Detail(series, mod, sit, bonusDie ?? 0, mode)
        onUpdateField(field.id, { value: String(d.total) })
        onRoll?.({ title: `${field.label} — initiative`, detail: d.detail, total: d.total, kind: 'check' })
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

function CurrencyWidget({ section, onUpdateField }: SectionBodyProps) {
    if (section.fields.length === 0) return <p className="text-xs italic text-slate-500">No currency yet.</p>
    const step = (field: CharacterField, delta: number) =>
        onUpdateField(field.id, { value: String(Math.max(0, toNum(field.value) + delta)) })
    return (
        <div className="flex flex-col gap-1.5">
            {section.fields.map((field) => (
                <div key={field.id} className="flex items-center gap-2 text-sm">
                    <FieldLabel field={field} />
                    <div className="ml-auto flex items-center gap-1">
                        <button type="button" onClick={() => step(field, -1)} className="h-6 w-6 rounded bg-slate-800 text-sm text-slate-300 hover:bg-slate-700" aria-label={`Decrease ${field.label}`}>−</button>
                        <input
                            value={field.value}
                            onChange={(e) => onUpdateField(field.id, { value: e.target.value.replace(/[^0-9]/g, '') })}
                            inputMode="numeric"
                            aria-label={field.label}
                            className="w-16 rounded bg-slate-900/50 text-center font-mono text-slate-100 outline-none focus:bg-slate-800 focus:ring-1 focus:ring-slate-500"
                        />
                        <button type="button" onClick={() => step(field, 1)} className="h-6 w-6 rounded bg-slate-800 text-sm text-slate-300 hover:bg-slate-700" aria-label={`Increase ${field.label}`}>+</button>
                    </div>
                </div>
            ))}
        </div>
    )
}

/** Standard coin denominations, low → high, for ordering the coin purse. */
const COIN_ORDER = ['cp', 'sp', 'ep', 'gp', 'pp']

/** A single, D&D-Beyond-style inventory: a coin purse (fields flagged
 *  `meta.coin`) across the top, then the item list below. Everything lives in
 *  one section so currency travels with the gear. */
function InventoryWidget({ section, results, scope, onUpdateField, contributions, effectTags }: SectionBodyProps) {
    if (section.fields.length === 0) return <p className="text-xs italic text-slate-500">No items yet.</p>
    const coins = section.fields
        .filter((f) => f.meta?.coin)
        .sort((a, b) => {
            const ai = COIN_ORDER.indexOf((a.meta?.coin ?? '').toLowerCase())
            const bi = COIN_ORDER.indexOf((b.meta?.coin ?? '').toLowerCase())
            return (ai === -1 ? COIN_ORDER.length : ai) - (bi === -1 ? COIN_ORDER.length : bi)
        })
    const items = section.fields.filter((f) => !f.meta?.coin)
    const stepCoin = (field: CharacterField, delta: number) =>
        onUpdateField(field.id, { value: String(Math.max(0, toNum(field.value) + delta)) })
    return (
        <div className="flex flex-col gap-2">
            {coins.length > 0 && (
                <div className="flex flex-wrap gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                    {coins.map((field) => (
                        <div key={field.id} className="flex items-center gap-1 rounded-md bg-slate-900/60 px-1.5 py-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/80" title={field.label}>
                                {(field.meta?.coin || field.label).toUpperCase()}
                            </span>
                            <button type="button" onClick={() => stepCoin(field, -1)} className="h-5 w-5 rounded bg-slate-800 text-xs text-slate-300 hover:bg-slate-700" aria-label={`Decrease ${field.label}`}>−</button>
                            <input
                                value={field.value}
                                onChange={(e) => onUpdateField(field.id, { value: e.target.value.replace(/[^0-9]/g, '') })}
                                inputMode="numeric"
                                aria-label={field.label}
                                className="w-14 rounded bg-slate-900/50 text-center font-mono text-sm text-slate-100 outline-none focus:bg-slate-800 focus:ring-1 focus:ring-slate-500"
                            />
                            <button type="button" onClick={() => stepCoin(field, 1)} className="h-5 w-5 rounded bg-slate-800 text-xs text-slate-300 hover:bg-slate-700" aria-label={`Increase ${field.label}`}>+</button>
                        </div>
                    ))}
                </div>
            )}
            {items.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {items.map((field) => (
                        <li key={field.id}>
                            {field.type === 'counter' ? (
                                <Counter field={field} scope={scope} onUpdateField={onUpdateField} />
                            ) : field.type === 'resource' ? (
                                <ResourcePips field={field} scope={scope} onUpdateField={onUpdateField} />
                            ) : field.type === 'boolean' ? (
                                <BoolToggle field={field} onUpdateField={onUpdateField} />
                            ) : (
                                <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="flex items-center">
                                        <FieldLabel field={field} />
                                        <EffectTargetBadges slug={slugify(field.label)} contributions={contributions} tags={effectTags} />
                                    </span>
                                    {field.type === 'computed' ? (
                                        <span className={clsx('font-mono', results.get(field.id)?.ok ? 'text-emerald-300' : 'text-rose-300')}>
                                            {displayValue(field, results)}
                                        </span>
                                    ) : (
                                        <input
                                            value={field.value}
                                            onChange={(e) => onUpdateField(field.id, { value: e.target.value })}
                                            aria-label={`${field.label} quantity`}
                                            placeholder="—"
                                            className="w-24 shrink-0 rounded bg-transparent px-1 text-right font-mono text-slate-100 outline-none placeholder:text-slate-600 focus:bg-slate-800 focus:ring-1 focus:ring-slate-500"
                                        />
                                    )}
                                </div>
                            )}
                            <FieldGrantChips field={field} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

function TimersWidget({ section, onUpdateField }: SectionBodyProps) {
    if (section.fields.length === 0)
        return <p className="text-xs italic text-slate-500">No active buffs. Add a field per effect; its value is rounds remaining.</p>
    const set = (field: CharacterField, rounds: number) =>
        onUpdateField(field.id, { value: String(Math.max(0, rounds)) })
    const advanceAll = () => {
        for (const field of section.fields) {
            const r = toNum(field.value)
            if (r > 0) onUpdateField(field.id, { value: String(r - 1) })
        }
    }
    const anyActive = section.fields.some((f) => toNum(f.value) > 0)
    return (
        <div className="flex flex-col gap-1.5">
            <button
                type="button"
                onClick={advanceAll}
                disabled={!anyActive}
                className="self-start rounded-md bg-indigo-600/80 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                title="Reduce every active timer by one round"
            >
                ⏱ Next round
            </button>
            {section.fields.map((field) => {
                const rounds = toNum(field.value)
                const expired = rounds <= 0
                return (
                    <div key={field.id} className={clsx('flex items-center gap-2 text-sm', expired && 'opacity-45')}>
                        <FieldLabel field={field} />
                        {expired && <span className="text-[10px] uppercase tracking-wide text-slate-500">expired</span>}
                        <div className="ml-auto flex items-center gap-1">
                            <button type="button" onClick={() => set(field, rounds - 1)} className="h-6 w-6 rounded bg-slate-800 text-sm text-slate-300 hover:bg-slate-700" aria-label={`Decrease ${field.label}`}>−</button>
                            <input
                                value={field.value}
                                onChange={(e) => onUpdateField(field.id, { value: e.target.value.replace(/[^0-9]/g, '') })}
                                inputMode="numeric"
                                aria-label={`${field.label} rounds remaining`}
                                className="w-12 rounded bg-slate-900/50 text-center font-mono text-slate-100 outline-none focus:bg-slate-800 focus:ring-1 focus:ring-slate-500"
                            />
                            <span className="text-xs text-slate-500">rd</span>
                            <button type="button" onClick={() => set(field, rounds + 1)} className="h-6 w-6 rounded bg-slate-800 text-sm text-slate-300 hover:bg-slate-700" aria-label={`Increase ${field.label}`}>+</button>
                        </div>
                    </div>
                )
            })}
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
        case 'conditions':
            return <Conditions {...props} />
        case 'spellslots':
            return <SpellSlots {...props} />
        case 'spellcards':
            return <SpellCards {...props} />
        case 'initiative':
            return <Initiative {...props} />
        case 'currency':
            return <CurrencyWidget {...props} />
        case 'inventory':
            return <InventoryWidget {...props} />
        case 'timers':
            return <TimersWidget {...props} />
        default:
            return <DefaultList {...props} />
    }
}
