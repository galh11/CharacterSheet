import { describe, it, expect, beforeEach } from 'vitest'
import { loadSheet, saveSheet, clearSheet } from './persistence'

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
