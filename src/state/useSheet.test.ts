import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSheet } from './useSheet'

describe('useSheet', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('starts from the persisted (or starter) sheet', () => {
        const { result } = renderHook(() => useSheet())
        expect(result.current.sheet.sections.length).toBeGreaterThan(0)
    })

    it('renames the sheet', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.renameSheet('Frodo'))
        expect(result.current.sheet.name).toBe('Frodo')
    })

    it('adds and deletes sections', () => {
        const { result } = renderHook(() => useSheet())
        const before = result.current.sheet.sections.length

        act(() => result.current.addSection())
        expect(result.current.sheet.sections).toHaveLength(before + 1)

        const lastId = result.current.sheet.sections.at(-1)!.id
        act(() => result.current.deleteSection(lastId))
        expect(result.current.sheet.sections).toHaveLength(before)
    })

    it('adds, updates, and deletes a field', () => {
        const { result } = renderHook(() => useSheet())
        const sectionId = result.current.sheet.sections[0].id

        act(() => result.current.addField(sectionId, { label: 'Temp' }))
        const field = result.current.sheet.sections[0].fields.at(-1)!
        expect(field.label).toBe('Temp')

        act(() => result.current.updateField(sectionId, field.id, { label: 'Renamed' }))
        expect(
            result.current.sheet.sections[0].fields.find((f) => f.id === field.id)?.label,
        ).toBe('Renamed')

        act(() => result.current.deleteField(sectionId, field.id))
        expect(
            result.current.sheet.sections[0].fields.some((f) => f.id === field.id),
        ).toBe(false)
    })

    it('reorders fields with moveField', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.addSection())
        const sectionId = result.current.sheet.sections.at(-1)!.id

        act(() => result.current.addField(sectionId, { label: 'First' }))
        act(() => result.current.addField(sectionId, { label: 'Second' }))
        const second = result.current.sheet.sections.find((s) => s.id === sectionId)!.fields.at(-1)!

        act(() => result.current.moveField(sectionId, second.id, -1))
        const labels = result.current.sheet.sections
            .find((s) => s.id === sectionId)!
            .fields.map((f) => f.label)
        expect(labels).toEqual(['Second', 'First'])
    })

    it('autosaves changes to localStorage', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.renameSheet('Saved Hero'))
        const raw = localStorage.getItem('character-sheet:v1')
        expect(raw).not.toBeNull()
        expect(JSON.parse(raw!).name).toBe('Saved Hero')
    })
})
