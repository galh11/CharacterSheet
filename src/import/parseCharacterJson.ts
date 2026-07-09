import {
    createField,
    createSection,
    type CharacterField,
    type CharacterSection,
    type CharacterSheet,
} from '../model/characterSheet'

export interface ParseResult {
    sheet: CharacterSheet
    detected: string[]
}

/**
 * Structured importer for a D&D Beyond character JSON blob (from the character
 * service API, e.g. https://character-service.dndbeyond.com/character/v5/character/<id>).
 *
 * Unlike OCR/text parsing, this reads exact values. It intentionally covers the
 * cleanly-available fields (abilities, HP, speed, proficiency, inventory,
 * languages) rather than re-deriving AC/skills, which require D&D Beyond's full
 * rules engine.
 */

type Json = Record<string, unknown>

const asObj = (v: unknown): Json | null =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const num = (v: unknown): number | null =>
    typeof v === 'number' && !Number.isNaN(v) ? v : null
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)

const ABILITIES = [
    { id: 1, label: 'STR', full: 'strength' },
    { id: 2, label: 'DEX', full: 'dexterity' },
    { id: 3, label: 'CON', full: 'constitution' },
    { id: 4, label: 'INT', full: 'intelligence' },
    { id: 5, label: 'WIS', full: 'wisdom' },
    { id: 6, label: 'CHA', full: 'charisma' },
]

/** The 18 standard skills with their governing ability, keyed by D&D Beyond's
 *  proficiency subType slug. */
const SKILLS: { slug: string; label: string; ability: string }[] = [
    { slug: 'acrobatics', label: 'Acrobatics', ability: 'DEX' },
    { slug: 'animal-handling', label: 'Animal Handling', ability: 'WIS' },
    { slug: 'arcana', label: 'Arcana', ability: 'INT' },
    { slug: 'athletics', label: 'Athletics', ability: 'STR' },
    { slug: 'deception', label: 'Deception', ability: 'CHA' },
    { slug: 'history', label: 'History', ability: 'INT' },
    { slug: 'insight', label: 'Insight', ability: 'WIS' },
    { slug: 'intimidation', label: 'Intimidation', ability: 'CHA' },
    { slug: 'investigation', label: 'Investigation', ability: 'INT' },
    { slug: 'medicine', label: 'Medicine', ability: 'WIS' },
    { slug: 'nature', label: 'Nature', ability: 'INT' },
    { slug: 'perception', label: 'Perception', ability: 'WIS' },
    { slug: 'performance', label: 'Performance', ability: 'CHA' },
    { slug: 'persuasion', label: 'Persuasion', ability: 'CHA' },
    { slug: 'religion', label: 'Religion', ability: 'INT' },
    { slug: 'sleight-of-hand', label: 'Sleight of Hand', ability: 'DEX' },
    { slug: 'stealth', label: 'Stealth', ability: 'DEX' },
    { slug: 'survival', label: 'Survival', ability: 'WIS' },
]

const CURRENCIES: { key: string; label: string }[] = [
    { key: 'pp', label: 'PP' },
    { key: 'gp', label: 'GP' },
    { key: 'ep', label: 'EP' },
    { key: 'sp', label: 'SP' },
    { key: 'cp', label: 'CP' },
]

/** Cheap shape check so callers can auto-route paste input to text vs JSON. */
export const looksLikeDdbCharacter = (input: unknown): boolean => {
    const root = asObj(input)
    if (!root) return false
    const data = asObj(root.data) ?? root
    return Array.isArray(data.stats) && (typeof data.name === 'string' || Array.isArray(data.classes))
}

const flattenModifiers = (data: Json): Json[] => {
    const mods = asObj(data.modifiers)
    if (!mods) return []
    const out: Json[] = []
    for (const key of Object.keys(mods)) {
        for (const entry of asArr(mods[key])) {
            const o = asObj(entry)
            if (o) out.push(o)
        }
    }
    return out
}

const statValue = (arr: unknown[], id: number): number | null => {
    for (const entry of arr) {
        const o = asObj(entry)
        if (o && num(o.id) === id) return num(o.value)
    }
    return null
}

const abilityScore = (data: Json, mods: Json[], id: number, full: string): number | null => {
    const override = statValue(asArr(data.overrideStats), id)
    if (override !== null) return override
    const base = statValue(asArr(data.stats), id)
    if (base === null) return null
    let total = base + (statValue(asArr(data.bonusStats), id) ?? 0)
    for (const mod of mods) {
        if (str(mod.subType) !== `${full}-score`) continue
        const v = num(mod.value) ?? 0
        if (str(mod.type) === 'bonus') total += v
        else if (str(mod.type) === 'set' && v > total) total = v
    }
    return total
}

const abilityMod = (score: number): number => Math.floor((score - 10) / 2)

const totalLevel = (data: Json): number => {
    let level = 0
    for (const entry of asArr(data.classes)) {
        const o = asObj(entry)
        if (o) level += num(o.level) ?? 0
    }
    return level
}

