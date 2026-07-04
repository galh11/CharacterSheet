import { describe, it, expect } from 'vitest'
import {
    slugify,
    characterSheetSchema,
    createStarterSheet,
    createField,
} from './characterSheet'

describe('slugify', () => {
    it('lowercases and joins words with underscores', () => {
        expect(slugify('Strength Mod')).toBe('strength_mod')
    })

    it('collapses punctuation and trims edge underscores', () => {
        expect(slugify('  Hello, World!  ')).toBe('hello_world')
    })

    it('returns an empty string when there is nothing usable', () => {
        expect(slugify('+++')).toBe('')
    })
})

describe('characterSheetSchema', () => {
    it('validates the built-in starter sheet', () => {
        const result = characterSheetSchema.safeParse(createStarterSheet())
        expect(result.success).toBe(true)
    })

    it('applies a default description to fields that omit one', () => {
        const field = createField({ label: 'AC', type: 'number', value: '15' })
        // Simulate an imported field missing the optional description key.
        const { description: _ignored, ...withoutDescription } = field
        void _ignored
        const parsed = characterSheetSchema.safeParse({
            id: 'sheet-1',
            name: 'Test',
            sections: [
                {
                    id: 'section-1',
                    title: 'Combat',
                    layout: { x: 0, y: 0, w: 200, h: 140 },
                    fields: [withoutDescription],
                },
            ],
        })
        expect(parsed.success).toBe(true)
        if (parsed.success) {
            expect(parsed.data.sections[0].fields[0].description).toBe('')
        }
    })

    it('rejects a sheet missing required fields', () => {
        const parsed = characterSheetSchema.safeParse({ name: 'No id or sections' })
        expect(parsed.success).toBe(false)
    })
})
