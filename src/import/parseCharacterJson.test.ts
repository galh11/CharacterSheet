import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCharacterJson, looksLikeDdbCharacter } from './parseCharacterJson'
import { computeSheet } from '../model/compute'

const ddb = JSON.parse(
    readFileSync(join(process.cwd(), 'samples', 'yad-armhand-ddb.json'), 'utf8'),
)

describe('looksLikeDdbCharacter', () => {
    it('accepts a D&D Beyond payload (with or without the data wrapper)', () => {
        expect(looksLikeDdbCharacter(ddb)).toBe(true)
        expect(looksLikeDdbCharacter(ddb.data)).toBe(true)
    })

    it('rejects unrelated JSON', () => {
        expect(looksLikeDdbCharacter({ hello: 'world' })).toBe(false)
        expect(looksLikeDdbCharacter('a string')).toBe(false)
    })
})

describe('parseCharacterJson — Yad Armhand', () => {
    const { sheet, detected } = parseCharacterJson(ddb)
    const section = (title: string) => sheet.sections.find((s) => s.title === title)
    const value = (title: string, label: string) =>
        section(title)?.fields.find((f) => f.label === label)?.value

    it('reads the character name', () => {
        expect(sheet.name).toBe('Yad Armhand')
    })

    it('applies base + bonusStats + score modifiers (STR 15+2+3 = 20)', () => {
        expect(value('Ability Scores', 'STR')).toBe('20')
        expect(value('Ability Scores', 'CON')).toBe('16')
        expect(value('Ability Scores', 'CHA')).toBe('8')
    })

    it('computes max HP from base + CON modifier * level', () => {
        // 52 base + (CON mod 3 * level 8) = 76
        expect(value('Combat', 'Max HP')).toBe('76')
        expect(value('Combat', 'Current HP')).toBe('76')
    })

    it('reads the final walking speed (35 ft)', () => {
        expect(value('Combat', 'Speed')).toBe('35')
    })

    it('computes the proficiency bonus from level (8 -> +3)', () => {
        expect(value('Combat', 'Proficiency')).toBe('3')
    })

    it('summarizes class and race', () => {
        expect(value('Character', 'Class')).toBe('Pugilist 8')
        expect(value('Character', 'Race')).toBe('Goliath')
    })

    it('imports inventory with quantities', () => {
        expect(section('Inventory')?.fields.map((f) => f.label)).toEqual(
            expect.arrayContaining(['Crowbar', 'Torch', 'Javelin', 'Backpack']),
        )
        expect(value('Inventory', 'Torch')).toBe('x10')
    })

    it('collects languages', () => {
        expect(value('Proficiencies', 'Languages')).toContain('Common')
        expect(value('Proficiencies', 'Languages')).toContain('Giant')
        expect(value('Proficiencies', 'Languages')).toContain('Elvish')
    })

    it('reports detected categories', () => {
        expect(detected.length).toBeGreaterThanOrEqual(4)
    })
})

describe('parseCharacterJson — real Amarthon export', () => {
    const amarthon = JSON.parse(
        readFileSync(join(process.cwd(), 'samples', 'amarthon-ddb.json'), 'utf8'),
    )
    it('detects and imports without throwing', () => {
        expect(looksLikeDdbCharacter(amarthon)).toBe(true)
        const { sheet, detected } = parseCharacterJson(amarthon)
        expect(sheet.name).toBe('Amarthon')
        expect(sheet.sections.length).toBeGreaterThan(0)
        expect(detected.length).toBeGreaterThan(0)
    })

    it('derives AC, skills, saves and currency', () => {
        const { sheet } = parseCharacterJson(amarthon)
        const section = (title: string) => sheet.sections.find((s) => s.title === title)
        // Studded Leather (12, light) + Shield (2) + DEX 14 (+2) => 12 + dex + 2.
        const ac = section('Combat')?.fields.find((f) => f.label === 'AC')
        expect(ac?.type).toBe('computed')
        expect(ac?.value).toContain('12')
        expect(ac?.value).toContain('dex')
        // 18 skills, with Nature/Perception/Insight/Arcana/History proficient.
        const skills = section('Skills')
        expect(skills?.fields).toHaveLength(18)
        const nature = skills?.fields.find((f) => f.label === 'Nature')
        expect(nature?.meta?.prof).toBe('proficient')
        const acro = skills?.fields.find((f) => f.label === 'Acrobatics')
        expect(acro?.meta?.prof).toBe('none')
        // Saving throws: INT and WIS proficient for this Druid.
        const saves = section('Saving Throws')
        expect(saves?.fields.find((f) => f.label === 'Wisdom')?.meta?.prof).toBe('proficient')
        expect(saves?.fields.find((f) => f.label === 'Strength')?.meta?.prof).toBe('none')
        // Currency: 346 gp.
        expect(section('Currency')?.fields.find((f) => f.label === 'GP')?.value).toBe('346')
    })

    it('computes AC to 16 (save-field labels do not clobber ability slugs)', () => {
        const { sheet } = parseCharacterJson(amarthon)
        const results = computeSheet(sheet)
        const ac = sheet.sections.find((s) => s.title === 'Combat')?.fields.find((f) => f.label === 'AC')
        // Studded Leather 12 + DEX mod (+2) + shield 2 = 16.
        expect(results.get(ac!.id)?.value).toBe(16)
    })
})
