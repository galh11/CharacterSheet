import { useCallback, useEffect, useState } from 'react'
import type { RollLogEntry } from '../model/dice'

/** Newest-first roll log is capped at this many entries. */
const LIMIT = 40

const storageKey = (activeId: string) => `character-sheet:rolllog:${activeId}`

const readLog = (activeId: string): RollLogEntry[] => {
    try {
        const raw = localStorage.getItem(storageKey(activeId))
        return raw ? (JSON.parse(raw) as RollLogEntry[]) : []
    } catch {
        return []
    }
}

/**
 * The per-character roll log: newest-first and capped at 40 entries, mirrored to
 * `localStorage` under a key scoped to the active character and reloaded whenever
 * the active character changes. `pushRoll` prepends a new entry (minting its id).
 */
export function useRollLog(activeId: string) {
    const [rollLog, setRollLog] = useState<RollLogEntry[]>(() => readLog(activeId))

    // Reload the log when the active character changes. Doing this during render
    // (React's "adjust state on prop change" pattern) rather than in an effect
    // ensures the reload happens before the persist effect below runs, so we never
    // write the previous character's log under the new character's key.
    const [prevActive, setPrevActive] = useState(activeId)
    if (prevActive !== activeId) {
        setPrevActive(activeId)
        setRollLog(readLog(activeId))
    }

    const pushRoll = useCallback((entry: Omit<RollLogEntry, 'id'>) => {
        setRollLog((log) => [{ ...entry, id: crypto.randomUUID() }, ...log].slice(0, LIMIT))
    }, [])

    // Persist the active character's log on every change.
    useEffect(() => {
        try {
            localStorage.setItem(storageKey(activeId), JSON.stringify(rollLog))
        } catch {
            /* ignore quota errors */
        }
    }, [rollLog, activeId])

    return { rollLog, setRollLog, pushRoll }
}
