import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCharacterText } from './parseCharacter'

// Text transcribed from the Yad Armhand D&D Beyond screenshots
// (samples/screenshots/). This exercises the importer end-to-end on a realistic
// multi-section paste rather than a synthetic snippet.
const fixture = readFileSync(join(process.cwd(), 'samples', 'yad-armhand-ddb.txt'), 'utf8')

describe('parseCharacterText — Yad Armhand (from screenshots)', () => {
    const { sheet, detected } = parseCharacterText(fixture)
    const section = (title: string) => sheet.sections.find((s) => s.title === title)
    const value = (title: string, label: string) =>
        section(title)?.fields.find((f) => f.label === label)?.value

    it('names the character', () => {
        expect(sheet.name).toBe('Yad Armhand')
    })

    it('parses ability scores and computed modifiers', () => {
        expect(value('Ability Scores', 'STR')).toBe('20')
        expect(value('Ability Scores', 'CON')).toBe('16')
        expect(section('Modifiers')?.fields.find((f) => f.label === 'STR Mod')?.type).toBe(
            'computed',
        )
    })

    it('parses combat stats', () => {
        expect(value('Combat', 'AC')).toBe('15')
        expect(value('Combat', 'Max HP')).toBe('76')
        expect(value('Combat', 'Speed')).toBe('35')
    })

    it('parses saving throws', () => {
        expect(value('Saving Throws', 'STR Save')).toBe('+8')
        expect(value('Saving Throws', 'CON Save')).toBe('+6')
    })

    it('parses skills', () => {
        expect(value('Skills', 'Athletics')).toBe('+11')
    })

    it('parses attacks with to-hit and damage', () => {
        const labels = section('Actions')?.fields.map((f) => f.label)
        expect(labels).toEqual(
            expect.arrayContaining(['Brass Knuckles', 'Dagger', 'Unarmed Strike', 'Javelin']),
        )
        const unarmed = value('Actions', 'Unarmed Strike')
        expect(unarmed).toContain('+8')
        expect(unarmed).toContain('1d10+5')
    })

    it('parses inventory items with quantities', () => {
        const labels = section('Inventory')?.fields.map((f) => f.label)
        expect(labels).toEqual(expect.arrayContaining(['Crowbar', 'Torch', 'Caltrops']))
        expect(value('Inventory', 'Torch')).toBe('x5')
    })

    it('reports several detected categories', () => {
        expect(detected.length).toBeGreaterThanOrEqual(6)
    })
})
