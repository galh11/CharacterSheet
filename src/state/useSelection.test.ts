import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSelection } from './useSelection'
import type { CharacterSheet } from '../model/characterSheet'

const sheetWith = (layouts: { id: string; x: number }[]): CharacterSheet =>
    ({
        sections: layouts.map(({ id, x }) => ({ id, layout: { x, y: 0, w: 50, h: 50 } })),
    }) as unknown as CharacterSheet

describe('useSelection', () => {
    it('selects a single id (non-additive replaces the selection)', () => {
        const { result } = renderHook(() => useSelection(sheetWith([{ id: 'a', x: 0 }]), vi.fn()))
        act(() => result.current.handleSelect('a', false))
        expect([...result.current.selectedIds]).toEqual(['a'])
        act(() => result.current.handleSelect('b', false))
        expect([...result.current.selectedIds]).toEqual(['b'])
    })

    it('additively toggles ids', () => {
        const { result } = renderHook(() => useSelection(sheetWith([]), vi.fn()))
        act(() => result.current.handleSelect('a', true))
        act(() => result.current.handleSelect('b', true))
        expect(result.current.selectedIds.has('a')).toBe(true)
        expect(result.current.selectedIds.has('b')).toBe(true)
        act(() => result.current.handleSelect('a', true))
        expect(result.current.selectedIds.has('a')).toBe(false)
    })

    it('deselects a single id and clears the whole selection', () => {
        const { result } = renderHook(() => useSelection(sheetWith([]), vi.fn()))
        act(() => result.current.handleSelect('a', true))
        act(() => result.current.handleSelect('b', true))
        act(() => result.current.deselect('a'))
        expect([...result.current.selectedIds]).toEqual(['b'])
        act(() => result.current.clearSelection())
        expect(result.current.selectedIds.size).toBe(0)
    })

    it('align writes a new layout for each selected card via setSectionLayout', () => {
        const setSectionLayout = vi.fn()
        const sheet = sheetWith([
            { id: 'a', x: 100 },
            { id: 'b', x: 200 },
        ])
        const { result } = renderHook(() => useSelection(sheet, setSectionLayout))
        act(() => result.current.handleSelect('a', true))
        act(() => result.current.handleSelect('b', true))
        act(() => result.current.align('left'))
        // Both cards align to the leftmost edge (x = 100).
        expect(setSectionLayout).toHaveBeenCalledTimes(2)
        for (const call of setSectionLayout.mock.calls) {
            expect(call[1].x).toBe(100)
        }
    })
})
