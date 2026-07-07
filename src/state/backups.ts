import { characterSheetSchema, type CharacterSheet } from '../model/characterSheet'

/**
 * Lightweight local version history: periodic snapshots of a character's sheet
 * kept in localStorage so an accidental change can be rolled back.
 */

const key = (id: string): string => `character-sheet:backups:${id}`
const MAX = 15
const MIN_GAP_MS = 60_000

export interface Backup {
    ts: number
    sheet: CharacterSheet
}

const read = (id: string): Backup[] => {
    try {
        const raw = localStorage.getItem(key(id))
        return raw ? (JSON.parse(raw) as Backup[]) : []
    } catch {
        return []
    }
}

const write = (id: string, list: Backup[]): void => {
    try {
        localStorage.setItem(key(id), JSON.stringify(list))
    } catch {
        /* ignore quota errors */
    }
}

/** Save a snapshot if at least a minute has passed since the newest one. */
export const pushBackup = (id: string, sheet: CharacterSheet): void => {
    const list = read(id)
    const now = Date.now()
    if (list.length > 0 && now - list[0].ts < MIN_GAP_MS) return
    write(id, [{ ts: now, sheet }, ...list].slice(0, MAX))
}

export const listBackups = (id: string): Backup[] => read(id)

/** Return a validated sheet from the backup with the given timestamp, or null. */
export const restoreBackup = (id: string, ts: number): CharacterSheet | null => {
    const backup = read(id).find((b) => b.ts === ts)
    if (!backup) return null
    const parsed = characterSheetSchema.safeParse(backup.sheet)
    return parsed.success ? parsed.data : null
}
