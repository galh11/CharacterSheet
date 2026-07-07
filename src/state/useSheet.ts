import { useCallback, useEffect, useState } from 'react'
import {
    createField,
    createSection,
    slugify,
    type CharacterField,
    type CharacterSection,
    type CharacterSheet,
    type SectionLayout,
} from '../model/characterSheet'
import type { SectionTemplate } from './templates'
import {
    getActiveSheet,
    persistActive,
    listCharacters,
    switchCharacter as rosterSwitch,
    createCharacter,
    duplicateActive,
    removeCharacter,
    type RosterEntry,
} from './roster'

interface HistoryEntry {
    sheet: CharacterSheet
    label: string
}

interface History {
    sheet: CharacterSheet
    past: HistoryEntry[]
    future: HistoryEntry[]
}

const LIMIT = 60

/**
 * Central sheet state plus all mutation operations, with undo/redo history.
 * Autosaves the active character to localStorage whenever the sheet changes.
 */
export const useSheet = () => {
    const [hist, setHist] = useState<History>(() => ({ sheet: getActiveSheet().sheet, past: [], future: [] }))
    const [activeId, setActiveId] = useState<string>(() => getActiveSheet().id)
    const [characters, setCharacters] = useState<RosterEntry[]>(() => listCharacters())
    const sheet = hist.sheet

    useEffect(() => {
        persistActive(sheet)
    }, [sheet])

    const switchCharacter = useCallback((id: string) => {
        const next = rosterSwitch(id)
        if (!next) return
        setHist({ sheet: next, past: [], future: [] })
        setActiveId(id)
        setCharacters(listCharacters())
    }, [])

    const newCharacter = useCallback(() => {
        const { id, sheet: fresh } = createCharacter()
        setHist({ sheet: fresh, past: [], future: [] })
        setActiveId(id)
        setCharacters(listCharacters())
    }, [])

    const deleteCharacter = useCallback((id: string) => {
        const { id: nextId, sheet: nextSheet } = removeCharacter(id)
        setHist({ sheet: nextSheet, past: [], future: [] })
        setActiveId(nextId)
        setCharacters(listCharacters())
    }, [])

    /** Apply an update and record the previous state (with a label) for undo. */
    const commit = useCallback((updater: (s: CharacterSheet) => CharacterSheet, label = 'Edit') => {
        setHist((h) => {
            const next = updater(h.sheet)
            if (next === h.sheet) return h
            return { sheet: next, past: [...h.past, { sheet: h.sheet, label }].slice(-LIMIT), future: [] }
        })
    }, [])

    const undo = useCallback(() => {
        setHist((h) => {
            if (h.past.length === 0) return h
            const prev = h.past[h.past.length - 1]
            return { sheet: prev.sheet, past: h.past.slice(0, -1), future: [{ sheet: h.sheet, label: prev.label }, ...h.future].slice(0, LIMIT) }
        })
    }, [])

    const redo = useCallback(() => {
        setHist((h) => {
            if (h.future.length === 0) return h
            const next = h.future[0]
            return { sheet: next.sheet, past: [...h.past, { sheet: h.sheet, label: next.label }].slice(-LIMIT), future: h.future.slice(1) }
        })
    }, [])

    const duplicateCharacter = useCallback(() => {
        const { id, sheet: copy } = duplicateActive()
        setHist({ sheet: copy, past: [], future: [] })
        setActiveId(id)
        setCharacters(listCharacters())
    }, [])

    const replaceSheet = useCallback((next: CharacterSheet) => commit(() => next, 'Replace sheet'), [commit])

    const renameSheet = useCallback((name: string) => commit((c) => ({ ...c, name }), 'Rename'), [commit])

    const mapSections = useCallback(
        (fn: (section: CharacterSection) => CharacterSection, label = 'Edit') =>
            commit((c) => ({ ...c, sections: c.sections.map(fn) }), label),
        [commit],
    )

    const updateSection = useCallback(
        (
            sectionId: string,
            patch: Partial<Pick<CharacterSection, 'title' | 'description' | 'accent' | 'kind' | 'scale' | 'layout' | 'meta'>>,
        ) => {
            mapSections((section) => (section.id === sectionId ? { ...section, ...patch } : section))
        },
        [mapSections],
    )

    const setSectionLayout = useCallback(
        (sectionId: string, layout: SectionLayout) => {
            mapSections((section) => (section.id === sectionId ? { ...section, layout } : section), 'Move / resize')
        },
        [mapSections],
    )

    const addSection = useCallback(() => {
        commit((c) => ({ ...c, sections: [...c.sections, createSection(c.sections.length)] }), 'Add section')
    }, [commit])

    const addTemplateSection = useCallback(
        (template: SectionTemplate) => {
            commit(
                (c) => ({
                    ...c,
                    sections: [
                        ...c.sections,
                        createSection(c.sections.length, {
                            title: template.title,
                            kind: template.kind,
                            fields: template.fields.map((f) => createField(f)),
                        }),
                    ],
                }),
                `Add ${template.label}`,
            )
        },
        [commit],
    )

    const deleteSection = useCallback(
        (sectionId: string) => {
            commit((c) => ({ ...c, sections: c.sections.filter((s) => s.id !== sectionId) }), 'Delete section')
        },
        [commit],
    )

    const duplicateSection = useCallback(
        (sectionId: string) => {
            commit((c) => {
                const idx = c.sections.findIndex((s) => s.id === sectionId)
                if (idx < 0) return c
                const orig = c.sections[idx]
                const clone: CharacterSection = {
                    ...orig,
                    id: crypto.randomUUID(),
                    title: `${orig.title} copy`,
                    layout: { ...orig.layout, x: orig.layout.x + 24, y: orig.layout.y + 24 },
                    fields: orig.fields.map((f) => ({ ...f, id: crypto.randomUUID() })),
                }
                const sections = [...c.sections]
                sections.splice(idx + 1, 0, clone)
                return { ...c, sections }
            })
        },
        [commit],
    )

    /**
     * Apply a short or long rest across the whole sheet.
     * Long rest: Current HP → Max HP, Temp HP → 0, Exhaustion −1, and every
     * resource refills (unless its recharge is "none"). Short rest: only
     * resources tagged recharge "short" refill; HP is untouched.
     */
    const rest = useCallback(
        (kind: 'short' | 'long') => {
            commit((c) => ({
                ...c,
                sections: c.sections.map((section) => {
                    const maxHp = section.fields.find((f) => f.label.toLowerCase() === 'max hp')?.value
                    return {
                        ...section,
                        fields: section.fields.map((field) => {
                            const label = field.label.toLowerCase()
                            if (kind === 'long') {
                                if (label === 'current hp' && maxHp != null) return { ...field, value: maxHp }
                                if (label === 'temp hp') return { ...field, value: '0' }
                                if (label === 'exhaustion') {
                                    return { ...field, value: String(Math.max(0, (Number(field.value) || 0) - 1)) }
                                }
                                // Hit dice, spell slots and death saves reset on a long rest.
                                if (section.kind === 'hitdice' && field.max != null) {
                                    return { ...field, value: String(field.max) }
                                }
                                if (section.kind === 'spellslots' && field.max != null) {
                                    return { ...field, value: String(field.max) }
                                }
                                if (section.kind === 'deathsaves') return { ...field, value: '0' }
                            }
                            if (field.type === 'resource' && field.max != null) {
                                const recharge = field.meta?.recharge ?? 'long'
                                if (kind === 'long' && recharge !== 'none') return { ...field, value: String(field.max) }
                                if (kind === 'short' && recharge === 'short') return { ...field, value: String(field.max) }
                            }
                            return field
                        }),
                    }
                }),
            }), kind === 'long' ? 'Long rest' : 'Short rest')
        },
        [commit],
    )

    /**
     * Heal the character's HP tracker by `amount`, capped at Max HP. Finds the
     * section that owns both a "current hp" and a "max hp" field. Used by the
     * hit-dice widget and any cross-section healing.
     */
    const healHp = useCallback(
        (amount: number) => {
            if (amount <= 0) return
            commit((c) => ({
                ...c,
                sections: c.sections.map((section) => {
                    const cur = section.fields.find((f) => f.label.toLowerCase() === 'current hp')
                    const max = section.fields.find((f) => f.label.toLowerCase() === 'max hp')
                    if (!cur || !max) return section
                    const curN = Number(cur.value) || 0
                    const maxN = Number(max.value) || 0
                    const next = maxN > 0 ? Math.min(maxN, curN + amount) : curN + amount
                    return {
                        ...section,
                        fields: section.fields.map((f) => (f.id === cur.id ? { ...f, value: String(next) } : f)),
                    }
                }),
            }))
        },
        [commit],
    )

    /** Spend `amount` from the first resource/counter field whose slug matches. */
    const spendResource = useCallback(
        (slug: string, amount = 1) => {
            commit((c) => {
                let done = false
                return {
                    ...c,
                    sections: c.sections.map((section) => ({
                        ...section,
                        fields: section.fields.map((field) => {
                            if (done || slugify(field.label) !== slug) return field
                            if (field.type !== 'resource' && field.type !== 'counter') return field
                            done = true
                            return { ...field, value: String(Math.max(0, (Number(field.value) || 0) - amount)) }
                        }),
                    })),
                }
            })
        },
        [commit],
    )

    /** Refill a resource to its max and, optionally, pay a cost by adding 1 to a counter
     *  (e.g. Dig Deep: restore the feature in exchange for a level of exhaustion). */
    const restoreResource = useCallback(
        (refillSlug: string, costSlug?: string) => {
            commit(
                (c) => ({
                    ...c,
                    sections: c.sections.map((section) => ({
                        ...section,
                        fields: section.fields.map((field) => {
                            const slug = slugify(field.label)
                            if (slug === refillSlug && field.max != null) {
                                return { ...field, value: String(field.max) }
                            }
                            if (costSlug && slug === costSlug) {
                                return { ...field, value: String((Number(field.value) || 0) + 1) }
                            }
                            return field
                        }),
                    })),
                }),
                'Restore',
            )
        },
        [commit],
    )

    /** Apply temporary HP. Temp HP does not stack, so keep whichever is larger. */
    const applyTempHp = useCallback(
        (amount: number) => {
            if (amount <= 0) return
            commit((c) => ({
                ...c,
                sections: c.sections.map((section) => {
                    const temp = section.fields.find((f) => f.label.toLowerCase() === 'temp hp')
                    if (!temp) return section
                    const next = Math.max(Number(temp.value) || 0, amount)
                    return {
                        ...section,
                        fields: section.fields.map((f) => (f.id === temp.id ? { ...f, value: String(next) } : f)),
                    }
                }),
            }))
        },
        [commit],
    )

    /** Update a field by id WITHOUT recording undo history (for derived/auto values). */
    const setFieldValueSilent = useCallback((fieldId: string, value: string) => {
        setHist((h) => {
            let changed = false
            const sections = h.sheet.sections.map((s) => ({
                ...s,
                fields: s.fields.map((f) => {
                    if (f.id === fieldId && f.value !== value) {
                        changed = true
                        return { ...f, value }
                    }
                    return f
                }),
            }))
            if (!changed) return h
            return { ...h, sheet: { ...h.sheet, sections } }
        })
    }, [])

    const addField = useCallback(
        (sectionId: string, overrides: Partial<CharacterField> = {}) => {
            mapSections((section) =>
                section.id === sectionId
                    ? { ...section, fields: [...section.fields, createField(overrides)] }
                    : section,
            'Add field')
        },
        [mapSections],
    )

    const updateField = useCallback(
        (sectionId: string, fieldId: string, patch: Partial<CharacterField>) => {
            mapSections((section) =>
                section.id === sectionId
                    ? {
                          ...section,
                          fields: section.fields.map((field) =>
                              field.id === fieldId ? { ...field, ...patch } : field,
                          ),
                      }
                    : section,
            )
        },
        [mapSections],
    )

    const deleteField = useCallback(
        (sectionId: string, fieldId: string) => {
            mapSections((section) =>
                section.id === sectionId
                    ? { ...section, fields: section.fields.filter((field) => field.id !== fieldId) }
                    : section,
            )
        },
        [mapSections],
    )

    const moveField = useCallback(
        (sectionId: string, fieldId: string, direction: -1 | 1) => {
            mapSections((section) => {
                if (section.id !== sectionId) return section
                const index = section.fields.findIndex((field) => field.id === fieldId)
                const target = index + direction
                if (index < 0 || target < 0 || target >= section.fields.length) return section
                const fields = [...section.fields]
                ;[fields[index], fields[target]] = [fields[target], fields[index]]
                return { ...section, fields }
            })
        },
        [mapSections],
    )

    return {
        sheet,
        characters,
        activeId,
        switchCharacter,
        newCharacter,
        duplicateCharacter,
        deleteCharacter,
        canUndo: hist.past.length > 0,
        canRedo: hist.future.length > 0,
        undoLabel: hist.past.length > 0 ? hist.past[hist.past.length - 1].label : null,
        redoLabel: hist.future.length > 0 ? hist.future[0].label : null,
        undo,
        redo,
        replaceSheet,
        renameSheet,
        updateSection,
        setSectionLayout,
        addSection,
        addTemplateSection,
        deleteSection,
        duplicateSection,
        rest,
        healHp,
        spendResource,
        restoreResource,
        applyTempHp,
        setFieldValueSilent,
        addField,
        updateField,
        deleteField,
        moveField,
    }
}

export type SheetApi = ReturnType<typeof useSheet>

