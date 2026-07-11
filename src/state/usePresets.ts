import { useState } from 'react'
import type { CharacterSheet } from '../model/characterSheet'
import { loadPresets, savePresets, type Presets } from './presets'
import type { SheetApi } from './useSheet'

/**
 * Named canvas layout presets. `savePreset` snapshots every section's current
 * position/size/scale (keyed by title) under a prompted name and persists it;
 * `applyPreset` restores a saved snapshot onto the matching sections. Both surface
 * a short status message through `onNotice`.
 */
export function usePresets(
    sheet: CharacterSheet,
    updateSection: SheetApi['updateSection'],
    onNotice: (message: string) => void,
) {
    const [presets, setPresets] = useState<Presets>(() => loadPresets())

    const savePreset = () => {
        const name = window.prompt('Save current layout as:')?.trim()
        if (!name) return
        const entries = sheet.sections.map((s) => ({ title: s.title, ...s.layout, scale: s.scale }))
        const next = { ...presets, [name]: entries }
        setPresets(next)
        savePresets(next)
        onNotice(`Layout "${name}" saved.`)
    }

    const applyPreset = (name: string) => {
        const preset = presets[name]
        if (!preset) return
        for (const s of sheet.sections) {
            const entry = preset.find((e) => e.title === s.title)
            if (entry) {
                updateSection(s.id, {
                    layout: { x: entry.x, y: entry.y, w: entry.w, h: entry.h },
                    scale: entry.scale,
                })
            }
        }
        onNotice(`Layout "${name}" applied.`)
    }

    return { presets, savePreset, applyPreset }
}
