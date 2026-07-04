import { describe, it, expect, beforeEach } from 'vitest'
import { loadSheet, saveSheet, clearSheet } from './persistence'
import { createStarterSheet } from '../model/characterSheet'

const STORAGE_KEY = 'character-sheet:v1'

describe('persistence', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('returns a fresh starter sheet when nothing is stored', () => {
        const sheet = loadSheet()
        expect(sheet.name).toBe('New Character')
        expect(sheet.sections.length).toBeGreaterThan(0)
    })

    it('round-trips a saved sheet', () => {
        const sheet = loadSheet()
        saveSheet({ ...sheet, name: 'Gandalf' })
        expect(loadSheet().name).toBe('Gandalf')
    })

    it('saves a versioned envelope', () => {
        saveSheet({ ...loadSheet(), name: 'Boromir' })
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
        expect(raw.version).toBe(1)
        expect(raw.sheet.name).toBe('Boromir')
    })

    it('loads a legacy bare sheet (no envelope) for backward compatibility', () => {
        const legacy = { ...createStarterSheet(), name: 'Legacy Hero' }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))
        expect(loadSheet().name).toBe('Legacy Hero')
    })

    it('loads a valid sheet stored under a future/unknown version', () => {
        const sheet = { ...createStarterSheet(), name: 'Future Hero' }
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, sheet }))
        expect(loadSheet().name).toBe('Future Hero')
    })

    it('falls back to a starter sheet when stored data is corrupt', () => {
        localStorage.setItem(STORAGE_KEY, '{ not valid json')
        expect(loadSheet().name).toBe('New Character')
    })

    it('falls back to a starter sheet when stored data has the wrong shape', () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }))
        expect(loadSheet().name).toBe('New Character')
    })

    it('clears the stored sheet', () => {
        saveSheet(loadSheet())
        clearSheet()
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })
})
