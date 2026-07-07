import { characterSheetSchema, createStarterSheet, type CharacterSheet } from '../model/characterSheet'

/**
 * Roster: manages multiple characters in localStorage. Each character's sheet is
 * stored under its own key; a small index tracks the ordered list and which one
 * is active. Migrates the legacy single-sheet key on first load.
 */

const ROSTER_KEY = 'character-sheet:roster:v1'
const LEGACY_KEY = 'character-sheet:v1'
const charKey = (id: string): string => `character-sheet:char:${id}`

export interface RosterEntry {
    id: string
    name: string
}

interface Roster {
    activeId: string
    entries: RosterEntry[]
}

const readJson = (key: string): unknown => {
    try {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

const parseSheet = (raw: unknown): CharacterSheet | null => {
    if (!raw || typeof raw !== 'object') return null
    const envelope = raw as { sheet?: unknown }
    const candidate = 'sheet' in envelope ? envelope.sheet : raw
    const parsed = characterSheetSchema.safeParse(candidate)
    return parsed.success ? parsed.data : null
}

const writeSheet = (id: string, sheet: CharacterSheet): void => {
    try {
        localStorage.setItem(charKey(id), JSON.stringify({ version: 1, sheet }))
    } catch {
        /* ignore quota errors */
    }
}

const readSheet = (id: string): CharacterSheet | null => parseSheet(readJson(charKey(id)))

const writeRoster = (roster: Roster): void => {
    try {
        localStorage.setItem(ROSTER_KEY, JSON.stringify(roster))
    } catch {
        /* ignore */
    }
}

const readRoster = (): Roster => {
    const existing = readJson(ROSTER_KEY) as Roster | null
    if (existing && Array.isArray(existing.entries) && existing.entries.length > 0) return existing
    // First run: migrate the legacy single-sheet key, or start fresh.
    const migrated = parseSheet(readJson(LEGACY_KEY)) ?? createStarterSheet()
    writeSheet(migrated.id, migrated)
    const roster: Roster = { activeId: migrated.id, entries: [{ id: migrated.id, name: migrated.name }] }
    writeRoster(roster)
    return roster
}

/** The active character id plus its sheet (falling back to a fresh starter). */
export const getActiveSheet = (): { id: string; sheet: CharacterSheet } => {
    const roster = readRoster()
    return { id: roster.activeId, sheet: readSheet(roster.activeId) ?? createStarterSheet() }
}

/** Persist the sheet to the active character and keep its roster name in sync. */
export const persistActive = (sheet: CharacterSheet): void => {
    const roster = readRoster()
    writeSheet(roster.activeId, sheet)
    writeRoster({
        ...roster,
        entries: roster.entries.map((e) => (e.id === roster.activeId ? { ...e, name: sheet.name } : e)),
    })
}

export const listCharacters = (): RosterEntry[] => readRoster().entries

export const getActiveId = (): string => readRoster().activeId

/** Switch the active character; returns its sheet (or null if unknown). */
export const switchCharacter = (id: string): CharacterSheet | null => {
    const roster = readRoster()
    if (!roster.entries.some((e) => e.id === id)) return null
    writeRoster({ ...roster, activeId: id })
    return readSheet(id)
}

/** Create a new starter character, make it active, and return it. */
export const createCharacter = (): { id: string; sheet: CharacterSheet } => {
    const sheet = createStarterSheet()
    writeSheet(sheet.id, sheet)
    const roster = readRoster()
    writeRoster({ activeId: sheet.id, entries: [...roster.entries, { id: sheet.id, name: sheet.name }] })
    return { id: sheet.id, sheet }
}

/** Duplicate the active character into a new roster slot and make it active. */
export const duplicateActive = (): { id: string; sheet: CharacterSheet } => {
    const { sheet } = getActiveSheet()
    const copy: CharacterSheet = { ...JSON.parse(JSON.stringify(sheet)), id: crypto.randomUUID(), name: `${sheet.name} copy` }
    writeSheet(copy.id, copy)
    const roster = readRoster()
    writeRoster({ activeId: copy.id, entries: [...roster.entries, { id: copy.id, name: copy.name }] })
    return { id: copy.id, sheet: copy }
}

/** Delete a character; returns the now-active id and its sheet. */
export const removeCharacter = (id: string): { id: string; sheet: CharacterSheet } => {
    const roster = readRoster()
    const entries = roster.entries.filter((e) => e.id !== id)
    try {
        localStorage.removeItem(charKey(id))
    } catch {
        /* ignore */
    }
    if (entries.length === 0) {
        const fresh = createStarterSheet()
        writeSheet(fresh.id, fresh)
        writeRoster({ activeId: fresh.id, entries: [{ id: fresh.id, name: fresh.name }] })
        return { id: fresh.id, sheet: fresh }
    }
    const activeId = roster.activeId === id ? entries[0].id : roster.activeId
    writeRoster({ activeId, entries })
    return { id: activeId, sheet: readSheet(activeId) ?? createStarterSheet() }
}
