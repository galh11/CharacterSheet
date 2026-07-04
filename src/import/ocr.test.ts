import { describe, it, expect, vi, afterEach } from 'vitest'
import { meanLuminance, preprocessForOcr } from './ocr'

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

describe('meanLuminance', () => {
    it('computes luminance for white and black pixels', () => {
        expect(meanLuminance(new Uint8ClampedArray([255, 255, 255, 255]))).toBeCloseTo(255)
        expect(meanLuminance(new Uint8ClampedArray([0, 0, 0, 255]))).toBe(0)
    })

    it('returns 0 for empty data', () => {
        expect(meanLuminance(new Uint8ClampedArray([]))).toBe(0)
    })
})

describe('preprocessForOcr', () => {
    it('inverts a dark-background image so text becomes dark on light', () => {
        // three dark background pixels + one light "text" pixel → mean < 110
        const data = new Uint8ClampedArray([
            10, 10, 10, 255, 10, 10, 10, 255, 10, 10, 10, 255, 240, 240, 240, 255,
        ])
        expect(preprocessForOcr(data)).toBe(true)
        expect(data[0]).toBe(255) // dark background → white
        expect(data[12]).toBe(0) // light text → black
    })

    it('does not invert an already light image', () => {
        const data = new Uint8ClampedArray([
            240, 240, 240, 255, 240, 240, 240, 255, 240, 240, 240, 255, 10, 10, 10, 255,
        ])
        expect(preprocessForOcr(data)).toBe(false)
        expect(data[0]).toBe(255) // light background stays white
        expect(data[12]).toBe(0) // dark text stays black
    })

    it('preserves the alpha channel', () => {
        const data = new Uint8ClampedArray([10, 10, 10, 123])
        preprocessForOcr(data)
        expect(data[3]).toBe(123)
    })
})