const walkingSpeed = (data: Json): number | null => {
    const race = asObj(data.race)
    const speeds = race && asObj(asObj(race.weightSpeeds)?.normal)
    // weightSpeeds.normal.walk is the final walking speed in D&D Beyond's data.
    return speeds ? num(speeds.walk) : null
}

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** Build a live AC formula from the equipped armour (referencing `dex` so it
 *  stays correct if DEX changes). Light: +full DEX; medium: +DEX capped at 2;
 *  heavy: no DEX; shields and flat AC-bonus modifiers are added on. */
const armorClassFormula = (data: Json, mods: Json[]): string | null => {
    let body: Json | null = null
    let bodyAc = 0
    let bodyType = 0
    let shield = 0
    for (const entry of asArr(data.inventory)) {
        const o = asObj(entry)
        if (!o || o.equipped !== true) continue
        const def = asObj(o.definition)
        const ac = def ? num(def.armorClass) : null
        if (ac === null) continue
        const type = num(def!.armorTypeId) ?? 0
        if (type === 4) {
            shield += ac
        } else if (ac > bodyAc) {
            body = o
            bodyAc = ac
            bodyType = type
        }
    }
    let bonus = 0
    for (const m of mods) {
        if (str(m.type) === 'bonus' && str(m.subType) === 'armor-class') bonus += num(m.value) ?? 0
    }
    let base: number
    let dexPart: string
    if (body) {
        base = bodyAc
        dexPart = bodyType === 3 ? '' : bodyType === 2 ? ' + min(2, floor((dex - 10) / 2))' : ' + floor((dex - 10) / 2)'
    } else {
        base = 10
        dexPart = ' + floor((dex - 10) / 2)'
    }
    return `${base}${dexPart}${shield ? ` + ${shield}` : ''}${bonus ? ` + ${bonus}` : ''}`
}

