import { describe, it, expect } from 'vitest'
import { computeSheet, resolveSheet, resolveFieldMax, evalModifier, interpolate, listReferences, listResourceReferences } from './compute'
import { createField, createSection, type CharacterSheet } from './characterSheet'

// Builds a minimal sheet: one number field and one computed field that
// references it, to prove computed fields resolve against other fields.
const makeSheet = (): { sheet: CharacterSheet; modId: string } => {
    const str = createField({ label: 'STR', type: 'number', value: '16' })
    const mod = createField({
        label: 'STR Mod',
        type: 'computed',
        value: 'floor((str - 10) / 2)',
    })
    const sheet: CharacterSheet = {
        id: 'test-sheet',
        name: 'Test',
        sections: [createSection(0, { fields: [str, mod] })],
    }
    return { sheet, modId: mod.id }
}

describe('computeSheet', () => {
    it('resolves a computed field from another field', () => {
        const { sheet, modId } = makeSheet()
        const results = computeSheet(sheet)
        const mod = results.get(modId)
        expect(mod?.ok).toBe(true)
        expect(mod?.value).toBe(3)
    })

    it('resolves an ability modifier from an explicit computed field', () => {
        const str = createField({ label: 'STR', type: 'number', value: '20' })
        const strMod = createField({ label: 'STR Mod', type: 'computed', value: 'floor((str - 10) / 2)' })
        const ac = createField({ label: 'AC', type: 'computed', value: '12 + str_mod' })
        const sheet: CharacterSheet = {
            id: 's',
            name: 'T',
            sections: [
                createSection(0, { kind: 'abilities', fields: [str, strMod] }),
                createSection(1, { fields: [ac] }),
            ],
        }
        const results = computeSheet(sheet)
        // str_mod = floor((20-10)/2) = 5, so AC = 17.
        expect(results.get(strMod.id)?.value).toBe(5)
        expect(results.get(ac.id)?.value).toBe(17)
    })
})

describe('resolveSheet effects', () => {
    it('folds an active numeric effect into a computed target and attributes it', () => {
        const ac = createField({ label: 'AC', type: 'computed', value: '12' })
        const ring = createField({
            label: 'Ring of Protection',
            type: 'text',
            value: 'worn',
            effects: [{ target: 'ac', op: 'add', value: '1' }],
        })
        const sheet: CharacterSheet = {
            id: 's',
            name: 'T',
            sections: [createSection(0, { fields: [ac, ring] })],
        }
        const { results, contributions } = resolveSheet(sheet)
        expect(results.get(ac.id)?.value).toBe(13)
        const acContribs = contributions.get('ac')
        expect(acContribs).toHaveLength(1)
        expect(acContribs?.[0]).toMatchObject({ amount: 1, sourceLabel: 'Ring of Protection' })
    })

    it('ignores an effect whose source is turned off', () => {
        const ac = createField({ label: 'AC', type: 'computed', value: '12' })
        const ring = createField({
            label: 'Ring of Protection',
            type: 'text',
            value: 'worn',
            effectsActive: false,
            effects: [{ target: 'ac', op: 'add', value: '1' }],
        })
        const sheet: CharacterSheet = {
            id: 's',
            name: 'T',
            sections: [createSection(0, { fields: [ac, ring] })],
        }
        const { results, contributions } = resolveSheet(sheet)
        expect(results.get(ac.id)?.value).toBe(12)
        expect(contributions.get('ac')).toBeUndefined()
    })

    it('applies a boolean-gated effect only while the flag is on', () => {
        const save = createField({ label: 'WIS Save', type: 'computed', value: '2' })
        const bless = createField({
            label: 'Bless',
            type: 'boolean',
            value: 'false',
            effects: [{ target: 'wis_save', op: 'add', value: '2' }],
        })
        const sheet: CharacterSheet = {
            id: 's',
            name: 'T',
            sections: [createSection(0, { fields: [save, bless] })],
        }
        expect(resolveSheet(sheet).results.get(save.id)?.value).toBe(2)
        bless.value = 'true'
        expect(resolveSheet(sheet).results.get(save.id)?.value).toBe(4)
    })

    it('collects non-numeric effects as tags', () => {
        const save = createField({ label: 'DEX Save', type: 'computed', value: '1' })
        const spell = createField({
            label: 'Shield of Faith',
            type: 'boolean',
            value: 'true',
            effects: [{ target: 'dex_save', op: 'advantage', value: 'vs traps' }],
        })
        const sheet: CharacterSheet = {
            id: 's',
            name: 'T',
            sections: [createSection(0, { fields: [save, spell] })],
        }
        const { tags } = resolveSheet(sheet)
        expect(tags.get('dex_save')?.[0]).toMatchObject({ op: 'advantage', sourceLabel: 'Shield of Faith' })
    })
})

