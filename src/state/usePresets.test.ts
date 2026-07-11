import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePresets } from './usePresets'
import type { CharacterSheet } from '../model/characterSheet'

const sheet = (): CharacterSheet =>
    ({
        sections: [
            { id: 'a', title: 'Combat', layout: { x: 10, y: 20, w: 100, h: 80 }, scale: 1 },
            { id: 'b', title: 'Skills', layout: { x: 200, y: 0, w: 120, h: 90 }, scale: 1.1 },
        ],
    }) as unknown as CharacterSheet

describe('usePresets', () => {
    beforeEach(() => localStorage.clear())

    it('saves a named snapshot of the current layout', () => {
        vi.spyOn(window, 'prompt').mockReturnValue('My Layout')
        const onNotice = vi.fn()
        const { result } = renderHook(() => usePresets(sheet(), vi.fn(), onNotice))
        act(() => result.current.savePreset())
        expect(result.current.presets['My Layout']).toHaveLength(2)
        expect(result.current.presets['My Layout'][0]).toMatchObject({ title: 'Combat', x: 10, y: 20, scale: 1 })
        expect(onNotice).toHaveBeenCalledWith('Layout "My Layout" saved.')
    })

    it('does nothing when the save prompt is cancelled', () => {
        vi.spyOn(window, 'prompt').mockReturnValue(null)
        const onNotice = vi.fn()
        const { result } = renderHook(() => usePresets(sheet(), vi.fn(), onNotice))
        act(() => result.current.savePreset())
        expect(Object.keys(result.current.presets)).toHaveLength(0)
        expect(onNotice).not.toHaveBeenCalled()
    })

    it('applies a saved preset back onto matching sections by title', () => {
        vi.spyOn(window, 'prompt').mockReturnValue('Saved')
        const updateSection = vi.fn()
        const onNotice = vi.fn()
        const { result } = renderHook(() => usePresets(sheet(), updateSection, onNotice))
        act(() => result.current.savePreset())
        act(() => result.current.applyPreset('Saved'))
        expect(updateSection).toHaveBeenCalledWith('a', { layout: { x: 10, y: 20, w: 100, h: 80 }, scale: 1 })
        expect(updateSection).toHaveBeenCalledWith('b', { layout: { x: 200, y: 0, w: 120, h: 90 }, scale: 1.1 })
        expect(onNotice).toHaveBeenCalledWith('Layout "Saved" applied.')
    })

    it('ignores applying an unknown preset name', () => {
        const updateSection = vi.fn()
        const { result } = renderHook(() => usePresets(sheet(), updateSection, vi.fn()))
        act(() => result.current.applyPreset('nope'))
        expect(updateSection).not.toHaveBeenCalled()
    })
})
