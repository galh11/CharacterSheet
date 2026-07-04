import { describe, it, expect, vi, afterEach } from 'vitest'
import { importSheetFromFile, exportSheetToFile } from './transfer'
import { createStarterSheet } from '../model/characterSheet'

// A minimal File stand-in: importSheetFromFile only calls file.text(), so we
// avoid depending on the test environment's File/Blob implementation.
const asFile = (contents: string) =>
    ({ text: async () => contents }) as unknown as File

describe('importSheetFromFile', () => {
    it('accepts a valid sheet JSON file', async () => {
        const sheet = { ...createStarterSheet(), name: 'Legolas' }
        const result = await importSheetFromFile(asFile(JSON.stringify(sheet)))
        expect(result.ok).toBe(true)
        expect(result.sheet?.name).toBe('Legolas')
    })

    it('rejects invalid JSON', async () => {
        const result = await importSheetFromFile(asFile('{ broken'))
        expect(result.ok).toBe(false)
        expect(result.error).toBe('Could not read the file.')
    })

    it('rejects JSON that is not a character sheet', async () => {
        const result = await importSheetFromFile(asFile(JSON.stringify({ hello: 'world' })))
        expect(result.ok).toBe(false)
        expect(result.error).toBe('File is not a valid character sheet.')
    })
})

describe('exportSheetToFile', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('downloads the sheet using a filename derived from its name', () => {
        let anchor: HTMLAnchorElement | null = null
        const realCreate = document.createElement.bind(document)
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            const el = realCreate(tag) as HTMLElement
            if (tag === 'a') {
                anchor = el as HTMLAnchorElement
                anchor.click = vi.fn()
            }
            return el
        })
        // These object-URL helpers are not implemented in the test DOM.
        URL.createObjectURL = vi.fn(() => 'blob:mock')
        URL.revokeObjectURL = vi.fn()

        exportSheetToFile({ ...createStarterSheet(), name: 'My Hero!' })

        expect(anchor).not.toBeNull()
        expect(anchor!.download).toBe('my-hero-.json')
        expect(anchor!.click).toHaveBeenCalledOnce()
    })
})
