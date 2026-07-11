import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

/** (De)serializer for storing a non-string value in `localStorage`. Define
 *  codecs at module scope so they stay referentially stable across renders. */
export interface Codec<T> {
    parse: (raw: string) => T
    serialize: (value: T) => string
}

/** Codec for a boolean persisted as `'1'` / `'0'`. */
export const boolCodec: Codec<boolean> = {
    parse: (raw) => raw === '1',
    serialize: (value) => (value ? '1' : '0'),
}

/**
 * A `useState` whose value is mirrored to `localStorage` under `key`.
 *
 * On mount it reads the stored value (falling back to `initial` when the key is
 * absent or storage is unreadable) and it writes the value back whenever it
 * changes. Every storage access is wrapped, so private-mode / quota failures
 * degrade gracefully to plain in-memory state. Pass a `codec` to (de)serialize
 * non-string values; without one the value is stored via `String(value)`.
 */
export function usePersistentState<T>(
    key: string,
    initial: T,
    codec?: Codec<T>,
): [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => {
        try {
            const raw = localStorage.getItem(key)
            if (raw === null) return initial
            return codec ? codec.parse(raw) : (raw as unknown as T)
        } catch {
            return initial
        }
    })

    useEffect(() => {
        try {
            localStorage.setItem(key, codec ? codec.serialize(value) : String(value))
        } catch {
            // ignore storage failures (private mode, quota)
        }
    }, [key, value, codec])

    return [value, setValue]
}
