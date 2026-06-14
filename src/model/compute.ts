import type { CharacterSheet, CharacterField } from './characterSheet'
import { slugify } from './characterSheet'
import { evaluateFormula, type FormulaResult } from './formula'

/**
 * Build a numeric scope from all non-computed fields, keyed by slug.
 * number fields contribute their numeric value; boolean -> 1/0.
 */
const baseScope = (sheet: CharacterSheet): Record<string, number> => {
    const scope: Record<string, number> = {}
    for (const section of sheet.sections) {
        for (const field of section.fields) {
            const slug = slugify(field.label)
            if (!slug) continue
            if (field.type === 'number') {
                const n = Number(field.value)
                if (!Number.isNaN(n)) scope[slug] = n
            } else if (field.type === 'boolean') {
                scope[slug] = field.value === 'true' ? 1 : 0
            }
        }
    }
    return scope
}

/**
 * Resolve every computed field by iterating until values stabilize.
 * Supports computed fields that reference other computed fields (a few passes).
 * Returns a map of field id -> result.
 */
export const computeSheet = (sheet: CharacterSheet): Map<string, FormulaResult> => {
    const results = new Map<string, FormulaResult>()
    const scope = baseScope(sheet)

    const computedFields: CharacterField[] = []
    for (const section of sheet.sections) {
        for (const field of section.fields) {
            if (field.type === 'computed') computedFields.push(field)
        }
    }

    // Iterate a bounded number of passes so computed-on-computed resolves.
    const maxPasses = Math.min(computedFields.length + 1, 25)
    for (let pass = 0; pass < maxPasses; pass++) {
        let changed = false
        for (const field of computedFields) {
            const result = evaluateFormula(field.value, scope)
            const previous = results.get(field.id)
            results.set(field.id, result)
            if (result.ok && result.value !== null) {
                const slug = slugify(field.label)
                if (slug && scope[slug] !== result.value) {
                    scope[slug] = result.value
                    changed = true
                }
            }
            if (!previous || previous.value !== result.value || previous.ok !== result.ok) {
                changed = true
            }
        }
        if (!changed) break
    }

    return results
}
