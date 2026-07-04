import { describe, it, expect, vi, afterEach } from 'vitest'

// Each test imports a fresh copy of the module so its internal loaderPromise
// cache doesn't leak between cases.
afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    delete (window as unknown as { Tesseract?: unknown }).Tesseract
})

describe('recognizeImage', () => {
    it('uses an already-loaded Tesseract and reports progress', async () => {
        const recognize = vi.fn(
            async (
                _img: Blob | string,
                _lang: string,
                opts?: { logger?: (m: { status: string; progress: number }) => void },
            ) => {
                opts?.logger?.({ status: 'recognizing', progress: 1 })
                return { data: { text: 'orcish runes' } }
            },
        )
        ;(window as unknown as { Tesseract: unknown }).Tesseract = { recognize }

        const { recognizeImage } = await import('./ocr')
        const onProgress = vi.fn()
        const text = await recognizeImage(new Blob(['x']), onProgress)

        expect(text).toBe('orcish runes')
        expect(onProgress).toHaveBeenCalledWith('recognizing', 1)
    })

    it('lazily loads the library via a script tag when not present', async () => {
        const realCreate = document.createElement.bind(document)
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            const el = realCreate(tag) as HTMLScriptElement
            if (tag === 'script') {
                // Simulate the CDN script loading and installing the global.
                setTimeout(() => {
                    ;(window as unknown as { Tesseract: unknown }).Tesseract = {
                        recognize: async () => ({ data: { text: 'goblin ledger' } }),
                    }
                    el.onload?.(new Event('load'))
                }, 0)
            }
            return el
        })
        // Don't actually attach the script (avoids a real network request).
        vi.spyOn(document.head, 'appendChild').mockImplementation((node) => node)

        const { recognizeImage } = await import('./ocr')
        const text = await recognizeImage(new Blob(['x']))
        expect(text).toBe('goblin ledger')
    })

    it('rejects when the library fails to load', async () => {
        const realCreate = document.createElement.bind(document)
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            const el = realCreate(tag) as HTMLScriptElement
            if (tag === 'script') {
                setTimeout(() => el.onerror?.(new Event('error')), 0)
            }
            return el
        })
        vi.spyOn(document.head, 'appendChild').mockImplementation((node) => node)

        const { recognizeImage } = await import('./ocr')
        await expect(recognizeImage(new Blob(['x']))).rejects.toThrow('Could not load the OCR library')
    })
})
