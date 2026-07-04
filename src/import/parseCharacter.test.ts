import { describe, it, expect } from 'vitest'
import { parseCharacterText } from './parseCharacter'

const SAMPLE = `Aragorn
Strength +3 16
Dexterity +2 14
Constitution +1 12
Intelligence +0 10
Wisdom +1 13
Charisma -1 8
Armor Class 15
Hit Points 30
Speed 30 ft`

describe('parseCharacterText', () => {
    it('extracts the character name from the first line', () => {
        expect(parseCharacterText(SAMPLE).sheet.name).toBe('Aragorn')
    })

    it('parses six ability scores into an Ability Scores section', () => {
        const { sheet } = parseCharacterText(SAMPLE)
        const abilities = sheet.sections.find((s) => s.title === 'Ability Scores')
        expect(abilities).toBeDefined()
        expect(abilities?.fields).toHaveLength(6)
        const str = abilities?.fields.find((f) => f.label === 'STR')
        expect(str?.value).toBe('16')
    })

    it('adds a computed Modifiers section derived from the abilities', () => {
        const { sheet } = parseCharacterText(SAMPLE)
        const mods = sheet.sections.find((s) => s.title === 'Modifiers')
        expect(mods).toBeDefined()
        const strMod = mods?.fields.find((f) => f.label === 'STR Mod')
        expect(strMod?.type).toBe('computed')
        expect(strMod?.value).toBe('floor((str - 10) / 2)')
    })

    it('parses combat stats into a Combat section', () => {
        const { sheet, detected } = parseCharacterText(SAMPLE)
        const combat = sheet.sections.find((s) => s.title === 'Combat')
        expect(combat?.fields.map((f) => f.label)).toContain('AC')
        expect(detected.some((d) => d.includes('combat'))).toBe(true)
    })

    it('falls back to a notes section when nothing is recognized', () => {
        const { sheet } = parseCharacterText('   ')
        expect(sheet.sections).toHaveLength(1)
        expect(sheet.sections[0].title).toBe('Imported Notes')
        expect(sheet.name).toBe('Imported Character')
    })

    it('never throws on arbitrary input', () => {
        expect(() => parseCharacterText('!@#$ random gibberish 12345')).not.toThrow()
    })
})

const RICH = `Aragorn
Strength 16
Dexterity 14
Saving Throws
Strength +8
Constitution +6
Actions
Brass Knuckles, 5ft, +8, 1d4+5, Simple Light Push
Dagger, 20/60, +8, 1d4+5, Finesse Light Thrown
Inventory
Backpack x1
Rope 50 ft x1
Torch x5`

describe('parseCharacterText — attacks, inventory, saves', () => {
    it('parses saving throws into a Saving Throws section', () => {
        const { sheet } = parseCharacterText(RICH)
        const saves = sheet.sections.find((s) => s.title === 'Saving Throws')
        expect(saves).toBeDefined()
        expect(saves?.fields.find((f) => f.label === 'STR Save')?.value).toBe('+8')
        expect(saves?.fields.find((f) => f.label === 'CON Save')?.value).toBe('+6')
    })

    it('parses attack rows into an Actions section with to-hit and damage', () => {
        const { sheet } = parseCharacterText(RICH)
        const actions = sheet.sections.find((s) => s.title === 'Actions')
        expect(actions).toBeDefined()
        const knuckles = actions?.fields.find((f) => f.label === 'Brass Knuckles')
        expect(knuckles?.value).toBe('+8 · 1d4+5')
        expect(actions?.fields.map((f) => f.label)).toContain('Dagger')
    })

    it('does not treat hit-dice lines as attacks', () => {
        const { sheet } = parseCharacterText('Hit Dice 8d10\nLevel 8')
        expect(sheet.sections.find((s) => s.title === 'Actions')).toBeUndefined()
    })

    it('parses an Inventory block into item fields', () => {
        const { sheet } = parseCharacterText(RICH)
        const inventory = sheet.sections.find((s) => s.title === 'Inventory')
        expect(inventory).toBeDefined()
        expect(inventory?.fields.map((f) => f.label)).toContain('Backpack')
        expect(inventory?.fields.find((f) => f.label === 'Torch')?.value).toBe('x5')
    })
})
