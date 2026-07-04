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
        options?: {
            logger?: (m: { status: string; progress: number }) => void
            tessedit_pageseg_mode?: string
        },
    ) => Promise<{ data: { text: string } }>
}

declare global {
    interface Window {
        Tesseract?: TesseractGlobal
    }
}

/** Mean perceived luminance (0-255) of RGBA pixel data. */
export const meanLuminance = (data: Uint8ClampedArray): number => {
    if (data.length === 0) return 0
    let sum = 0
    for (let i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    }
    return sum / (data.length / 4)
}

/**
 * Grayscale + threshold RGBA pixel data in place for cleaner OCR. Dark-mode
 * screenshots (light text on a dark background) are inverted so the text ends
 * up dark on white, which Tesseract reads far more reliably. Returns whether
 * the image was inverted.
 */
export const preprocessForOcr = (data: Uint8ClampedArray, threshold = 140): boolean => {
    const invert = meanLuminance(data) < 110
    for (let i = 0; i < data.length; i += 4) {
        let lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        if (invert) lum = 255 - lum
        const v = lum < threshold ? 0 : 255
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
        // alpha (i + 3) is left untouched
    }
    return invert
}

/**
 * Best-effort image cleanup before OCR: upscale small images, grayscale,
 * auto-invert dark mode, and threshold. Falls back to the original file if the
 * canvas APIs are unavailable (e.g. in a non-browser environment).
 */
const prepareImage = async (file: Blob): Promise<Blob | string> => {
    if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return file
    try {
        const bitmap = await createImageBitmap(file)
        const scale = bitmap.width > 0 && bitmap.width < 1000 ? 2 : 1
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width * scale
        canvas.height = bitmap.height * scale
        const ctx = canvas.getContext('2d')
        if (!ctx) return file
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        preprocessForOcr(imageData.data)
        ctx.putImageData(imageData, 0, 0)
        return await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
                (blob) => (blob ? resolve(blob) : reject(new Error('canvas toBlob failed'))),
                'image/png',
            ),
        )
    } catch {
        return file // preprocessing is optional; degrade to the raw image
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
    const image = await prepareImage(file)
    const result = await tesseract.recognize(image, 'eng', {
        logger: (m) => onProgress?.(m.status, m.progress),
        // PSM 6: treat the image as a single uniform block of text, which suits
        // a cropped panel better than the default auto page segmentation.
        tessedit_pageseg_mode: '6',
    })
    return result.data.text
}