export const parseCharacterJson = (input: unknown): ParseResult => {
    const root = asObj(input)
    const data = (root && (asObj(root.data) ?? root)) ?? {}
    const detected: string[] = []
    const sections: CharacterSection[] = []
    let layoutIndex = 0
    const place = (section: Omit<CharacterSection, 'layout' | 'kind' | 'scale'> & { kind?: CharacterSection['kind']; scale?: CharacterSection['scale'] }) => {
        const base = createSection(layoutIndex)
        sections.push({ ...base, ...section, layout: base.layout })
        layoutIndex++
    }

    const mods = flattenModifiers(data)

    // Which skills / saves are proficient or have expertise.
    const profSet = new Set<string>()
    const expSet = new Set<string>()
    for (const mod of mods) {
        const sub = str(mod.subType)
        if (!sub) continue
        if (str(mod.type) === 'proficiency') profSet.add(sub)
        else if (str(mod.type) === 'expertise') expSet.add(sub)
    }
    const skillProf = (slug: string): 'expertise' | 'proficient' | 'none' =>
        expSet.has(slug) ? 'expertise' : profSet.has(slug) ? 'proficient' : 'none'

    // Abilities + computed modifiers.
    const scores = new Map<string, number>()
    const abilityFields: CharacterField[] = []
    for (const ability of ABILITIES) {
        const score = abilityScore(data, mods, ability.id, ability.full)
        if (score === null) continue
        scores.set(ability.label, score)
        abilityFields.push(createField({ label: ability.label, type: 'number', value: String(score) }))
    }
    if (abilityFields.length > 0) {
        detected.push(`${abilityFields.length} ability scores`)
        place({ id: crypto.randomUUID(), title: 'Ability Scores', description: 'Imported from D&D Beyond.', accent: '#8b5cf6', kind: 'abilities', fields: abilityFields })
    }

    // Combat: HP, speed, proficiency bonus, initiative.
    const level = totalLevel(data)
    const con = scores.get('CON')
    const combatFields: CharacterField[] = []
    const baseHp = num(data.baseHitPoints)
    const overrideHp = num(data.overrideHitPoints)
    if (overrideHp !== null || baseHp !== null) {
        const maxHp =
            overrideHp !== null
                ? overrideHp
                : (baseHp ?? 0) +
                  (num(data.bonusHitPoints) ?? 0) +
                  (con !== undefined ? abilityMod(con) * level : 0)
        combatFields.push(createField({ label: 'Max HP', type: 'number', value: String(maxHp) }))
        combatFields.push(createField({ label: 'Current HP', type: 'number', value: String(maxHp - (num(data.removedHitPoints) ?? 0)) }))
    }
    const speed = walkingSpeed(data)
    if (speed !== null) combatFields.push(createField({ label: 'Speed', type: 'number', value: String(speed), description: 'Walking speed (ft).' }))
    if (level > 0) combatFields.push(createField({ label: 'Proficiency', type: 'number', value: String(Math.floor((level - 1) / 4) + 2) }))
    if (scores.has('DEX')) {
        const ac = armorClassFormula(data, mods)
        if (ac) combatFields.unshift(createField({ label: 'AC', type: 'computed', value: ac, description: 'Derived from equipped armour + DEX. Adjust the formula if you use a different calculation.' }))
        combatFields.push(createField({ label: 'Initiative', type: 'computed', value: 'floor((dex - 10) / 2)' }))
    }
    if (scores.has('WIS')) {
        const percProf = skillProf('perception')
        const bonus = percProf === 'expertise' ? ' + proficiency * 2' : percProf === 'proficient' ? ' + proficiency' : ''
        combatFields.push(createField({ label: 'Passive Perception', type: 'computed', value: `10 + floor((wis - 10) / 2)${bonus}` }))
    }
    if (combatFields.length > 0) {
        detected.push(`${combatFields.length} combat stats`)
        place({ id: crypto.randomUUID(), title: 'Combat', description: 'AC is derived from equipped armour; verify it against D&D Beyond.', accent: '#ef4444', fields: combatFields })
    }

    // Skills (auto: ability mod + proficiency), with proficiency/expertise dots.
    if (scores.size > 0) {
        const skillFields = SKILLS.map((s) =>
            createField({ label: s.label, type: 'number', value: '', meta: { ability: s.ability, prof: skillProf(s.slug), auto: 'true' } }),
        )
        detected.push('18 skills')
        place({ id: crypto.randomUUID(), title: 'Skills', description: 'Click a skill to roll. Dots mark proficiency / expertise.', accent: '#8b5cf6', kind: 'skills', fields: skillFields })

        const saveFields = ABILITIES.filter((a) => scores.has(a.label)).map((a) =>
            createField({
                label: capitalize(a.full),
                type: 'number',
                value: '',
                meta: { ability: a.label, prof: profSet.has(`${a.full}-saving-throws`) ? 'proficient' : 'none', auto: 'true' },
            }),
        )
        place({ id: crypto.randomUUID(), title: 'Saving Throws', description: 'Click to roll a saving throw.', accent: '#a855f7', kind: 'skills', fields: saveFields })
    }

    // Character summary (class, level, race).
    const summaryFields: CharacterField[] = []
    const classNames = asArr(data.classes)
        .map((c) => {
            const o = asObj(c)
            const name = o && str(asObj(o.definition)?.name)
            const lvl = o && num(o.level)
            return name ? `${name}${lvl ? ` ${lvl}` : ''}` : null
        })
        .filter((v): v is string => Boolean(v))
    if (classNames.length > 0) summaryFields.push(createField({ label: 'Class', type: 'text', value: classNames.join(' / ') }))
    const raceName = str(asObj(data.race)?.fullName) ?? str(asObj(data.race)?.baseName)
    if (raceName) summaryFields.push(createField({ label: 'Race', type: 'text', value: raceName }))
    if (summaryFields.length > 0) {
        place({ id: crypto.randomUUID(), title: 'Character', description: 'Class, level, and race.', accent: '#a855f7', fields: summaryFields })
    }

    // Inventory — one D&D-Beyond-style section: coin purse across the top, then
    // the item list. Currency travels with the gear instead of a separate card.
    const coinFields: CharacterField[] = []
    const currencies = asObj(data.currencies)
    if (currencies) {
        for (const c of CURRENCIES) {
            const amount = num(currencies[c.key]) ?? 0
            if (amount > 0) coinFields.push(createField({ label: c.label, type: 'number', value: String(amount), meta: { coin: c.key } }))
        }
    }
    const itemFields: CharacterField[] = []
    for (const entry of asArr(data.inventory)) {
        const o = asObj(entry)
        const name = o && str(asObj(o.definition)?.name)
        if (!name) continue
        const qty = (o && num(o.quantity)) ?? 1
        itemFields.push(createField({ label: name.slice(0, 40), type: 'text', value: qty > 1 ? `x${qty}` : '' }))
    }
    if (coinFields.length > 0 || itemFields.length > 0) {
        if (coinFields.length > 0) detected.push('currency')
        if (itemFields.length > 0) detected.push(`${itemFields.length} inventory items`)
        place({
            id: crypto.randomUUID(),
            title: 'Inventory',
            description: 'Coins and equipment imported from D&D Beyond.',
            accent: '#a3a3a3',
            kind: 'inventory',
            fields: [...coinFields, ...itemFields],
        })
    }

    // Languages (from modifiers of type "language").
    const languages = new Set<string>()
    for (const mod of mods) {
        if (str(mod.type) === 'language') {
            const label = str(mod.friendlySubtypeName) ?? str(mod.subType)
            if (label) languages.add(label.includes('-') ? capitalize(label.replace(/-/g, ' ')) : capitalize(label))
        }
    }
    if (languages.size > 0) {
        detected.push('proficiencies & languages')
        place({
            id: crypto.randomUUID(),
            title: 'Proficiencies',
            description: 'Languages known.',
            accent: '#f59e0b',
            fields: [createField({ label: 'Languages', type: 'text', value: Array.from(languages).join(', ').slice(0, 120) })],
        })
    }

    const name = str(data.name) ?? 'Imported Character'
    return { sheet: { id: crypto.randomUUID(), name, sections }, detected }
}
