import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useRollLog } from './useRollLog'

describe('useRollLog', () => {
    beforeEach(() => localStorage.clear())

    it('prepends new rolls (newest first) and mints an id', () => {
        const { result } = renderHook(() => useRollLog('char-a'))
        act(() => result.current.pushRoll({ title: 'First', detail: '', total: 1, kind: 'raw' }))
        act(() => result.current.pushRoll({ title: 'Second', detail: '', total: 2, kind: 'raw' }))
        expect(result.current.rollLog.map((e) => e.title)).toEqual(['Second', 'First'])
        expect(result.current.rollLog[0].id).toBeTruthy()
    })

    it('caps the log at 40 entries', () => {
        const { result } = renderHook(() => useRollLog('char-a'))
        act(() => {
            for (let i = 0; i < 45; i++) result.current.pushRoll({ title: `r${i}`, detail: '', total: i, kind: 'raw' })
        })
        expect(result.current.rollLog).toHaveLength(40)
        expect(result.current.rollLog[0].title).toBe('r44')
    })

    it('persists the log to localStorage under the active character key', () => {
        const { result } = renderHook(() => useRollLog('char-a'))
        act(() => result.current.pushRoll({ title: 'Hit', detail: '', total: 7, kind: 'attack' }))
        const stored = JSON.parse(localStorage.getItem('character-sheet:rolllog:char-a') || '[]')
        expect(stored[0].title).toBe('Hit')
    })

    it('loads an existing log for the active character on mount', () => {
        localStorage.setItem(
            'character-sheet:rolllog:char-b',
            JSON.stringify([{ id: 'x', title: 'Old', detail: '', total: 3, kind: 'raw' }]),
        )
        const { result } = renderHook(() => useRollLog('char-b'))
        expect(result.current.rollLog[0].title).toBe('Old')
    })

    it('reloads the log when the active character changes', () => {
        localStorage.setItem(
            'character-sheet:rolllog:char-b',
            JSON.stringify([{ id: 'y', title: 'B-roll', detail: '', total: 1, kind: 'raw' }]),
        )
        const { result, rerender } = renderHook(({ id }) => useRollLog(id), {
            initialProps: { id: 'char-a' },
        })
        act(() => result.current.pushRoll({ title: 'A-roll', detail: '', total: 1, kind: 'raw' }))
        expect(result.current.rollLog[0].title).toBe('A-roll')

        rerender({ id: 'char-b' })
        expect(result.current.rollLog.map((e) => e.title)).toEqual(['B-roll'])
    })
})
