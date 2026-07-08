import { describe, it, expect } from 'vitest'
import { computeSheet, interpolate } from './compute'
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