describe('resolveFieldMax', () => {
    const scope = { wis_mod: 4, proficiency: 3, level: 8 }

    it('returns the static max when no formula is set', () => {
        const field = createField({ label: 'Moxie', type: 'resource', value: '2', max: 5 })
        expect(resolveFieldMax(field, scope)).toBe(5)
    })

    it('resolves a formula max against the scope', () => {
        const field = createField({ label: 'Moonlight Step', type: 'resource', value: '1', maxFormula: '{wis_mod}' })
        expect(resolveFieldMax(field, scope)).toBe(4)
    })

    it('lets the formula override the static max', () => {
        const field = createField({ label: 'Tumble', type: 'resource', value: '1', max: 99, maxFormula: 'proficiency' })
        expect(resolveFieldMax(field, scope)).toBe(3)
    })

    it('rounds and floors a fractional/negative formula result', () => {
        const field = createField({ label: 'Odd', type: 'resource', value: '0', maxFormula: '(level - 10) / 2' })
        // (8 - 10) / 2 = -1 -> clamped to 0
        expect(resolveFieldMax(field, scope)).toBe(0)
    })

    it('falls back to the static max when the formula is unresolvable', () => {
        const field = createField({ label: 'Bad', type: 'resource', value: '0', max: 2, maxFormula: '{nope +' })
        expect(resolveFieldMax(field, scope)).toBe(2)
    })

    it('returns undefined when neither max nor a valid formula yields a number', () => {
        const field = createField({ label: 'None', type: 'resource', value: '0' })
        expect(resolveFieldMax(field, scope)).toBeUndefined()
    })
})

describe('evalModifier', () => {
    const scope = { dex_mod: 3, proficiency: 3 }

    it('resolves a bare formula reference to a signed integer', () => {
        expect(evalModifier('dex_mod + 2', scope)).toBe(5)
    })

    it('resolves a {expr}-braced reference', () => {
        expect(evalModifier('{dex_mod}', { dex_mod: -1 })).toBe(-1)
    })

    it('handles a plain signed number', () => {
        expect(evalModifier('+2', {})).toBe(2)
        expect(evalModifier('-1', {})).toBe(-1)
    })

    it('falls back to the first signed integer for legacy noise', () => {
        expect(evalModifier('+3 to hit', {})).toBe(3)
    })

    it('returns 0 for empty or unresolvable input', () => {
        expect(evalModifier('', scope)).toBe(0)
        expect(evalModifier(undefined, scope)).toBe(0)
        expect(evalModifier('nope', scope)).toBe(0)
    })
})

describe('interpolate', () => {
    const scope = { str_mod: 5, proficiency: 3, dex_mod: -1 }

    it('replaces {expr} with the computed value', () => {
        expect(interpolate('+{str_mod + proficiency}', scope)).toBe('+8')
        expect(interpolate('1d10+{str_mod}', scope)).toBe('1d10+5')
    })

    it('collapses sign artifacts from negative results', () => {
        expect(interpolate('1d6+{dex_mod}', scope)).toBe('1d6-1')
        expect(interpolate('+{dex_mod}', scope)).toBe('-1')
    })

    it('leaves plain strings and unresolved expressions untouched', () => {
        expect(interpolate('1d8+3', scope)).toBe('1d8+3')
        expect(interpolate('{nope + }', scope)).toBe('{nope + }')
    })
})

describe('listReferences', () => {
    it('tags each reference with its field kind and section', () => {
        const sheet: CharacterSheet = {
            id: 's',
            name: 'T',
            sections: [
                createSection(0, {
                    title: 'Abilities',
                    fields: [createField({ label: 'CON Score', type: 'number', value: '14' })],
                }),
                createSection(1, {
                    title: 'Conditions',
                    fields: [createField({ label: 'Bloodied', type: 'boolean', value: 'false' })],
                }),
            ],
        }
        const refs = listReferences(sheet, computeSheet(sheet))
        expect(refs.find((r) => r.slug === 'con_score')).toMatchObject({ kind: 'number', section: 'Abilities' })
        expect(refs.find((r) => r.slug === 'bloodied')).toMatchObject({ kind: 'boolean', section: 'Conditions' })
    })
})

describe('listResourceReferences', () => {
    it('lists only resource/counter fields with their current count', () => {
        const sheet: CharacterSheet = {
            id: 's',
            name: 'T',
            sections: [
                createSection(0, {
                    title: 'Combat',
                    fields: [
                        createField({ label: 'AC', type: 'number', value: '15' }),
                        createField({ label: 'Moxie Points', type: 'resource', value: '3', max: 5 }),
                        createField({ label: 'Rage Uses', type: 'counter', value: '2' }),
                    ],
                }),
            ],
        }
        const refs = listResourceReferences(sheet)
        expect(refs.map((r) => r.slug)).toEqual(['moxie_points', 'rage_uses'])
        expect(refs.find((r) => r.slug === 'moxie_points')).toMatchObject({ value: 3, kind: 'resource' })
        expect(refs.some((r) => r.slug === 'ac')).toBe(false)
    })
})

