import {
    characterSheetSchema,
    createStarterSheet,
    type CharacterSheet,
} from '../model/characterSheet'

const STORAGE_KEY = 'character-sheet:v1'

/**
 * Persisted-data schema version. Bump this when the stored shape changes and
 * add a migration keyed by the previous version to MIGRATIONS below.
 */
const CURRENT_VERSION = 1

interface StoredEnvelope {
    version: number
    sheet: unknown
}

type Migration = (sheet: unknown) => unknown

/**
 * Upgrade steps keyed by the version they migrate FROM. Empty for now; add
 * entries here as the sheet shape evolves so existing saves are never lost.
 */
const MIGRATIONS: Record<number, Migration> = {}

const migrate = (fromVersion: number, sheet: unknown): unknown => {
    let version = fromVersion
    let data = sheet
    while (version < CURRENT_VERSION) {
        const step = MIGRATIONS[version]
        if (!step) break
        data = step(data)
        version++
    }
    return data
}

const isEnvelope = (value: unknown): value is StoredEnvelope =>
    typeof value === 'object' && value !== null && 'version' in value && 'sheet' in value

/** Load the persisted sheet, falling back to a fresh starter sheet. */
export const loadSheet = (): CharacterSheet => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return createStarterSheet()
        const parsed: unknown = JSON.parse(raw)
        // Current data is a { version, sheet } envelope; older saves stored the
        // bare sheet, which we treat as version 1.
        const version = isEnvelope(parsed) ? Number(parsed.version) || 1 : 1
        const payload = isEnvelope(parsed) ? parsed.sheet : parsed
        const migrated = migrate(version, payload)
        const result = characterSheetSchema.safeParse(migrated)
        return result.success ? result.data : createStarterSheet()
    } catch {
        return createStarterSheet()
    }
}

/** Persist the sheet to localStorage. Failures are non-fatal. */
export const saveSheet = (sheet: CharacterSheet): void => {
    try {
        const envelope: StoredEnvelope = { version: CURRENT_VERSION, sheet }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
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
