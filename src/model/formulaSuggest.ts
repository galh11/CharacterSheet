import type { FieldReference } from './compute'

/** The identifier token immediately before the cursor, plus where it starts.
 *  Formulas reference fields by slug, so completion only ever targets the run of
 *  `[A-Za-z0-9_]` characters ending at the caret (e.g. the `co` in `1d4 + co`). */
export interface CursorToken {
    token: string
    start: number
    end: number
}

/** Find the identifier being typed just before `cursor`. */
export const tokenAtCursor = (value: string, cursor: number): CursorToken => {
    let start = cursor
    while (start > 0 && /[A-Za-z0-9_]/.test(value[start - 1])) start -= 1
    return { token: value.slice(start, cursor), start, end: cursor }
}

/** A completion candidate for a formula token. */
export interface FormulaSuggestion {
    slug: string
    label: string
    value: number
    section: string
}

/** References whose slug or label starts with `token` (prefix, case-insensitive).
 *  Matching a leading word of the label lets a human name surface the slug too. */
export const filterReferences = (references: FieldReference[], token: string): FormulaSuggestion[] => {
    const t = token.toLowerCase()
    if (!t) return []
    return references.filter((r) => {
        if (r.slug.startsWith(t)) return true
        const label = r.label.toLowerCase()
        if (label.startsWith(t)) return true
        return label.split(/[^a-z0-9]+/).some((w) => w.length > 0 && w.startsWith(t))
    })
}

/** A section's worth of suggestions, shown under a bold header. */
export interface SuggestionGroup {
    section: string
    items: FormulaSuggestion[]
}

/** Group suggestions by their originating section, keeping first-seen order. */
export const groupSuggestions = (items: FormulaSuggestion[]): SuggestionGroup[] => {
    const groups: SuggestionGroup[] = []
    const index = new Map<string, SuggestionGroup>()
    for (const item of items) {
        let group = index.get(item.section)
        if (!group) {
            group = { section: item.section, items: [] }
            index.set(item.section, group)
            groups.push(group)
        }
        group.items.push(item)
    }
    return groups
}

/** Only trigger completion for tokens that look like the start of an identifier
 *  (so `1d4` and bare numbers don't pop a menu). */
export const isCompletable = (token: string): boolean => /^[A-Za-z_]/.test(token)
