import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePersistentState, boolCodec } from './usePersistentState'

describe('usePersistentState', () => {
    beforeEach(() => localStorage.clear())

    it('uses the initial value when the key is absent', () => {
        const { result } = renderHook(() => usePersistentState('k:missing', 42, undefined))
        expect(result.current[0]).toBe(42)
    })

    it('reads an existing stored value on mount (via codec)', () => {
        localStorage.setItem('k:flag', '1')
        const { result } = renderHook(() => usePersistentState('k:flag', false, boolCodec))
        expect(result.current[0]).toBe(true)
    })

    it('writes the value back to localStorage when it changes', () => {
        const { result } = renderHook(() => usePersistentState('k:flag', false, boolCodec))
        act(() => result.current[1](true))
        expect(result.current[0]).toBe(true)
        expect(localStorage.getItem('k:flag')).toBe('1')

        act(() => result.current[1](false))
        expect(localStorage.getItem('k:flag')).toBe('0')
    })

    it('stores plain string values without a codec', () => {
        const { result } = renderHook(() => usePersistentState('k:name', 'normal'))
        act(() => result.current[1]('compact'))
        expect(localStorage.getItem('k:name')).toBe('compact')
    })

    it('falls back to the initial value when the stored value is unparseable', () => {
        localStorage.setItem('k:num', 'not-a-number')
        const codec = {
            parse: (raw: string) => {
                const n = Number(raw)
                return Number.isFinite(n) ? n : 7
            },
            serialize: (v: number) => String(v),
        }
        const { result } = renderHook(() => usePersistentState('k:num', 7, codec))
        expect(result.current[0]).toBe(7)
    })
})
