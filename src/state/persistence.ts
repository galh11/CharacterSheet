import {
    characterSheetSchema,
    createStarterSheet,
    type CharacterSheet,
} from '../model/characterSheet'

const STORAGE_KEY = 'character-sheet:v1'

/** Load the persisted sheet, falling back to a fresh starter sheet. */
export const loadSheet = (): CharacterSheet => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return createStarterSheet()
        const parsed = characterSheetSchema.safeParse(JSON.parse(raw))
        return parsed.success ? parsed.data : createStarterSheet()
    } catch {
        return createStarterSheet()
    }
}

/** Persist the sheet to localStorage. Failures are non-fatal. */
export const saveSheet = (sheet: CharacterSheet): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sheet))
    } catch {
        // Storage may be unavailable (private mode, quota). Ignore.
    }
}

export const clearSheet = (): void => {
    try {
        localStorage.removeItem(STORAGE_KEY)
    } catch {
        // Ignore.
    }
}
