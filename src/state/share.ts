import { characterSheetSchema, type CharacterSheet } from '../model/characterSheet'

/**
 * Share-link codec: serialise a sheet into a URL-safe string that lives entirely
 * in the URL fragment (never sent to a server), so a link is a self-contained,
 * backend-free way to share a character.
 */

const bytesToBase64Url = (bytes: Uint8Array): string => {
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const base64UrlToBytes = (value: string): Uint8Array => {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(normalized)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
}

/** Encode a validated sheet into a compact URL-safe payload. */
export const encodeSheet = (sheet: CharacterSheet): string =>
    bytesToBase64Url(new TextEncoder().encode(JSON.stringify(sheet)))

/** Decode a payload back into a sheet, or null if it is malformed/invalid. */
export const decodeSheet = (payload: string): CharacterSheet | null => {
    try {
        const json = new TextDecoder().decode(base64UrlToBytes(payload))
        const parsed = characterSheetSchema.safeParse(JSON.parse(json))
        return parsed.success ? parsed.data : null
    } catch {
        return null
    }
}

/** Build a full shareable URL for the given sheet. */
export const buildShareUrl = (sheet: CharacterSheet): string =>
    `${window.location.origin}${window.location.pathname}#s=${encodeSheet(sheet)}`

/** Read a shared sheet from the current URL fragment, if present. */
export const readSharedSheet = (): CharacterSheet | null => {
    const match = window.location.hash.match(/[#&]s=([^&]+)/)
    return match ? decodeSheet(match[1]) : null
}

/** Remove the share payload from the URL without reloading. */
export const clearShareHash = (): void => {
    if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
}
