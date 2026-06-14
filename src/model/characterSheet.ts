import { z } from 'zod'

/**
 * Slugify a label into a stable identifier usable inside formulas,
 * e.g. "Strength Mod" -> "strength_mod".
 */
export const slugify = (value: string): string =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')

export const fieldTypeSchema = z.enum(['text', 'number', 'boolean', 'computed'])
export type FieldType = z.infer<typeof fieldTypeSchema>

export const fieldSchema = z.object({
    id: z.string().min(1),
    label: z.string(),
    type: fieldTypeSchema,
    /** Raw value for text/number/boolean; formula expression for computed. */
    value: z.string(),
    /** Optional on-hover description / rules reminder. */
    description: z.string().default(''),
})

export const layoutSchema = z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
})

export const sectionSchema = z.object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string().default(''),
    accent: z.string().default('#8b5cf6'),
    fields: z.array(fieldSchema).default([]),
    layout: layoutSchema,
})

export const characterSheetSchema = z.object({
    id: z.string().min(1),
    name: z.string(),
    sections: z.array(sectionSchema),
})

export type CharacterField = z.infer<typeof fieldSchema>
export type SectionLayout = z.infer<typeof layoutSchema>
export type CharacterSection = z.infer<typeof sectionSchema>
export type CharacterSheet = z.infer<typeof characterSheetSchema>

const uid = (): string => crypto.randomUUID()

const ACCENTS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899']

export const accentForIndex = (index: number): string => ACCENTS[index % ACCENTS.length]

export const createField = (overrides: Partial<CharacterField> = {}): CharacterField => ({
    id: uid(),
    label: 'New Field',
    type: 'text',
    value: '',
    description: '',
    ...overrides,
})

/** Default layout placing a new card in a loose cascading grid. */
export const defaultLayout = (index: number): SectionLayout => ({
    x: 24 + (index % 3) * 312,
    y: 24 + Math.floor(index / 3) * 260,
    w: 288,
    h: 240,
})

export const createSection = (
    index: number,
    overrides: Partial<CharacterSection> = {},
): CharacterSection => ({
    id: uid(),
    title: `Section ${index + 1}`,
    description: '',
    accent: accentForIndex(index),
    fields: [],
    layout: defaultLayout(index),
    ...overrides,
})

export const createStarterSheet = (): CharacterSheet => ({
    id: uid(),
    name: 'New Character',
    sections: [
        createSection(0, {
            title: 'Ability Scores',
            description: 'Core ability scores. Modifiers below compute automatically.',
            fields: [
                createField({ label: 'STR', type: 'number', value: '10' }),
                createField({ label: 'DEX', type: 'number', value: '14' }),
                createField({ label: 'CON', type: 'number', value: '12' }),
                createField({ label: 'INT', type: 'number', value: '10' }),
                createField({ label: 'WIS', type: 'number', value: '13' }),
                createField({ label: 'CHA', type: 'number', value: '8' }),
            ],
            layout: { x: 24, y: 24, w: 300, h: 340 },
        }),
        createSection(1, {
            title: 'Modifiers',
            description: 'Derived from ability scores: floor((score - 10) / 2).',
            fields: [
                createField({
                    label: 'STR Mod',
                    type: 'computed',
                    value: 'floor((str - 10) / 2)',
                    description: 'Strength modifier.',
                }),
                createField({
                    label: 'DEX Mod',
                    type: 'computed',
                    value: 'floor((dex - 10) / 2)',
                    description: 'Dexterity modifier.',
                }),
                createField({
                    label: 'Proficiency',
                    type: 'number',
                    value: '2',
                    description: 'Proficiency bonus scales with level.',
                }),
            ],
            layout: { x: 336, y: 24, w: 300, h: 340 },
        }),
        createSection(2, {
            title: 'Combat',
            description: 'Quick reference for the heat of battle.',
            fields: [
                createField({ label: 'AC', type: 'number', value: '15' }),
                createField({ label: 'Max HP', type: 'number', value: '24' }),
                createField({ label: 'Current HP', type: 'number', value: '24' }),
                createField({
                    label: 'Initiative',
                    type: 'computed',
                    value: 'floor((dex - 10) / 2)',
                    description: 'Initiative = DEX modifier.',
                }),
            ],
            layout: { x: 648, y: 24, w: 300, h: 340 },
        }),
    ],
})

