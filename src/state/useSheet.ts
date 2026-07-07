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

/**
 * Central sheet state plus all mutation operations.
 * Autosaves to localStorage whenever the sheet changes.
 */
export const useSheet = () => {
    const [sheet, setSheet] = useState<CharacterSheet>(loadSheet)

    useEffect(() => {
        saveSheet(sheet)
    }, [sheet])

    const replaceSheet = useCallback((next: CharacterSheet) => setSheet(next), [])

    const renameSheet = useCallback((name: string) => {
        setSheet((current) => ({ ...current, name }))
    }, [])

    const mapSections = useCallback(
        (fn: (section: CharacterSection) => CharacterSection) => {
            setSheet((current) => ({ ...current, sections: current.sections.map(fn) }))
        },
        [],
    )

    const updateSection = useCallback(
        (
            sectionId: string,
            patch: Partial<Pick<CharacterSection, 'title' | 'description' | 'accent' | 'kind' | 'scale' | 'layout'>>,
        ) => {
            mapSections((section) =>
                section.id === sectionId ? { ...section, ...patch } : section,
            )
        },
        [mapSections],
    )

    const setSectionLayout = useCallback(
        (sectionId: string, layout: SectionLayout) => {
            mapSections((section) =>
                section.id === sectionId ? { ...section, layout } : section,
            )
        },
        [mapSections],
    )

    const addSection = useCallback(() => {
        setSheet((current) => ({
            ...current,
            sections: [...current.sections, createSection(current.sections.length)],
        }))
    }, [])

    const deleteSection = useCallback((sectionId: string) => {
        setSheet((current) => ({
            ...current,
            sections: current.sections.filter((section) => section.id !== sectionId),
        }))
    }, [])

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
        replaceSheet,
        renameSheet,
        updateSection,
        setSectionLayout,
        addSection,
        deleteSection,
        addField,
        updateField,
        deleteField,
        moveField,
    }
}

export type SheetApi = ReturnType<typeof useSheet>
