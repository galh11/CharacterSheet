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

export const fieldTypeSchema = z.enum([
    'text',
    'number',
    'boolean',
    'computed',
    'counter',
    'resource',
])
export type FieldType = z.infer<typeof fieldTypeSchema>

/** How an effect changes its target. `add`/`sub`/`set` are numeric and fold into
 *  the compute scope; the rest are annotation-only tags (advantage, resistances,
 *  or a freeform note) surfaced next to the target without touching arithmetic. */
export const effectOpSchema = z.enum([
    'add',
    'sub',
    'set',
    'advantage',
    'disadvantage',
    'resist',
    'immune',
    'vulnerable',
    'note',
])
export type EffectOp = z.infer<typeof effectOpSchema>

export const NUMERIC_EFFECT_OPS: readonly EffectOp[] = ['add', 'sub', 'set']

/** A modifier one field grants to another, addressed by the target's slug. */
export const effectSchema = z.object({
    /** Slug of the field this effect modifies (e.g. `ac`, `str_mod`). */
    target: z.string().default(''),
    op: effectOpSchema.default('add'),
    /** Numeric formula for add/sub/set; freeform label/reason for tag ops. */
    value: z.string().default(''),
})
export type FieldEffect = z.infer<typeof effectSchema>

export const fieldSchema = z.object({
    id: z.string().min(1),
    label: z.string(),
    type: fieldTypeSchema,
    /** Raw value for text/number/boolean; formula for computed; count for counter/resource. */
    value: z.string(),
    /** Optional on-hover description / rules reminder. */
    description: z.string().default(''),
    /** Upper bound for `resource` pips and `counter` clamping. */
    max: z.number().optional(),
    /** Free-form structured extras used by specialized section renderers. */
    meta: z.record(z.string(), z.string()).optional(),
    /** Modifiers this field grants to other fields (relational effects). */
    effects: z.array(effectSchema).optional(),
    /** Whether this field's effects are currently applied. Boolean fields follow
     *  their own on/off value instead; for all others this toggles equip/active. */
    effectsActive: z.boolean().optional(),
})

export const layoutSchema = z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
})

/** How a section renders its fields. `default` is the classic label/value list. */
export const sectionKindSchema = z.enum([
    'default',
    'abilities',
    'hp',
    'skills',
    'actions',
    'hitdice',
    'conditions',
    'spellslots',
    'initiative',
    'currency',
    'inventory',
    'timers',
])
export type SectionKind = z.infer<typeof sectionKindSchema>

export const sectionSchema = z.object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string().default(''),
    accent: z.string().default('#8b5cf6'),
    kind: sectionKindSchema.default('default'),
    /** Content zoom for the whole section (text + widgets). */
    scale: z.number().default(1),
    /** When true the card is tucked away in the drawer instead of the canvas.
     *  Hidden sections still contribute their fields to computed formulas. */
    hidden: z.boolean().optional(),
    /** Free-form structured extras used by specialized section renderers. */
    meta: z.record(z.string(), z.string()).optional(),
    fields: z.array(fieldSchema).default([]),
    layout: layoutSchema,
})

/** Drop legacy standalone "deathsaves" sections, folding any recorded
 *  successes/failures into the HP section's meta. Death saves now live inside
 *  the HP tracker and surface only when Current HP hits 0, so this keeps older
 *  saves loadable without a dedicated section kind. */
const foldLegacyDeathSaves = (input: unknown): unknown => {
    if (!input || typeof input !== 'object') return input
    const sheet = input as { sections?: unknown }
    if (!Array.isArray(sheet.sections)) return input
    if (!sheet.sections.some((s) => (s as { kind?: unknown })?.kind === 'deathsaves')) return input
    let succ = 0
    let fail = 0
    for (const s of sheet.sections) {
        if ((s as { kind?: unknown })?.kind !== 'deathsaves') continue
        const fields = (s as { fields?: unknown }).fields
        if (!Array.isArray(fields)) continue
        for (const f of fields) {
            const label = String((f as { label?: unknown })?.label ?? '').toLowerCase()
            const value = Number((f as { value?: unknown })?.value) || 0
            if (label.startsWith('success')) succ = Math.max(succ, value)
            else if (label.startsWith('fail')) fail = Math.max(fail, value)
        }
    }
    const sections = sheet.sections
        .filter((s) => (s as { kind?: unknown })?.kind !== 'deathsaves')
        .map((s) => {
            if ((s as { kind?: unknown })?.kind !== 'hp' || (!succ && !fail)) return s
            const meta = { ...((s as { meta?: Record<string, string> }).meta ?? {}) }
            if (succ) meta.deathSuccesses = String(succ)
            if (fail) meta.deathFailures = String(fail)
            return { ...(s as object), meta }
        })
    return { ...sheet, sections }
}

const sheetObjectSchema = z.object({
    id: z.string().min(1),
    name: z.string(),
    sections: z.array(sectionSchema),
})

export const characterSheetSchema = z.preprocess(foldLegacyDeathSaves, sheetObjectSchema)
export type SectionLayout = z.infer<typeof layoutSchema>
export type CharacterSection = z.infer<typeof sectionSchema>
export type CharacterSheet = z.infer<typeof sheetObjectSchema>
export type CharacterField = z.infer<typeof fieldSchema>

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
    kind: 'default',
    scale: 1,
    hidden: false,
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

