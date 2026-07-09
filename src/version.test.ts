import { describe, expect, it } from 'vitest'
import { APP_VERSION, CHANGELOG, prUrl, REPO_URL } from './version'

describe('version', () => {
    it('APP_VERSION is the newest changelog entry', () => {
        expect(APP_VERSION).toBe(CHANGELOG[0].version)
    })

    it('every changelog entry is well-formed', () => {
        for (const entry of CHANGELOG) {
            expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/)
            expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
            expect(entry.summary.length).toBeGreaterThan(0)
            if (entry.pr != null) expect(entry.pr).toBeGreaterThan(0)
        }
    })

    it('has no duplicate versions', () => {
        const versions = CHANGELOG.map((e) => e.version)
        expect(new Set(versions).size).toBe(versions.length)
    })

    it('builds a GitHub pull-request link', () => {
        expect(prUrl(7)).toBe(`${REPO_URL}/pull/7`)
    })
})
