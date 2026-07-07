import {
    createField,
    createSection,
    type CharacterField,
    type CharacterSection,
    type CharacterSheet,
} from '../model/characterSheet'

/**
 * Tolerant parser that turns a D&D Beyond text dump (pasted or OCR'd) into a
 * structured cheat sheet. It extracts whatever it can recognize and never
 * throws — unknown content is ignored or captured as features.
 */

const ABILITIES: Array<{ key: string; label: string; names: string[] }> = [
    { key: 'str', label: 'STR', names: ['strength', 'str'] },
    { key: 'dex', label: 'DEX', names: ['dexterity', 'dex'] },
    { key: 'con', label: 'CON', names: ['constitution', 'con'] },
    { key: 'int', label: 'INT', names: ['intelligence', 'int'] },
    { key: 'wis', label: 'WIS', names: ['wisdom', 'wis'] },
    { key: 'cha', label: 'CHA', names: ['charisma', 'cha'] },
]

const SKILL_NAMES = [
    'Acrobatics',
    'Animal Handling',
    'Arcana',
    'Athletics',
    'Deception',
    'History',
    'Insight',
    'Intimidation',
    'Investigation',
    'Medicine',
    'Nature',
    'Perception',
    'Performance',
    'Persuasion',
    'Religion',
    'Sleight of Hand',
    'Stealth',
    'Survival',
]

export interface ParseResult {
    sheet: CharacterSheet
    detected: string[]
}

const findNumber = (text: string, patterns: RegExp[]): number | null => {
    for (const pattern of patterns) {
        const match = pattern.exec(text)
        if (match) {
            const value = Number(match[1])
            if (!Number.isNaN(value)) return value
        }
    }
    return null
}

/** Find an ability score near the ability name, tolerating OCR noise. */
const findAbilityScore = (text: string, names: string[]): number | null => {
    for (const name of names) {
        const re = new RegExp(`${name}\\b[^0-9+\\-]{0,12}([+-]?\\d{1,2})[^0-9]{0,6}(\\d{1,2})?`, 'i')
        const match = re.exec(text)
        if (!match) continue
        const a = Number(match[1])
        const b = match[2] !== undefined ? Number(match[2]) : null
        // D&D Beyond shows modifier first, score below. Prefer an unsigned
        // 1..30 number as the score; otherwise fall back to the first number.
        if (b !== null && b >= 1 && b <= 30) return b
        if (!match[1].startsWith('+') && !match[1].startsWith('-') && a >= 1 && a <= 30) return a
        if (b !== null) return b
        return a
    }
    return null
}

const parseName = (text: string): string | null => {
    // Heuristic: the first non-empty line that isn't a known stat keyword.
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    for (const line of lines.slice(0, 4)) {
        if (/^(class features|actions|inventory|features|str|dex|con|int|wis|cha)/i.test(line)) continue
        if (line.length >= 2 && line.length <= 40 && /[a-z]/i.test(line)) return line
    }
    return null
}

/** Extract feature blocks: a heading line followed by descriptive prose. */
const parseFeatures = (text: string): CharacterField[] => {
    const lines = text.split(/\r?\n/).map((l) => l.trim())
    const features: CharacterField[] = []

    const sourceTag = /(TPC|PHB[-\s]?2024[^a-z]*|XGE[^a-z]*|TCE[^a-z]*|DMG[^a-z]*)(,?\s*pg\.?\s*\d+)?$/i
    const usageLine = /^(.+?):\s*(Special|No Action|\d+\s*(Action|Bonus Action|Reaction|Minute|Hour))/i

    let current: { name: string; desc: string[]; usage: string[] } | null = null

    const flush = () => {
        if (!current) return
        const desc = current.desc.join(' ').replace(/\s+/g, ' ').trim()
        const usage = current.usage.join(' • ').trim()
        if (current.name) {
            features.push(
                createField({
                    label: current.name.slice(0, 60),
                    type: 'text',
                    value: usage,
                    description: desc.slice(0, 600),
                }),
            )
        }
        current = null
    }

    for (const line of lines) {
        if (!line) continue
        const tagMatch = sourceTag.exec(line)
        if (tagMatch) {
            // New feature heading: strip the trailing source tag.
            flush()
            const name = line.replace(sourceTag, '').trim()
            current = { name, desc: [], usage: [] }
            continue
        }
        if (!current) continue
        const usageMatch = usageLine.exec(line)
        if (usageMatch || /^\/\s*(Long Rest|Short Rest)/i.test(line) || /^Uses:/i.test(line)) {
            current.usage.push(line)
        } else {
            current.desc.push(line)
        }
    }
    flush()

    return features
}

