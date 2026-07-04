// Runs before every test file (configured in vite.config.ts -> test.setupFiles).
// - Adds friendly DOM matchers like toBeInTheDocument() / toHaveTextContent().
// - Unmounts rendered components after each test so they don't leak into the next.
// - Provides an in-memory localStorage (Node's native global is disabled and
//   would otherwise shadow jsdom's, breaking persistence tests).
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
    cleanup()
})

const createLocalStorageMock = (): Storage => {
    const store = new Map<string, string>()
    return {
        get length() {
            return store.size
        },
        clear: () => store.clear(),
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        removeItem: (key: string) => {
            store.delete(key)
        },
        setItem: (key: string, value: string) => {
            store.set(key, String(value))
        },
    }
}

Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: createLocalStorageMock(),
})
