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

/** How an effect changes its target. `add`/`sub`/`set`/`min`/`max` are numeric
 *  and fold into the compute scope (`min` raises the target to a floor, `max`
 *  caps it); the rest are annotation-only tags (advantage, resistances, or a
 *  freeform note) surfaced next to the target without touching arithmetic. */
export const effectOpSchema = z.enum([
    'add',
    'sub',
    'set',
    'min',
    'max',
    'advantage',
    'disadvantage',
    'resist',
    'immune',
    'vulnerable',
    'note',
])
export type EffectOp = z.infer<typeof effectOpSchema>

export const NUMERIC_EFFECT_OPS: readonly EffectOp[] = ['add', 'sub', 'set', 'min', 'max']

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

/** A fully fleshed-out sample character to greet new players: a **level 1 human
 *  paladin** (Acolyte of Torm), built to the 2024 rules (so it already has
 *  spellcasting). The sidebar hosts the ability-score tiles, the HP card and the
 *  core combat badges (AC, initiative, proficiency, speed), so the canvas isn't
 *  cluttered with a card that just repeats them. The canvas shows every section a
 *  player expects — Senses, Attacks, Spellcasting, Spell Slots, Spells, Saving
 *  Throws, Skills, class Features & Resources, Proficiencies & Languages, roleplay
 *  Personality traits, and an Equipment/coin section. Every derived value (ability
 *  modifiers, initiative, proficiency, passive scores, attacks, skill/save
 *  bonuses, the spell save DC/attack, and the Lay on Hands and Divine Sense
 *  pools) computes from the ability scores and level, so editing a score or level
 *  immediately cascades through the whole sheet. */
