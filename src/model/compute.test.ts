import { describe, it, expect } from 'vitest'
import { computeSheet } from './compute'
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
})
