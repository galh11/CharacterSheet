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
