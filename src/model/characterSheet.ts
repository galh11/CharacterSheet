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

/** Whether a toggle adds to the base value or replaces it entirely. */
export const toggleModeSchema = z.enum(['add', 'replace'])
export type ToggleMode = z.infer<typeof toggleModeSchema>

/** One typed damage entry a toggle contributes while active. `add` appends it as
 *  an extra damage part; `replace` swaps the weapon's base damage. A toggle can
 *  carry several of these, so a single "bonus action" can e.g. add both cold and
 *  radiant damage at once. */
export const toggleDamagePartSchema = z.object({
    mode: toggleModeSchema.default('add'),
    /** Dice/formula for this part, e.g. `2d6` or `1d8+{wis_mod}`. */
    damage: z.string().default(''),
    /** Damage type for this part, e.g. `fire`. */
    type: z.string().default(''),
})
export type ToggleDamagePart = z.infer<typeof toggleDamagePartSchema>

/**
 * An activatable modifier on an action field (a weapon/attack). Each toggle is a
 * named on/off switch shown in the action card; an action can have as many as you
 * like (e.g. a Flame Tongue that *adds* 2d6 fire, or a Shillelagh that *replaces*
 * the damage die and to-hit ability). While active it reshapes the action's
 * attack roll and damage: it can adjust the to-hit, contribute several typed
 * damage `parts` (add or replace), and optionally recolour the whole attack to a
 * single damage type via `setType` (e.g. True Strike making everything radiant).
 * Values support `{expr}` interpolation like the action's own meta, so they can
 * reference ability mods, proficiency, etc.
 */
export const actionToggleSchema = z.object({
    id: z.string().min(1),
    /** Name shown on the toggle button, e.g. "Shillelagh". */
    label: z.string().default(''),
    /** Whether the toggle is currently on. Only used when `field` is empty;
     *  otherwise the linked boolean field is the source of truth. */
    active: z.boolean().default(false),
    /** Optional slug of a boolean field this toggle is bound to. When set, the
     *  toggle's on/off state *is* that field's value, so the weapon's toggle, a
     *  bonus-action card, and a Conditions chip can all drive the same activation
     *  and stay in sync — clicking any of them flips the shared boolean. When
     *  empty/absent the toggle keeps its own local `active` state. */
    field: z.string().optional(),
    /** To-hit change: `add` adds this to the attack modifier, `replace` overrides it. */
    hitMode: toggleModeSchema.default('add'),
    hit: z.string().default(''),
    /** Typed damage entries this toggle contributes (add extra parts or replace the base). */
    parts: z.array(toggleDamagePartSchema).default([]),
    /** When set, overrides the damage type of the *entire* attack while active. */
    setType: z.string().default(''),
    /** Optional on-hover explanation of what the toggle does. */
    description: z.string().default(''),
})
export type ActionToggle = z.infer<typeof actionToggleSchema>

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
    /** Optional formula for a dynamic upper bound, resolved against the sheet's
     *  scope (e.g. `{wis_mod}`, `proficiency`, `2 + floor(level / 4)`). When set
     *  it overrides the static `max`, so a resource/counter cap can scale with
     *  level or ability instead of being frozen as a literal that drifts on
     *  level-up. */
    maxFormula: z.string().optional(),
    /** Free-form structured extras used by specialized section renderers. */
    meta: z.record(z.string(), z.string()).optional(),
    /** Modifiers this field grants to other fields (relational effects). */
    effects: z.array(effectSchema).optional(),
    /** Activatable modifiers for action fields (weapons/attacks): named on/off
     *  switches that add or replace the action's damage and to-hit while active. */
    toggles: z.array(actionToggleSchema).optional(),
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
    'spellcards',
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
    /** Per-view drawer membership. When a view's flag is set the card is tucked
     *  into that view's drawer scratch-pad instead of shown in the main layout;
     *  the canvas and stack drawers are independent. Drawer sections still
     *  contribute their fields to computed formulas. */
    drawer: z
        .object({
            canvas: z.boolean().optional(),
            stack: z.boolean().optional(),
        })
        .optional(),
    /** Position and size of this card inside the drawer's free-canvas scratch
     *  pad (independent of its main-canvas `layout`). */
    drawerLayout: layoutSchema.optional(),
    /** Free-form structured extras used by specialized section renderers. */
    meta: z.record(z.string(), z.string()).optional(),
    fields: z.array(fieldSchema).default([]),
    layout: layoutSchema,
})

const uid = (): string => crypto.randomUUID()

/** Drop legacy standalone "deathsaves" sections, folding any recorded
 *  successes/failures into the HP section's meta. Death saves now live inside
 *  the HP tracker and surface only when Current HP hits 0, so this keeps older
 *  saves loadable without a dedicated section kind. */
