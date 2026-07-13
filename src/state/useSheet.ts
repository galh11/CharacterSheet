import { useCallback, useEffect, useState } from 'react'
import {
    createField,
    createSection,
    slugify,
    type CharacterField,
    type CharacterSection,
    type CharacterSheet,
    type CritMode,
    type SectionLayout,
} from '../model/characterSheet'
import { resolveSheet, resolveFieldMax } from '../model/compute'
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

    /** Set or clear the character portrait (an image data URL). */
    const setPortrait = useCallback(
        (portrait: string | undefined) =>
            commit((c) => ({ ...c, portrait: portrait || undefined }), portrait ? 'Set portrait' : 'Remove portrait'),
        [commit],
    )

    /** Update a house-rule setting (the "Game Mechanics" pane), e.g. crit mode. */
    const setCritMode = useCallback(
        (critMode: CritMode) =>
            commit((c) => ({ ...c, rules: { ...c.rules, critMode } }), 'Set crit mode'),
        [commit],
    )

    const mapSections = useCallback(
        (fn: (section: CharacterSection) => CharacterSection, label = 'Edit') =>
            commit((c) => ({ ...c, sections: c.sections.map(fn) }), label),
        [commit],
    )

    const updateSection = useCallback(
        (
            sectionId: string,
            patch: Partial<Pick<CharacterSection, 'title' | 'description' | 'accent' | 'kind' | 'scale' | 'drawer' | 'drawerLayout' | 'layout' | 'meta'>>,
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

    /** Apply many layouts in a single history step (for Tidy / Fit all). */
    const setSectionLayouts = useCallback(
        (updates: { id: string; layout: SectionLayout }[]) => {
            const byId = new Map(updates.map((u) => [u.id, u.layout]))
            commit(
                (c) => ({
                    ...c,
                    sections: c.sections.map((s) => (byId.has(s.id) ? { ...s, layout: byId.get(s.id)! } : s)),
                }),
                'Arrange',
            )
        },
        [commit],
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

    /** Delete several sections at once as a single undoable step (bulk action). */
    const deleteSections = useCallback(
        (ids: string[]) => {
            if (ids.length === 0) return
            const remove = new Set(ids)
            commit((c) => ({ ...c, sections: c.sections.filter((s) => !remove.has(s.id)) }), 'Delete sections')
        },
        [commit],
    )

    /** Duplicate several sections at once, each clone inserted just after its
     *  original with fresh ids, as a single undoable step (bulk action). */
    const duplicateSections = useCallback(
        (ids: string[]) => {
            if (ids.length === 0) return
            const dupe = new Set(ids)
            commit((c) => {
                const sections: CharacterSection[] = []
                for (const s of c.sections) {
                    sections.push(s)
                    if (dupe.has(s.id)) {
                        sections.push({
                            ...s,
                            id: crypto.randomUUID(),
                            title: `${s.title} copy`,
                            layout: { ...s.layout, x: s.layout.x + 24, y: s.layout.y + 24 },
                            fields: s.fields.map((f) => ({ ...f, id: crypto.randomUUID() })),
                        })
                    }
                }
                return { ...c, sections }
            }, 'Duplicate sections')
        },
        [commit],
    )

    /** Recolour several sections' accent at once as a single undoable step. */
    const recolorSections = useCallback(
        (ids: string[], accent: string) => {
            if (ids.length === 0) return
            const set = new Set(ids)
            commit(
                (c) => ({ ...c, sections: c.sections.map((s) => (set.has(s.id) ? { ...s, accent } : s)) }),
                'Recolour sections',
            )
        },
        [commit],
    )

    /** Reorder sections by moving `sourceId` to just before `targetId` in the
     *  sections array (drag-to-reorder in the stack view). A null/omitted target
     *  moves the source to the end. No-op if the source is dropped on itself. */
    const moveSection = useCallback(
        (sourceId: string, targetId?: string) => {
            if (sourceId === targetId) return
            commit((c) => {
                const from = c.sections.findIndex((s) => s.id === sourceId)
                if (from < 0) return c
                const sections = [...c.sections]
                const [moved] = sections.splice(from, 1)
                const to = targetId ? sections.findIndex((s) => s.id === targetId) : sections.length
                sections.splice(to < 0 ? sections.length : to, 0, moved)
                return { ...c, sections }
            }, 'Reorder sections')
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
            commit((c) => {
                const scope = resolveSheet(c).scope
                return {
                ...c,
                sections: c.sections.map((section) => {
                    const maxHp = section.fields.find((f) => f.label.toLowerCase() === 'max hp')?.value
                    // A long rest brings HP to full, so clear any recorded death
                    // saves stored on the HP section's meta.
                    const meta =
                        kind === 'long' && section.kind === 'hp' && (section.meta?.deathSuccesses || section.meta?.deathFailures)
                            ? { ...section.meta, deathSuccesses: '0', deathFailures: '0' }
                            : section.meta
                    return {
                        ...section,
                        meta,
                        fields: section.fields.map((field) => {
                            const label = field.label.toLowerCase()
                            const cap = resolveFieldMax(field, scope)
                            if (kind === 'long') {
                                if (label === 'current hp' && maxHp != null) return { ...field, value: maxHp }
                                if (label === 'temp hp') return { ...field, value: '0' }
                                if (label === 'exhaustion') {
                                    return { ...field, value: String(Math.max(0, (Number(field.value) || 0) - 1)) }
                                }
                                // Hit dice and spell slots refill on a long rest.
                                if (section.kind === 'hitdice' && cap != null) {
                                    return { ...field, value: String(cap) }
                                }
                                if (section.kind === 'spellslots' && cap != null) {
                                    return { ...field, value: String(cap) }
                                }
                            }
                            if (field.type === 'resource' && cap != null) {
                                const recharge = field.meta?.recharge ?? 'long'
                                if (kind === 'long' && recharge !== 'none') return { ...field, value: String(cap) }
                                if (kind === 'short' && recharge === 'short') return { ...field, value: String(cap) }
                            }
                            return field
                        }),
                    }
                }),
            }
            }, kind === 'long' ? 'Long rest' : 'Short rest')
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
                    // Regaining any HP stabilises the character: clear death saves.
                    const meta =
                        next > 0 && (section.meta?.deathSuccesses || section.meta?.deathFailures)
                            ? { ...section.meta, deathSuccesses: '0', deathFailures: '0' }
                            : section.meta
                    return {
                        ...section,
                        meta,
                        fields: section.fields.map((f) => (f.id === cur.id ? { ...f, value: String(next) } : f)),
                    }
                }),
            }))
        },
        [commit],
    )

    /**
     * Apply `amount` of (plain, untyped) damage to the HP tracker: temp HP
     * absorbs first, Current HP floors at 0, and taking a hit while already at 0
     * records a death-save failure. Type-based resist/vuln math stays in the HP
     * card's own control; this is the quick sidebar/back-end damage path.
     */
    const damageHp = useCallback(
        (amount: number) => {
            if (amount <= 0) return
            commit((c) => ({
                ...c,
                sections: c.sections.map((section) => {
                    const cur = section.fields.find((f) => f.label.toLowerCase() === 'current hp')
                    if (!cur) return section
                    const temp = section.fields.find((f) => f.label.toLowerCase() === 'temp hp')
                    const curN = Number(cur.value) || 0
                    const tempN = temp ? Number(temp.value) || 0 : 0
                    let dmg = amount
                    let nextTemp = tempN
                    if (temp && tempN > 0) {
                        const absorbed = Math.min(tempN, dmg)
                        nextTemp = tempN - absorbed
                        dmg -= absorbed
                    }
                    const nextCur = Math.max(0, curN - dmg)
                    const failN = Number(section.meta?.deathFailures) || 0
                    const meta =
                        curN <= 0 && failN < 3
                            ? { ...section.meta, deathFailures: String(Math.min(3, failN + 1)) }
                            : section.meta
                    return {
                        ...section,
                        meta,
                        fields: section.fields.map((f) =>
                            f.id === cur.id
                                ? { ...f, value: String(nextCur) }
                                : temp && f.id === temp.id
                                  ? { ...f, value: String(nextTemp) }
                                  : f,
                        ),
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

    /** Toggle the first boolean field whose slug matches (e.g. an activation flag
     *  like Flame Tongue that an action gates its extra damage on). */
    const toggleField = useCallback(
        (slug: string) => {
            commit((c) => {
                let done = false
                return {
                    ...c,
                    sections: c.sections.map((section) => ({
                        ...section,
                        fields: section.fields.map((field) => {
                            if (done || field.type !== 'boolean' || slugify(field.label) !== slug) return field
                            done = true
                            return { ...field, value: field.value === 'true' ? 'false' : 'true' }
                        }),
                    })),
                }
            }, 'Toggle')
        },
        [commit],
    )

    /** Set the first boolean field with this slug to a specific value (used to
     *  activate a linked buff when an action's cost is spent). */
    const setFlag = useCallback(
        (slug: string, value: boolean) => {
            const next = value ? 'true' : 'false'
            commit((c) => {
                let done = false
                return {
                    ...c,
                    sections: c.sections.map((section) => ({
                        ...section,
                        fields: section.fields.map((field) => {
                            if (done || field.type !== 'boolean' || slugify(field.label) !== slug || field.value === next)
                                return field
                            done = true
                            return { ...field, value: next }
                        }),
                    })),
                }
            }, value ? 'Activate' : 'Deactivate')
        },
        [commit],
    )

    /** Refill a resource to its max and, optionally, pay a cost by adding 1 to a counter
     *  (e.g. Dig Deep: restore the feature in exchange for a level of exhaustion). */
    const restoreResource = useCallback(
        (refillSlug: string, costSlug?: string) => {
            commit(
                (c) => {
                    const scope = resolveSheet(c).scope
                    return {
                    ...c,
                    sections: c.sections.map((section) => ({
                        ...section,
                        fields: section.fields.map((field) => {
                            const slug = slugify(field.label)
                            const cap = resolveFieldMax(field, scope)
                            if (slug === refillSlug && cap != null) {
                                return { ...field, value: String(cap) }
                            }
                            if (costSlug && slug === costSlug) {
                                return { ...field, value: String((Number(field.value) || 0) + 1) }
                            }
                            return field
                        }),
                    })),
                }
                },
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

    /** Move a field out of one section and append it to another (undoable). */
    const moveFieldToSection = useCallback(
        (fromSectionId: string, fieldId: string, toSectionId: string) => {
            if (fromSectionId === toSectionId) return
            commit((c) => {
                const from = c.sections.find((s) => s.id === fromSectionId)
                const field = from?.fields.find((f) => f.id === fieldId)
                if (!field) return c
                return {
                    ...c,
                    sections: c.sections.map((section) => {
                        if (section.id === fromSectionId)
                            return { ...section, fields: section.fields.filter((f) => f.id !== fieldId) }
                        if (section.id === toSectionId)
                            return { ...section, fields: [...section.fields, field] }
                        return section
                    }),
                }
            }, 'Move field to section')
        },
        [commit],
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
        setPortrait,
        setCritMode,
        updateSection,
        setSectionLayout,
        setSectionLayouts,
        addSection,
        addTemplateSection,
        deleteSection,
        duplicateSection,
        deleteSections,
        duplicateSections,
        recolorSections,
        moveSection,
        rest,
        healHp,
        damageHp,
        spendResource,
        toggleField,
        setFlag,
        restoreResource,
        applyTempHp,
        setFieldValueSilent,
        addField,
        updateField,
        deleteField,
        moveField,
        moveFieldToSection,
    }
}

export type SheetApi = ReturnType<typeof useSheet>

