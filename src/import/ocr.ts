/**
 * Optional screenshot OCR. Tesseract.js is loaded lazily from a CDN so the
 * core app has no build-time dependency on it. If loading fails (offline,
 * blocked CDN), the caller should fall back to manual text paste.
 */

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'

interface TesseractGlobal {
    recognize: (
        image: Blob | string,
        lang: string,
        options?: { logger?: (m: { status: string; progress: number }) => void },
    ) => Promise<{ data: { text: string } }>
}

declare global {
    interface Window {
        Tesseract?: TesseractGlobal
    }
}

let loaderPromise: Promise<TesseractGlobal> | null = null

const loadTesseract = (): Promise<TesseractGlobal> => {
    if (window.Tesseract) return Promise.resolve(window.Tesseract)
    if (loaderPromise) return loaderPromise

    loaderPromise = new Promise<TesseractGlobal>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = TESSERACT_CDN
        script.async = true
        script.onload = () => {
            if (window.Tesseract) resolve(window.Tesseract)
            else reject(new Error('Tesseract failed to initialize'))
        }
        script.onerror = () => reject(new Error('Could not load the OCR library'))
        document.head.appendChild(script)
    })
    return loaderPromise
}

export type OcrProgress = (status: string, progress: number) => void

/** Run OCR over an image file and return the recognized text. */
export const recognizeImage = async (
    file: Blob,
    onProgress?: OcrProgress,
): Promise<string> => {
    const tesseract = await loadTesseract()
    const result = await tesseract.recognize(file, 'eng', {
        logger: (m) => onProgress?.(m.status, m.progress),
    })
    return result.data.text
}