/** Parse "Skill +N" style lines into text fields. */
const parseSkills = (text: string): CharacterField[] => {
    const fields: CharacterField[] = []
    for (const skill of SKILL_NAMES) {
        const re = new RegExp(`${skill.replace(/ /g, '\\s*')}[^+\\-\\d]{0,8}([+-]\\d+)`, 'i')
        const match = re.exec(text)
        if (match) {
            fields.push(createField({ label: skill, type: 'text', value: match[1] }))
        }
    }
    return fields
}

const parseProficiencies = (text: string): CharacterField[] => {
    const fields: CharacterField[] = []
    const grab = (label: string, re: RegExp) => {
        const match = re.exec(text)
        if (match && match[1]) {
            fields.push(createField({ label, type: 'text', value: match[1].trim().slice(0, 80) }))
        }
    }
    grab('Languages', /Languages?\s*[:\n]?\s*([A-Za-z ,'’]+)/i)
    grab('Armor', /Armor\s*[:\n]?\s*([A-Za-z ,'’]+? Armor|Light|Medium|Heavy)/i)
    grab('Tools', /Tools?\s*[:\n]?\s*([A-Za-z ,'’]+)/i)
    return fields
}

/** Parse saving throws, e.g. "STR Save +8" or a "Saving Throws" block. */
const parseSaves = (text: string): CharacterField[] => {
    const fields: CharacterField[] = []
    const seen = new Set<string>()
    const add = (label: string, value: string) => {
        if (seen.has(label)) return
        seen.add(label)
        fields.push(createField({ label, type: 'text', value }))
    }

    // Inline form: "Strength Save +8" / "STR Saving Throw +8".
    for (const ability of ABILITIES) {
        for (const name of ability.names) {
            const re = new RegExp(
                `${name}\\b[^\\n]{0,20}?(?:save|saving throw)[^0-9+\\-]{0,6}([+-]\\d+)`,
                'i',
            )
            const match = re.exec(text)
            if (match) {
                add(`${ability.label} Save`, match[1])
                break
            }
        }
    }

    // Labeled block: "Saving Throws" heading followed by "<Ability> +N" lines.
    const block = /saving throws?\s*[:\n]([\s\S]{0,400})/i.exec(text)?.[1]
    if (block) {
        for (const ability of ABILITIES) {
            if (seen.has(`${ability.label} Save`)) continue
            for (const name of ability.names) {
                const match = new RegExp(`${name}\\b[^0-9+\\-]{0,8}([+-]\\d+)`, 'i').exec(block)
                if (match) {
                    add(`${ability.label} Save`, match[1])
                    break
                }
            }
        }
    }

    return fields
}

/** Parse attack rows: any line carrying both a to-hit (+N) and damage dice. */
const parseAttacks = (text: string): CharacterField[] => {
    const fields: CharacterField[] = []
    const seen = new Set<string>()
    const damageRe = /\b(\d+d\d+(?:\s*[+-]\s*\d+)?)\b/i
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim()
        const damage = damageRe.exec(line)
        if (!damage) continue
        const beforeDamage = line.slice(0, damage.index)
        const hit = /([+-]\d+)/.exec(beforeDamage)
        if (!hit) continue // require a to-hit so hit-dice lines don't match

        // Name: text before the first comma, or before the first stat token.
        let name = line.split(/[,\t·|]/)[0].trim()
        if (name === line) {
            const cut = line.search(/\s(?:[+-]\d|\d+\s*ft|\d+d\d)/i)
            if (cut > 0) name = line.slice(0, cut).trim()
        }
        name = name.replace(/[,;:]$/, '').trim()
        if (!name || !/[a-z]/i.test(name) || seen.has(name.toLowerCase())) continue
        seen.add(name.toLowerCase())

        const range = /(\d+\s*(?:ft|feet)|\d+\s*\/\s*\d+)/i.exec(line)?.[1]
        fields.push(
            createField({
                label: name.slice(0, 40),
                type: 'text',
                value: `${hit[1]} · ${damage[1].replace(/\s+/g, '')}`,
                description: (range ? `Range ${range}. ` : '') + line.slice(0, 180),
            }),
        )
    }
    return fields
}

/** Parse an "Inventory"/"Equipment" block into item fields (name + quantity). */
const parseInventory = (text: string): CharacterField[] => {
    const fields: CharacterField[] = []
    const seen = new Set<string>()
    const startRe = /^(?:inventory|equipment)\b/i
    const stopRe = /^(?:actions?|attacks?|features?|traits?|spells?|proficiencies|saving throws?|skills|abilities)\b/i
    let inBlock = false
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim()
        if (!line) continue
        if (startRe.test(line)) {
            inBlock = true
            continue
        }
        if (!inBlock) continue
        if (stopRe.test(line)) break

        // Skip a column-header row like "ACTIVE NAME WEIGHT QTY COST NOTES".
        const headerHits = line.match(/\b(?:active|name|weight|qty|cost|notes)\b/gi)
        if (headerHits && headerHits.length >= 3) continue

        // Strip leading OCR bullet noise ("~", "—", ">", "N =", "- ", etc.).
        const cleaned = line.replace(/^[^A-Za-z0-9]+/, '').replace(/^[A-Za-z]\s*[=|]\s*/, '')
        // Pull an explicit quantity ("x10") before dropping trailing columns.
        const qty = /\bx(\d+)\b/i.exec(cleaned)?.[1]
        // Drop trailing weight/qty/cost column numbers (keeps names like "Rope 50 ft").
        const name = cleaned
            .replace(/(?:\s+[\d.*]+){2,}\s*$/, '')
            .replace(/\s+x\d+\s*$/i, '')
            .replace(/[|,]/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/[\s*]+$/, '')
            .trim()
        if (!name || !/[a-z]{2}/i.test(name) || seen.has(name.toLowerCase())) continue
        seen.add(name.toLowerCase())
        fields.push(
            createField({
                label: name.slice(0, 40),
                type: 'text',
                value: qty ? `x${qty}` : '',
            }),
        )
    }
    return fields
}

export const parseCharacterText = (text: string): ParseResult => {
    const detected: string[] = []
    const sections: CharacterSection[] = []
    let layoutIndex = 0
    const place = (section: Omit<CharacterSection, 'layout' | 'kind' | 'scale'> & { layout?: CharacterSection['layout']; kind?: CharacterSection['kind']; scale?: CharacterSection['scale'] }) => {
        const base = createSection(layoutIndex)
        sections.push({ ...base, ...section, layout: section.layout ?? base.layout })
        layoutIndex++
    }

    // Abilities
    const abilityFields: CharacterField[] = []
    for (const ability of ABILITIES) {
        const score = findAbilityScore(text, ability.names)
        if (score !== null) {
            abilityFields.push(createField({ label: ability.label, type: 'number', value: String(score) }))
        }
    }
    if (abilityFields.length > 0) {
        detected.push(`${abilityFields.length} ability scores`)
        place({
            id: crypto.randomUUID(),
            title: 'Ability Scores',
            description: 'Imported ability scores.',
            accent: '#8b5cf6',
            fields: abilityFields,
        })
        // Modifiers (computed) for whichever abilities were found.
        const modFields = abilityFields.map((field) =>
            createField({
                label: `${field.label} Mod`,
                type: 'computed',
                value: `floor((${field.label.toLowerCase()} - 10) / 2)`,
                description: `${field.label} modifier.`,
            }),
        )
        place({
            id: crypto.randomUUID(),
            title: 'Modifiers',
            description: 'Derived from ability scores.',
            accent: '#06b6d4',
            fields: modFields,
        })
    }

    // Combat stats
    const ac = findNumber(text, [/Armor\s*Class[^0-9]{0,8}(\d{1,2})/i, /\bAC\b[^0-9]{0,4}(\d{1,2})/i, /(\d{1,2})\s*\n?\s*(?:ARMOR\s*CLASS|AC\b)/i])
    const maxHp = findNumber(text, [/MAX[^0-9]{0,6}(\d{1,3})/i, /Hit\s*Points[^0-9]{0,8}(\d{1,3})/i, /(\d{1,3})\s*\/\s*\d{1,3}/])
    const curHp = findNumber(text, [/CURRENT[^0-9]{0,6}(\d{1,3})/i, /(\d{1,3})\s*\/\s*\d{1,3}/])
    const speed = findNumber(text, [/Speed[^0-9]{0,8}(\d{1,3})/i, /(\d{1,3})\s*ft/i])
    const prof = findNumber(text, [/Proficiency\s*Bonus[^0-9+]{0,6}\+?(\d{1,2})/i, /\+(\d)\s*\n?\s*BONUS/i])
    const initiative = findNumber(text, [/Initiative[^0-9+-]{0,6}([+-]?\d{1,2})/i])

    const combatFields: CharacterField[] = []
    if (ac !== null) combatFields.push(createField({ label: 'AC', type: 'number', value: String(ac) }))
    if (maxHp !== null) combatFields.push(createField({ label: 'Max HP', type: 'number', value: String(maxHp) }))
    if (curHp !== null) combatFields.push(createField({ label: 'Current HP', type: 'number', value: String(curHp) }))
    if (speed !== null) combatFields.push(createField({ label: 'Speed', type: 'number', value: String(speed), description: 'Walking speed (ft).' }))
    if (prof !== null) combatFields.push(createField({ label: 'Proficiency', type: 'number', value: String(prof) }))
    if (initiative !== null) combatFields.push(createField({ label: 'Initiative', type: 'number', value: String(initiative) }))
    if (combatFields.length > 0) {
        detected.push(`${combatFields.length} combat stats`)
        place({
            id: crypto.randomUUID(),
            title: 'Combat',
            description: 'Quick combat reference.',
            accent: '#ef4444',
            fields: combatFields,
        })
    }

    // Skills
    const skillFields = parseSkills(text)
    if (skillFields.length > 0) {
        detected.push(`${skillFields.length} skills`)
        place({
            id: crypto.randomUUID(),
            title: 'Skills',
            description: 'Imported skill modifiers.',
            accent: '#10b981',
            fields: skillFields,
        })
    }

    // Saving throws
    const saveFields = parseSaves(text)
    if (saveFields.length > 0) {
        detected.push(`${saveFields.length} saving throws`)
        place({
            id: crypto.randomUUID(),
            title: 'Saving Throws',
            description: 'Imported saving throw modifiers.',
            accent: '#0ea5e9',
            fields: saveFields,
        })
    }

    // Actions / attacks
    const attackFields = parseAttacks(text)
    if (attackFields.length > 0) {
        detected.push(`${attackFields.length} attacks`)
        place({
            id: crypto.randomUUID(),
            title: 'Actions',
            description: 'To-hit · damage. Hover for range and notes.',
            accent: '#f97316',
            fields: attackFields,
        })
    }

    // Inventory / equipment
    const inventoryFields = parseInventory(text)
    if (inventoryFields.length > 0) {
        detected.push(`${inventoryFields.length} inventory items`)
        place({
            id: crypto.randomUUID(),
            title: 'Inventory',
            description: 'Imported equipment.',
            accent: '#a3a3a3',
            fields: inventoryFields,
        })
    }

    // Proficiencies / languages
    const profFields = parseProficiencies(text)
    if (profFields.length > 0) {
        detected.push('proficiencies & languages')
        place({
            id: crypto.randomUUID(),
            title: 'Proficiencies',
            description: 'Armor, tools, and languages.',
            accent: '#f59e0b',
            fields: profFields,
        })
    }

    // Features & traits
    const featureFields = parseFeatures(text)
    if (featureFields.length > 0) {
        detected.push(`${featureFields.length} features/traits`)
        place({
            id: crypto.randomUUID(),
            title: 'Features & Traits',
            description: 'Hover a feature to read its full text.',
            accent: '#ec4899',
            fields: featureFields,
        })
    }

    const name = parseName(text) ?? 'Imported Character'

    if (sections.length === 0) {
        // Nothing recognized — drop the raw text into a single notes section so
        // the user keeps their content and can organize it manually.
        place({
            id: crypto.randomUUID(),
            title: 'Imported Notes',
            description: 'We could not auto-detect stats. Edit and organize freely.',
            accent: '#8b5cf6',
            fields: [
                createField({
                    label: 'Raw text',
                    type: 'text',
                    value: '',
                    description: text.slice(0, 600),
                }),
            ],
        })
    }

    return {
        sheet: { id: crypto.randomUUID(), name, sections },
        detected,
    }
}
