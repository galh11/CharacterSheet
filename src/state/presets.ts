/** Named layout presets (section geometry + scale by title), stored locally. */

export interface LayoutEntry {
    title: string
    x: number
    y: number
    w: number
    h: number
    scale: number
}

export type Presets = Record<string, LayoutEntry[]>

const KEY = 'character-sheet:presets:v1'

export const loadPresets = (): Presets => {
    try {
        const raw = localStorage.getItem(KEY)
        return raw ? (JSON.parse(raw) as Presets) : {}
    } catch {
        return {}
    }
}

export const savePresets = (presets: Presets): void => {
    try {
        localStorage.setItem(KEY, JSON.stringify(presets))
    } catch {
        // Ignore (storage unavailable / quota).
    }
}
