import { useCallback, useEffect, useState } from 'react'
import {
    createField,
    createSection,
    type CharacterField,
    type CharacterSection,
    type CharacterSheet,
    type SectionLayout,
} from '../model/characterSheet'
import { loadSheet, saveSheet } from './persistence'

interface History {
    sheet: CharacterSheet
    past: CharacterSheet[]
    future: CharacterSheet[]
}

const LIMIT = 60

/**
 * Central sheet state plus all mutation operations, with undo/redo history.
 * Autosaves to localStorage whenever the sheet changes.
 */
export const useSheet = () => {
    const [hist, setHist] = useState<History>(() => ({ sheet: loadSheet(), past: [], future: [] }))
    const sheet = hist.sheet

    useEffect(() => {
        saveSheet(sheet)
    }, [sheet])

    /** Apply an update and record the previous state for undo. */
    const commit = useCallback((updater: (s: CharacterSheet) => CharacterSheet) => {
        setHist((h) => {
            const next = updater(h.sheet)
            if (next === h.sheet) return h
            return { sheet: next, past: [...h.past, h.sheet].slice(-LIMIT), future: [] }
        })
    }, [])

    const undo = useCallback(() => {
        setHist((h) => {
            if (h.past.length === 0) return h
            const prev = h.past[h.past.length - 1]
            return { sheet: prev, past: h.past.slice(0, -1), future: [h.sheet, ...h.future].slice(0, LIMIT) }
        })
    }, [])

    const redo = useCallback(() => {
        setHist((h) => {
            if (h.future.length === 0) return h
            const next = h.future[0]
            return { sheet: next, past: [...h.past, h.sheet].slice(-LIMIT), future: h.future.slice(1) }
        })
    }, [])

    const replaceSheet = useCallback((next: CharacterSheet) => commit(() => next), [commit])

    const renameSheet = useCallback((name: string) => commit((c) => ({ ...c, name })), [commit])

    const mapSections = useCallback(
        (fn: (section: CharacterSection) => CharacterSection) =>
            commit((c) => ({ ...c, sections: c.sections.map(fn) })),
        [commit],
    )

    const updateSection = useCallback(
        (
            sectionId: string,
            patch: Partial<Pick<CharacterSection, 'title' | 'description' | 'accent' | 'kind' | 'scale' | 'layout'>>,
        ) => {
            mapSections((section) => (section.id === sectionId ? { ...section, ...patch } : section))
        },
        [mapSections],
    )

    const setSectionLayout = useCallback(
        (sectionId: string, layout: SectionLayout) => {
            mapSections((section) => (section.id === sectionId ? { ...section, layout } : section))
        },
        [mapSections],
    )

    const addSection = useCallback(() => {
        commit((c) => ({ ...c, sections: [...c.sections, createSection(c.sections.length)] }))
    }, [commit])

    const deleteSection = useCallback(
        (sectionId: string) => {
            commit((c) => ({ ...c, sections: c.sections.filter((s) => s.id !== sectionId) }))
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

    const addField = useCallback(
        (sectionId: string, overrides: Partial<CharacterField> = {}) => {
            mapSections((section) =>
                section.id === sectionId
                    ? { ...section, fields: [...section.fields, createField(overrides)] }
                    : section,
            )
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
        canUndo: hist.past.length > 0,
        canRedo: hist.future.length > 0,
        undo,
        redo,
        replaceSheet,
        renameSheet,
        updateSection,
        setSectionLayout,
        addSection,
        deleteSection,
        duplicateSection,
        addField,
        updateField,
        deleteField,
        moveField,
    }
}

export type SheetApi = ReturnType<typeof useSheet>

