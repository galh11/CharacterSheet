import { describe, it, expect } from 'vitest'
import { encodeSheet, decodeSheet } from './share'
import { createStarterSheet } from '../model/characterSheet'

describe('share codec', () => {
    it('round-trips a sheet through encode/decode', () => {
        const sheet = createStarterSheet()
        const decoded = decodeSheet(encodeSheet(sheet))
        expect(decoded).not.toBeNull()
        expect(decoded?.name).toBe(sheet.name)
        expect(decoded?.sections).toHaveLength(sheet.sections.length)
    })

    it('preserves unicode names', () => {
        const sheet = { ...createStarterSheet(), name: 'Yad Ärmhänd — 巨人' }
        expect(decodeSheet(encodeSheet(sheet))?.name).toBe('Yad Ärmhänd — 巨人')
    })

    it('produces a URL-safe payload (no +, /, or =)', () => {
        const payload = encodeSheet(createStarterSheet())
        expect(payload).not.toMatch(/[+/=]/)
    })

    it('returns null for a malformed payload', () => {
        expect(decodeSheet('not-valid-base64-$$$')).toBeNull()
        expect(decodeSheet(btoa('{"not":"a sheet"}'))).toBeNull()
    })
})