const foldLegacyDeathSaves = (input: unknown): unknown => {    if (!input || typeof input !== 'object') return input
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

/** Normalize an action field's toggles: migrate the legacy single "extra damage"
 *  attack (meta.extra / extraType / extraWhen / extraLabel) into a toggle, and
 *  fold any older single-`damage` toggle shape into the `parts` list. Keeps old
 *  saved sheets working while every activatable modifier lives in one repeatable
 *  list of typed damage parts. */
const foldLegacyActionExtras = (input: unknown): unknown => {
    if (!input || typeof input !== 'object') return input
    const sheet = input as { sections?: unknown }
    if (!Array.isArray(sheet.sections)) return input
    const humanize = (slug: string): string =>
        slug.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    /** Upgrade a raw toggle from the single-damage shape to the `parts` shape. */
    const migrateToggle = (raw: unknown): unknown => {
        if (!raw || typeof raw !== 'object') return raw
        const t = raw as Record<string, unknown>
        if (Array.isArray(t.parts)) return raw
        const parts: { mode: string; damage: string; type: string }[] = []
        if (typeof t.damage === 'string' && t.damage) {
            parts.push({ mode: t.damageMode === 'replace' ? 'replace' : 'add', damage: t.damage, type: typeof t.type === 'string' ? t.type : '' })
        }
        const setType = !t.damage && typeof t.type === 'string' ? t.type : ''
        const next: Record<string, unknown> = { ...t, parts }
        if (setType) next.setType = setType
        delete next.damage
        delete next.damageMode
        delete next.type
        return next
    }
    let touched = false
    const sections = sheet.sections.map((s) => {
        const fields = (s as { fields?: unknown }).fields
        if (!Array.isArray(fields)) return s
        let sectionTouched = false
        const nextFields = fields.map((f) => {
            const field = f as { meta?: Record<string, string>; toggles?: unknown[] }
            const meta = field.meta
            const hasExtra = meta && typeof meta === 'object' && meta.extra && !(Array.isArray(field.toggles) && field.toggles.length > 0)
            const hasLegacyToggle = Array.isArray(field.toggles) && field.toggles.some((t) => t && typeof t === 'object' && !Array.isArray((t as Record<string, unknown>).parts))
            if (!hasExtra && !hasLegacyToggle) return f
            sectionTouched = true
            let toggles = Array.isArray(field.toggles) ? field.toggles.map(migrateToggle) : []
            let restMeta = meta
            if (hasExtra && meta) {
                const label = meta.extraLabel || (meta.extraWhen ? humanize(meta.extraWhen) : 'Extra damage')
                toggles = [
                    ...toggles,
                    {
                        id: uid(),
                        label,
                        active: false,
                        // Preserve the old boolean gate: an extra that was gated on
                        // `extraWhen` becomes a toggle bound to that same field, so it
                        // keeps syncing with the condition instead of a dead local switch.
                        field: meta.extraWhen ?? '',
                        hitMode: 'add',
                        hit: '',
                        parts: [{ mode: 'add', damage: meta.extra, type: meta.extraType ?? '' }],
                        setType: '',
                        description: '',
                    },
                ]
                restMeta = { ...meta }
                delete restMeta.extra
                delete restMeta.extraType
                delete restMeta.extraWhen
                delete restMeta.extraLabel
            }
            return { ...(field as object), meta: restMeta, toggles }
        })
        if (!sectionTouched) return s
        touched = true
        return { ...(s as object), fields: nextFields }
    })
    return touched ? { ...sheet, sections } : input
}

/** Migrate the legacy single `hidden` flag (a drawer shared by every view) to
 *  the per-view `drawer` shape, tucking the card into both the canvas and stack
 *  drawers so older sheets keep their tucked-away sections. */
const foldLegacyHidden = (input: unknown): unknown => {
    if (!input || typeof input !== 'object') return input
    const sheet = input as { sections?: unknown }
    if (!Array.isArray(sheet.sections)) return input
    if (!sheet.sections.some((s) => (s as { hidden?: unknown })?.hidden === true)) return input
    const sections = sheet.sections.map((s) => {
        const section = s as { hidden?: unknown }
        if (section.hidden !== true) return s
        const rest = { ...(s as object) } as Record<string, unknown>
        delete rest.hidden
        rest.drawer = { canvas: true, stack: true }
        return rest
    })
    return { ...sheet, sections }
}

const foldLegacy = (input: unknown): unknown =>
    foldLegacyActionExtras(foldLegacyDeathSaves(foldLegacyHidden(input)))

/** How a critical hit's damage is rolled. `double-dice` (RAW) rolls twice the
 *  dice; `max-plus-roll` maximizes the normal dice and adds a rolled set on top
 *  (a common house rule). Flat modifiers are added once either way. */
export const critModeSchema = z.enum(['double-dice', 'max-plus-roll'])
export type CritMode = z.infer<typeof critModeSchema>

export const DEFAULT_CRIT_MODE: CritMode = 'double-dice'

/** Per-sheet house-rule settings, edited in the "Game Mechanics" pane. */
export const rulesSchema = z.object({
    critMode: critModeSchema.default(DEFAULT_CRIT_MODE),
})
export type SheetRules = z.infer<typeof rulesSchema>

const sheetObjectSchema = z.object({
    id: z.string().min(1),
    name: z.string(),
    /** Optional character portrait as an image data URL, shown in the top bar. */
    portrait: z.string().optional(),
    /** Optional per-sheet house-rule settings (crit mode, …). */
    rules: rulesSchema.optional(),
    sections: z.array(sectionSchema),
})

export const characterSheetSchema = z.preprocess(foldLegacy, sheetObjectSchema)
export type SectionLayout = z.infer<typeof layoutSchema>
export type CharacterSection = z.infer<typeof sectionSchema>
export type CharacterSheet = z.infer<typeof sheetObjectSchema>
export type CharacterField = z.infer<typeof fieldSchema>

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

