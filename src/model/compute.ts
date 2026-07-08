import type { CharacterSheet, CharacterField, EffectOp } from './characterSheet'
import { slugify, NUMERIC_EFFECT_OPS } from './characterSheet'
import { evaluateFormula, type FormulaResult } from './formula'

/**
 * Replace `{expression}` placeholders in a string with their computed value,
 * evaluated against the numeric scope. Used so action to-hit and damage can be
 * derived from ability modifiers and proficiency instead of being hand-typed,
 * e.g. "+{str_mod + proficiency}" or "1d10+{str_mod}". Unresolvable expressions
 * are left untouched so the mistake is visible.
 */
export const interpolate = (input: string, scope: Record<string, number>): string => {
    if (!input || !input.includes('{')) return input
    return input
        .replace(/\{([^}]*)\}/g, (match, expr: string) => {
            const r = evaluateFormula(expr, scope)
            return r.ok && r.value !== null ? String(Math.round(r.value)) : match
        })
        .replace(/\+-/g, '-')
        .replace(/-\+/g, '-')
}

/** A single numeric modifier one field grants to a target slug. */
export interface Contribution {
    sourceId: string
    sourceLabel: string
    op: EffectOp
    /** Signed amount for add/sub; the raw value for set. */
    amount: number
    /** Original formula/text, for display. */
    value: string
}

/** A non-numeric annotation (advantage, resistance, note…) on a target slug. */
export interface EffectTag {
    sourceId: string
    sourceLabel: string
    op: EffectOp
    value: string
}

export interface ResolvedSheet {
    results: Map<string, FormulaResult>
    scope: Record<string, number>
    /** Target slug -> numeric contributions folded into that slug's value. */
    contributions: Map<string, Contribution[]>
    /** Target slug -> annotation tags shown beside that field. */
    tags: Map<string, EffectTag[]>
}

/** A field's effects apply when it's active: boolean fields follow their own
 *  on/off value; everything else is active unless explicitly turned off. */
const effectsAreActive = (field: CharacterField): boolean =>
    field.type === 'boolean' ? field.value === 'true' : field.effectsActive !== false

const pushMap = <T>(map: Map<string, T[]>, key: string, value: T): void => {
    const list = map.get(key)
    if (list) list.push(value)
    else map.set(key, [value])
}

/**
 * Resolve computed fields and relational effects together. Numeric effects
 * (add/sub/set) fold into the target slug's value so computed results and the
 * scope reflect every active buff; non-numeric effects are collected as tags for
 * display. Iterates until values stabilize so effects-on-computed converge.
 */
export const resolveSheet = (sheet: CharacterSheet): ResolvedSheet => {
    const results = new Map<string, FormulaResult>()
    const raw: Record<string, number> = {}
    const computedFields: CharacterField[] = []
    const computedSlugs = new Set<string>()
    const sources: CharacterField[] = []

    for (const section of sheet.sections) {
        for (const field of section.fields) {
            const slug = slugify(field.label)
            if (slug) {
                if (field.type === 'number') {
                    const n = Number(field.value)
                    if (!Number.isNaN(n)) raw[slug] = n
                } else if (field.type === 'boolean') {
                    raw[slug] = field.value === 'true' ? 1 : 0
                }
            }
            if (field.type === 'computed') {
                computedFields.push(field)
                if (slug) computedSlugs.add(slug)
            }
            if (field.effects && field.effects.length > 0 && effectsAreActive(field)) {
                sources.push(field)
            }
        }
    }

    // Non-numeric tags are static (they don't depend on the numeric scope).
    const tags = new Map<string, EffectTag[]>()
    for (const source of sources) {
        for (const effect of source.effects ?? []) {
            if (NUMERIC_EFFECT_OPS.includes(effect.op) || !effect.target) continue
            pushMap(tags, effect.target, {
                sourceId: source.id,
                sourceLabel: source.label,
                op: effect.op,
                value: effect.value,
            })
        }
    }

    const scope: Record<string, number> = { ...raw }
    let contributions = new Map<string, Contribution[]>()

    const maxPasses = Math.min(computedFields.length + sources.length + 2, 40)
    for (let pass = 0; pass < maxPasses; pass++) {
        let changed = false
        const contrib = new Map<string, Contribution[]>()
        const adds: Record<string, number> = {}
        const setVal: Record<string, number> = {}

        for (const source of sources) {
            for (const effect of source.effects ?? []) {
                if (!NUMERIC_EFFECT_OPS.includes(effect.op) || !effect.target) continue
                const r = evaluateFormula(effect.value || '0', scope)
                const amt = r.ok && r.value !== null ? r.value : 0
                const signedAmt = effect.op === 'sub' ? -amt : amt
                if (effect.op === 'set') setVal[effect.target] = amt
                else adds[effect.target] = (adds[effect.target] ?? 0) + signedAmt
                pushMap(contrib, effect.target, {
                    sourceId: source.id,
                    sourceLabel: source.label,
                    op: effect.op,
                    amount: effect.op === 'set' ? amt : signedAmt,
                    value: effect.value,
                })
            }
        }

        // Computed fields: evaluate the formula, then fold in contributions.
        for (const field of computedFields) {
            const base = evaluateFormula(field.value, scope)
            const slug = slugify(field.label)
            if (base.ok && base.value !== null) {
                const effective = (slug in setVal ? setVal[slug] : base.value) + (slug in adds ? adds[slug] : 0)
                results.set(field.id, { ...base, value: effective })
                if (slug && scope[slug] !== effective) {
                    scope[slug] = effective
                    changed = true
                }
            } else {
                results.set(field.id, base)
            }
        }

        // Number/boolean and virtual (field-less) targets.
        for (const target of new Set([...Object.keys(adds), ...Object.keys(setVal)])) {
            if (computedSlugs.has(target)) continue
            const base = target in setVal ? setVal[target] : (raw[target] ?? 0)
            const effective = base + (target in adds ? adds[target] : 0)
            if (scope[target] !== effective) {
                scope[target] = effective
                changed = true
            }
        }

        contributions = contrib
        if (!changed && pass > 0) break
    }

    return { results, scope, contributions, tags }
}

/**
 * Resolve every computed field to a result map. Thin wrapper over resolveSheet
 * for callers that only need the per-field results (and back-compat with tests).
 */
export const computeSheet = (sheet: CharacterSheet): Map<string, FormulaResult> =>
    resolveSheet(sheet).results

export interface FieldReference {
    slug: string
    label: string
    value: number
}

/**
 * List the field identifiers available to formulas, with their current numeric
 * value. Useful for showing an autocomplete-style hint in the editor.
 */
export const listReferences = (
    sheet: CharacterSheet,
    results: Map<string, FormulaResult>,
): FieldReference[] => {
    const refs: FieldReference[] = []
    const seen = new Set<string>()
    for (const section of sheet.sections) {
        for (const field of section.fields) {
            const slug = slugify(field.label)
            if (!slug || seen.has(slug)) continue
            let value: number | null = null
            if (field.type === 'number') {
                const n = Number(field.value)
                value = Number.isNaN(n) ? null : n
            } else if (field.type === 'boolean') {
                value = field.value === 'true' ? 1 : 0
            } else if (field.type === 'computed') {
                const result = results.get(field.id)
                value = result?.ok ? result.value : null
            }
            if (value === null) continue
            seen.add(slug)
            refs.push({ slug, label: field.label, value })
        }
    }
    return refs.sort((a, b) => a.slug.localeCompare(b.slug))
}
