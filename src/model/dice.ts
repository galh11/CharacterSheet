/**
 * Pure dice-rolling engine. No DOM, no randomness baked in beyond an injectable
 * RNG so every roll is deterministically testable.
 */

import type { CritMode } from './characterSheet'

/** A source of randomness in the half-open range [0, 1). Defaults to Math.random. */
export type Rng = () => number

const defaultRng: Rng = Math.random

const rollOne = (sides: number, rng: Rng): number => 1 + Math.floor(rng() * sides)

export interface DiceTerm {
    /** Number of dice. Negative means the term is subtracted. */
    count: number
    sides: number
}

export interface ParsedRoll {
    dice: DiceTerm[]
    modifier: number
}

/**
 * Parse a dice expression such as "2d6+3", "1d20", "d8-1", or "1d6+1d4+2".
 * Whitespace and case are ignored. Unknown characters are skipped.
 */
export const parseRoll = (expr: string): ParsedRoll => {
    const dice: DiceTerm[] = []
    let modifier = 0
    const cleaned = (expr ?? '').toLowerCase().replace(/\s+/g, '')
    const token = /([+-]?)(\d*)d(\d+)|([+-]?\d+)/g
    let match: RegExpExecArray | null
    while ((match = token.exec(cleaned))) {
        if (match[3]) {
            const sign = match[1] === '-' ? -1 : 1
            const count = (match[2] === '' ? 1 : Number(match[2])) * sign
            dice.push({ count, sides: Number(match[3]) })
        } else if (match[4]) {
            modifier += Number(match[4])
        }
    }
    return { dice, modifier }
}

export interface RollDetail {
    sides: number
    /** The face value; negative when the die belongs to a subtracted term. */
    value: number
}

export interface RollResult {
    expr: string
    rolls: RollDetail[]
    modifier: number
    total: number
}

export const rollParsed = (parsed: ParsedRoll, rng: Rng = defaultRng): RollResult => {
    const rolls: RollDetail[] = []
    let total = parsed.modifier
    for (const term of parsed.dice) {
        const sign = term.count < 0 ? -1 : 1
        const n = Math.abs(term.count)
        for (let i = 0; i < n; i++) {
            const value = rollOne(term.sides, rng)
            rolls.push({ sides: term.sides, value: sign * value })
            total += sign * value
        }
    }
    return { expr: '', rolls, modifier: parsed.modifier, total }
}

/** Roll a full dice expression, e.g. rollExpr("2d6+3"). */
export const rollExpr = (expr: string, rng: Rng = defaultRng): RollResult => ({
    ...rollParsed(parseRoll(expr), rng),
    expr,
})

/** Extract a leading signed integer modifier from strings like "+5", "5 to hit", "-1". */
export const parseModifier = (raw?: string): number => {
    if (!raw) return 0
    const match = raw.match(/[+-]?\d+/)
    return match ? Number(match[0]) : 0
}

export type D20Mode = 'normal' | 'advantage' | 'disadvantage'

export interface D20Result {
    rolls: number[]
    natural: number
    modifier: number
    total: number
    mode: D20Mode
    crit: 'hit' | 'miss' | null
}

/** Roll a d20 with a modifier, honouring advantage/disadvantage. */
export const rollD20 = (modifier: number, mode: D20Mode = 'normal', rng: Rng = defaultRng): D20Result => {
    const one = () => rollOne(20, rng)
    let rolls: number[]
    let natural: number
    if (mode === 'normal') {
        natural = one()
        rolls = [natural]
    } else {
        const a = one()
        const b = one()
        rolls = [a, b]
        natural = mode === 'advantage' ? Math.max(a, b) : Math.min(a, b)
    }
    const crit = natural === 20 ? 'hit' : natural === 1 ? 'miss' : null
    return { rolls, natural, modifier, total: natural + modifier, mode, crit }
}

export interface D20Series {
    /** One entry per repeat: the natural d20, any bonus-die roll, and the final total. */
    results: { natural: number; bonusDie: number; total: number; crit: 'hit' | 'miss' | null }[]
    /** Highest final total across the series. */
    best: number
}

/**
 * Roll a d20 (with adv/dis) `count` times, each optionally adding a fresh
 * bonus-die roll (e.g. Bless/Guidance 1d4). Used for grouped attack rolls.
 */
export const rollD20Series = (
    modifier: number,
    mode: D20Mode = 'normal',
    count = 1,
    bonusDieSides = 0,
    rng: Rng = defaultRng,
): D20Series => {
    const results = []
    for (let i = 0; i < Math.max(1, count); i++) {
        const r = rollD20(modifier, mode, rng)
        const bonusDie = bonusDieSides > 0 ? rollOne(bonusDieSides, rng) : 0
        results.push({ natural: r.natural, bonusDie, total: r.total + bonusDie, crit: r.crit })
    }
    return { results, best: Math.max(...results.map((r) => r.total)) }
}

export interface DamagePart {
    type?: string
    result: RollResult
}

export interface DamageRoll {
    parts: DamagePart[]
    total: number
}

/** Roll one or more typed damage expressions and total them. */
export const rollDamage = (
    parts: { expr: string; type?: string }[],
    rng: Rng = defaultRng,
): DamageRoll => {
    const rolled = parts
        .filter((p) => p.expr && p.expr.trim() !== '')
        .map((p) => ({ type: p.type, result: rollExpr(p.expr, rng) }))
    return { parts: rolled, total: rolled.reduce((sum, p) => sum + p.result.total, 0) }
}

/** Double each NdM dice count in an expression (RAW crit), leaving flat bonuses. */
const doubleDice = (expr: string): string =>
    expr.replace(/(\d*)d(\d+)/gi, (_, count: string, sides: string) => `${(count === '' ? 1 : Number(count)) * 2}d${sides}`)

/**
 * Transform a damage expression for a critical hit per the chosen crit mode.
 * `double-dice` (RAW) doubles the dice counts; `max-plus-roll` keeps the normal
 * dice and adds a flat bonus equal to their maximum (so you roll once and add
 * the maximised dice). Flat modifiers are untouched either way. Callers pass an
 * already-interpolated expression (no `{expr}` left).
 */
export const critDamage = (expr: string, mode: CritMode = 'double-dice'): string => {
    if (!expr) return expr
    if (mode === 'max-plus-roll') {
        const maxExtra = parseRoll(expr).dice.reduce((sum, t) => sum + t.count * t.sides, 0)
        if (maxExtra === 0) return expr
        return maxExtra > 0 ? `${expr}+${maxExtra}` : `${expr}${maxExtra}`
    }
    return doubleDice(expr)
}

const signStr = (n: number): string => (n > 0 ? ` + ${n}` : n < 0 ? ` − ${Math.abs(n)}` : '')

/** Human-readable summary like "[4, 5] + 3 = 12". */
export const formatRoll = (r: RollResult): string => {
    const dice = r.rolls.length > 0 ? `[${r.rolls.map((d) => Math.abs(d.value)).join(', ')}]` : ''
    return `${dice}${signStr(r.modifier)} = ${r.total}`.trim()
}

export type RollKind = 'attack' | 'damage' | 'check' | 'save' | 'heal' | 'raw'

export interface RollLogEntry {
    id: string
    title: string
    detail: string
    total: number
    kind: RollKind
    crit?: 'hit' | 'miss' | null
}
