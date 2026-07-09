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

    it('defaults section kind and accepts counter/resource fields with max and meta', () => {
        const parsed = characterSheetSchema.safeParse({
            id: 'sheet-1',
            name: 'Rich',
            sections: [
                {
                    id: 'section-1',
                    title: 'Resources',
                    layout: { x: 0, y: 0, w: 200, h: 140 },
                    fields: [
                        { id: 'f1', label: 'Moxie', type: 'resource', value: '2', max: 5 },
                        {
                            id: 'f2',
                            label: 'Athletics',
                            type: 'text',
                            value: '+11',
                            meta: { ability: 'STR', prof: 'expertise' },
                        },
                    ],
                },
            ],
        })
        expect(parsed.success).toBe(true)
        if (parsed.success) {
            expect(parsed.data.sections[0].kind).toBe('default')
            expect(parsed.data.sections[0].fields[0].max).toBe(5)
            expect(parsed.data.sections[0].fields[1].meta?.ability).toBe('STR')
        }
    })

    it('migrates a legacy meta.extra attack into an action toggle', () => {
        const parsed = characterSheetSchema.safeParse({
            id: 'sheet-1',
            name: 'Legacy',
            sections: [
                {
                    id: 'section-1',
                    title: 'Attacks',
                    kind: 'actions',
                    layout: { x: 0, y: 0, w: 200, h: 140 },
                    fields: [
                        {
                            id: 'f1',
                            label: 'Handaxe',
                            type: 'text',
                            value: '',
                            meta: { damage: '1d6', type: 'slashing', extra: '2d6', extraType: 'fire', extraLabel: 'Flame Tongue', extraWhen: 'flame' },
                        },
                    ],
                },
            ],
        })
        expect(parsed.success).toBe(true)
        if (parsed.success) {
            const field = parsed.data.sections[0].fields[0]
            // The stale extra* meta keys are dropped in favour of a toggle.
            expect(field.meta?.extra).toBeUndefined()
            expect(field.meta?.extraWhen).toBeUndefined()
            expect(field.meta?.damage).toBe('1d6')
            expect(field.toggles).toHaveLength(1)
            expect(field.toggles?.[0]).toMatchObject({
                label: 'Flame Tongue',
                active: false,
                damageMode: 'add',
                damage: '2d6',
                type: 'fire',
            })
        }
    })

    it('accepts action fields with explicit toggles', () => {
        const parsed = characterSheetSchema.safeParse({
            id: 'sheet-1',
            name: 'Toggled',
            sections: [
                {
                    id: 'section-1',
                    title: 'Attacks',
                    kind: 'actions',
                    layout: { x: 0, y: 0, w: 200, h: 140 },
                    fields: [
                        {
                            id: 'f1',
                            label: 'Quarterstaff',
                            type: 'text',
                            value: '',
                            meta: { damage: '1d6+{str_mod}', type: 'bludgeoning' },
                            toggles: [
                                { id: 't1', label: 'Shillelagh', active: true, hitMode: 'replace', hit: '+{wis_mod + proficiency}', damageMode: 'replace', damage: '1d8+{wis_mod}', type: 'bludgeoning' },
                            ],
                        },
                    ],
                },
            ],
        })
        expect(parsed.success).toBe(true)
        if (parsed.success) {
            expect(parsed.data.sections[0].fields[0].toggles?.[0].damageMode).toBe('replace')
        }
    })
})