export const createStarterSheet = (): CharacterSheet => {
    const score = (label: string, value: number): CharacterField =>
        createField({ label, type: 'number', value: String(value) })
    const mod = (label: string, slug: string): CharacterField =>
        createField({
            label,
            type: 'computed',
            value: `floor((${slug} - 10) / 2)`,
            description: `${label.split(' ')[0]} modifier: floor((score − 10) / 2).`,
        })
    const skill = (
        label: string,
        ability: string,
        prof: 'none' | 'proficient' | 'expertise' = 'none',
    ): CharacterField =>
        createField({ label, type: 'number', value: '', meta: { ability, prof, auto: 'true' } })
    const attack = (
        label: string,
        damage: string,
        type: string,
        range: string,
        description = '',
    ): CharacterField =>
        createField({
            label,
            type: 'text',
            value: '',
            description,
            meta: { hit: '+{str_mod + proficiency}', damage, type, range },
        })
    const item = (label: string, value: string, description = ''): CharacterField =>
        createField({ label, type: 'text', value, description })
    const spell = (label: string, meta: Record<string, string>, description = ''): CharacterField =>
        createField({ label, type: 'text', value: '', description, meta })

    // Column-pack the cards into a tidy three-column grid (packing the two
    // sidebar-hosted cards last so the canvas has no gaps). Three columns keep
    // every card clear of the right-hand sidebar rail.
    const COLS = 3
    const COL_W = 300
    const GAP = 20
    const X0 = 24
    const Y0 = 24
    const bottoms = Array(COLS).fill(Y0)
    const place = (h: number): SectionLayout => {
        let c = 0
        for (let i = 1; i < COLS; i++) if (bottoms[i] < bottoms[c]) c = i
        const layout = { x: X0 + c * (COL_W + GAP), y: bottoms[c], w: COL_W, h }
        bottoms[c] = layout.y + h + GAP
        return layout
    }

    interface Spec {
        title: string
        kind?: CharacterSection['kind']
        accent: string
        description: string
        fields: CharacterField[]
        meta?: Record<string, string>
        h: number
        hidden?: boolean
    }

    const specs: Spec[] = [
        // Identity + roleplay basics.
        {
            title: 'Character',
            accent: '#8b5cf6',
            description: 'Who you are. Class, level and background drive the rest of the sheet.',
            h: 300,
            fields: [
                item('Class', 'Paladin'),
                createField({
                    label: 'Level',
                    type: 'number',
                    value: '1',
                    description: 'Character level. Proficiency, Lay on Hands and other values scale from this.',
                }),
                item('Race', 'Human'),
                item('Background', 'Acolyte', 'Grants Insight & Religion proficiency and two languages.'),
                item('Alignment', 'Lawful Good'),
                item('Faith', 'Torm, the True', 'The god of courage and self-sacrifice.'),
                createField({ label: 'Experience', type: 'number', value: '0', description: 'XP toward your next level.' }),
                createField({
                    label: 'Inspiration',
                    type: 'boolean',
                    value: 'false',
                    description: 'Spend to reroll a d20. Toggle it from the star in the sidebar.',
                }),
            ],
        },
        // Ability scores — shown as tiles in the sidebar (hidden from canvas).
        {
            title: 'Ability Scores',
            kind: 'abilities',
            accent: '#f59e0b',
            description: 'Your six core scores. Modifiers compute automatically.',
            h: 250,
            hidden: true,
            fields: [
                score('STR', 16),
                score('DEX', 10),
                score('CON', 14),
                score('INT', 8),
                score('WIS', 12),
                score('CHA', 15),
                mod('STR Mod', 'str'),
                mod('DEX Mod', 'dex'),
                mod('CON Mod', 'con'),
                mod('INT Mod', 'int'),
                mod('WIS Mod', 'wis'),
                mod('CHA Mod', 'cha'),
            ],
        },
        // Hit points — the full HP card in the sidebar (hidden from canvas). It
        // also carries the core combat numbers (AC, initiative, proficiency,
        // speed): the sidebar reads them as read-only badges, so keeping the
        // fields here feeds those badges without a redundant on-canvas card.
        {
            title: 'Hit Points',
            kind: 'hp',
            accent: '#10b981',
            description: 'Track current, max and temporary hit points.',
            h: 240,
            hidden: true,
            fields: [
                createField({ label: 'Current HP', type: 'number', value: '12', description: 'Level 1 paladin: d10 (10) + CON modifier.' }),
                createField({ label: 'Max HP', type: 'number', value: '12' }),
                createField({ label: 'Temp HP', type: 'number', value: '0' }),
                createField({ label: 'Hit Dice (d10)', type: 'resource', value: '1', max: 1, meta: { die: 'd10', recharge: 'long' } }),
                // Core combat stats — surfaced by the sidebar badges (AC / Init /
                // Prof / Speed); the HP widget ignores these labels so they don't
                // render here. Edit them from this section's field editor.
                createField({
                    label: 'AC',
                    type: 'number',
                    value: '18',
                    description: 'Chain mail (16) + shield (2). Chain mail sets AC to 16 regardless of DEX.',
                }),
                createField({ label: 'Initiative', type: 'computed', value: 'dex_mod', description: 'Initiative bonus = DEX modifier.' }),
                createField({
                    label: 'Proficiency',
                    type: 'computed',
                    value: 'floor((level - 1) / 4) + 2',
                    description: 'Proficiency bonus, derived from your level.',
                }),
                createField({ label: 'Speed', type: 'number', value: '30', description: 'Walking speed in feet.' }),
            ],
        },
        // Senses — the passive scores the sidebar doesn't show.
        {
            title: 'Senses',
            accent: '#ef4444',
            description: 'Your passive scores (used when you aren’t actively rolling).',
            h: 170,
            fields: [
                createField({
                    label: 'Passive Perception',
                    type: 'computed',
                    value: '10 + wis_mod',
                    description: 'Passive Perception = 10 + WIS modifier (Perception isn’t trained).',
                }),
                createField({
                    label: 'Passive Insight',
                    type: 'computed',
                    value: '10 + wis_mod + proficiency',
                    description: 'Passive Insight = 10 + WIS modifier + proficiency (Insight is trained via Acolyte).',
                }),
            ],
        },
        // Attacks — to-hit and damage derive from STR mod + proficiency.
        {
            title: 'Attacks',
            kind: 'actions',
            accent: '#f59e0b',
            description: 'Click 🎲 to roll to-hit or damage. Bonuses derive from your scores.',
            h: 220,
            fields: [
                attack('Longsword', '1d8+{str_mod}', 'slashing', '5 ft', 'Versatile — deal 1d10 when wielded in two hands.'),
                attack('Javelin', '1d6+{str_mod}', 'piercing', '30/120', 'Thrown weapon.'),
            ],
        },
        // Spellcasting summary — save DC and attack derive from CHA + proficiency.
        {
            title: 'Spellcasting',
            accent: '#8b5cf6',
            description: 'Paladins cast with Charisma. These update as you level.',
            h: 190,
            fields: [
                item('Spellcasting Ability', 'Charisma'),
                createField({
                    label: 'Spell Save DC',
                    type: 'computed',
                    value: '8 + proficiency + cha_mod',
                    description: 'DC an enemy must beat to resist your spells.',
                }),
                createField({
                    label: 'Spell Attack',
                    type: 'computed',
                    value: 'proficiency + cha_mod',
                    description: 'Bonus to hit with spell attacks.',
                }),
            ],
        },
        // Spell slots — spent by the spell cards' Cast buttons; refill on a rest.
        {
            title: 'Spell Slots',
            kind: 'spellslots',
            accent: '#a855f7',
            description: 'Click a pip to spend a slot. A long rest refills them.',
            h: 130,
            fields: [
                createField({ label: 'Level 1', type: 'resource', value: '2', max: 2, meta: { recharge: 'long' } }),
            ],
        },
        // Prepared spells — Cast spends a slot; Divine Smite is always prepared.
        {
            title: 'Spells',
            kind: 'spellcards',
            accent: '#a855f7',
            description: 'Cast to spend a slot and log it; roll healing/damage where shown.',
            h: 320,
            fields: [
                spell(
                    'Bless',
                    { level: '1', school: 'Enchantment', range: '30 ft', slot: 'level_1', slotLabel: 'L1', cost: '1' },
                    'Up to three creatures add 1d4 to their attack rolls and saving throws (Concentration, up to 1 minute).',
                ),
                spell(
                    'Cure Wounds',
                    { level: '1', school: 'Abjuration', range: 'Touch', damage: '1d8+{cha_mod}', type: 'healing', slot: 'level_1', slotLabel: 'L1', cost: '1' },
                    'Touch a creature to restore hit points equal to 1d8 + your Charisma modifier.',
                ),
                spell(
                    'Divine Smite',
                    { level: '1', school: 'Evocation', range: 'Self', damage: '2d8', type: 'radiant', slot: 'level_1', slotLabel: 'L1', cost: '1' },
                    'When you hit with a melee weapon, expend a spell slot to deal +2d8 radiant (+1d8 per slot level above 1st, and +1d8 vs. undead or fiends). Always prepared.',
                ),
            ],
        },
        // Saving throws — paladins are proficient in Wisdom and Charisma.
        {
            title: 'Saving Throws',
            kind: 'skills',
            accent: '#06b6d4',
            description: 'Click a save to roll it. Paladins are proficient in WIS and CHA.',
            h: 270,
            fields: [
                skill('Strength', 'STR'),
                skill('Dexterity', 'DEX'),
                skill('Constitution', 'CON'),
                skill('Intelligence', 'INT'),
                skill('Wisdom', 'WIS', 'proficient'),
                skill('Charisma', 'CHA', 'proficient'),
            ],
        },
        // Skills — Athletics & Intimidation (paladin) + Insight & Religion (Acolyte).
        {
            title: 'Skills',
            kind: 'skills',
            accent: '#06b6d4',
            description: 'Click a skill to roll it. Set proficiency/expertise in the editor.',
            h: 620,
            fields: [
                skill('Acrobatics', 'DEX'),
                skill('Animal Handling', 'WIS'),
                skill('Arcana', 'INT'),
                skill('Athletics', 'STR', 'proficient'),
                skill('Deception', 'CHA'),
                skill('History', 'INT'),
                skill('Insight', 'WIS', 'proficient'),
                skill('Intimidation', 'CHA', 'proficient'),
                skill('Investigation', 'INT'),
                skill('Medicine', 'WIS'),
                skill('Nature', 'INT'),
                skill('Perception', 'WIS'),
                skill('Performance', 'CHA'),
                skill('Persuasion', 'CHA'),
                skill('Religion', 'INT', 'proficient'),
                skill('Sleight of Hand', 'DEX'),
                skill('Stealth', 'DEX'),
                skill('Survival', 'WIS'),
            ],
        },
        // Class features & racial traits.
        {
            title: 'Features & Traits',
            accent: '#8b5cf6',
            description: 'What your class, race and background let you do.',
            h: 300,
            fields: [
                item('Spellcasting', '2 slots · 2 prepared', 'You can cast prepared paladin spells using Charisma (see the Spellcasting, Spell Slots and Spells cards).'),
                item('Divine Smite', 'always prepared', 'Expend a spell slot when you hit with a melee weapon to deal extra radiant damage.'),
                item('Divine Sense', '1 + CHA mod / long rest', 'As an action, know the location of celestials, fiends and undead within 60 ft until the end of your next turn.'),
                item('Lay on Hands', '5 HP pool', 'A pool of healing equal to 5 × your paladin level. Restore HP, or spend 5 to end one disease or neutralize one poison.'),
                item('Human — Versatile', '+1 to all scores', 'Humans get a small bonus to every ability score (already included).'),
                item('Shelter of the Faithful', 'Acolyte', 'You and your companions receive free healing and care at temples of your faith.'),
            ],
        },
        // Rest-aware class resource pools (auto-scaling caps).
        {
            title: 'Class Resources',
            accent: '#ec4899',
            description: 'Spend the pips; a long rest refills them.',
            h: 170,
            fields: [
                createField({
                    label: 'Lay on Hands',
                    type: 'resource',
                    value: '5',
                    max: 5,
                    maxFormula: '5 * level',
                    meta: { recharge: 'long' },
                    description: 'Healing pool = 5 × paladin level.',
                }),
                createField({
                    label: 'Divine Sense',
                    type: 'resource',
                    value: '3',
                    max: 3,
                    maxFormula: '1 + cha_mod',
                    meta: { recharge: 'long' },
                    description: 'Uses per long rest = 1 + CHA modifier.',
                }),
            ],
        },
        // Proficiencies & languages.
        {
            title: 'Proficiencies & Languages',
            accent: '#22d3ee',
            description: 'What you are trained to use and the tongues you speak.',
            h: 220,
            fields: [
                item('Armor', 'All armor, shields'),
                item('Weapons', 'Simple, Martial'),
                item('Tools', 'None'),
                item('Languages', 'Common, Celestial'),
            ],
        },
        // Background roleplay hooks.
        {
            title: 'Personality',
            accent: '#a78bfa',
            description: 'Roleplay anchors from your Acolyte background — make them yours.',
            h: 300,
            fields: [
                item('Trait', 'I idolize a hero of my faith and constantly refer to their deeds.'),
                item('Ideal', 'Charity. I always try to help those in need, no matter the personal cost.'),
                item('Bond', 'I would die to recover an ancient relic of my faith that was lost long ago.'),
                item('Flaw', 'I put too much trust in those who wield power within my temple hierarchy.'),
            ],
        },
        // Equipment — coin purse on top, then gear (D&D-Beyond-style single card).
        {
            title: 'Equipment',
            kind: 'inventory',
            accent: '#a3a3a3',
            description: 'Your coin purse and everything you carry.',
            h: 460,
            fields: [
                createField({ label: 'GP', type: 'number', value: '15', meta: { coin: 'gp' } }),
                createField({ label: 'SP', type: 'number', value: '0', meta: { coin: 'sp' } }),
                createField({ label: 'CP', type: 'number', value: '0', meta: { coin: 'cp' } }),
                item('Chain Mail', 'worn', 'Heavy armor, AC 16 (no DEX). Disadvantage on Stealth; STR 13 required.'),
                item('Shield', 'worn', '+2 AC.'),
                item('Longsword', 'equipped', 'Versatile martial weapon (1d8 / 1d10).'),
                item('Javelins', '×5', 'Thrown simple weapons (1d6 piercing, range 30/120).'),
                item('Holy Symbol', 'amulet', 'A symbol of Torm; your spellcasting focus.'),
                item('Priest’s Pack', 'carried', 'Backpack, blanket, tinderbox, alms box, 2 blocks of incense, censer, vestments, 2 days of rations, waterskin.'),
                item('Holy Water', '×1 flask', 'Throw to deal 2d6 radiant to a fiend or undead.'),
                item('Prayer Book', 'carried', 'A book of common prayers and rites.'),
                item('Common Clothes', 'worn'),
            ],
        },
    ]

    // Assign layouts: pack the canvas-visible cards first, then the two hidden
    // (sidebar-hosted) cards, so the canvas grid has no holes.
    const layouts = new Map<Spec, SectionLayout>()
    for (const spec of specs.filter((s) => !s.hidden)) layouts.set(spec, place(spec.h))
    for (const spec of specs.filter((s) => s.hidden)) layouts.set(spec, place(spec.h))

    return {
        id: uid(),
        name: 'New Character',
        sections: specs.map((spec, index) =>
            createSection(index, {
                title: spec.title,
                kind: spec.kind ?? 'default',
                accent: spec.accent,
                description: spec.description,
                ...(spec.meta ? { meta: spec.meta } : {}),
                fields: spec.fields,
                layout: layouts.get(spec)!,
            }),
        ),
    }
}

