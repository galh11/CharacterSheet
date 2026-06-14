import { characterSheetSchema, type CharacterSheet } from '../model/characterSheet'

/** Trigger a download of the sheet as a JSON file. */
export const exportSheetToFile = (sheet: CharacterSheet): void => {
    const blob = new Blob([JSON.stringify(sheet, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const safeName = sheet.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'character'
    anchor.href = url
    anchor.download = `${safeName}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
}

export interface ImportResult {
    ok: boolean
    sheet: CharacterSheet | null
    error: string | null
}

/** Read and validate a JSON sheet file. */
export const importSheetFromFile = async (file: File): Promise<ImportResult> => {
    try {
        const text = await file.text()
        const parsed = characterSheetSchema.safeParse(JSON.parse(text))
        if (!parsed.success) {
            return { ok: false, sheet: null, error: 'File is not a valid character sheet.' }
        }
        return { ok: true, sheet: parsed.data, error: null }
    } catch {
        return { ok: false, sheet: null, error: 'Could not read the file.' }
    }
}
