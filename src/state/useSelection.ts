import { useCallback, useState } from 'react'
import type { CharacterSheet, SectionLayout } from '../model/characterSheet'
import {
    alignEdge,
    matchDimension,
    distribute as distributeLayout,
    type Placed,
    type AlignEdge,
} from '../model/layout'

/**
 * Multi-select of canvas cards plus the align / match-size / distribute
 * operations that act on the current selection. Selecting is additive with
 * shift/ctrl (`handleSelect`); the alignment ops write new layouts through the
 * provided `setSectionLayout`. `deselect` drops a single id (e.g. when a card is
 * tucked into the drawer) and `clearSelection` empties it.
 */
export function useSelection(
    sheet: CharacterSheet,
    setSectionLayout: (id: string, layout: SectionLayout) => void,
) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

    const handleSelect = useCallback((id: string, additive: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(additive ? prev : [])
            if (additive && prev.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const deselect = useCallback((id: string) => {
        setSelectedIds((prev) => {
            if (!prev.has(id)) return prev
            const next = new Set(prev)
            next.delete(id)
            return next
        })
    }, [])

    const selectedItems = (): Placed[] =>
        sheet.sections.filter((s) => selectedIds.has(s.id)).map((s) => ({ id: s.id, layout: s.layout }))
    const applyPlaced = (items: Placed[]) => {
        for (const { id, layout } of items) setSectionLayout(id, layout)
    }

    const align = (edge: AlignEdge) => applyPlaced(alignEdge(selectedItems(), edge))
    const match = (dim: 'w' | 'h') => applyPlaced(matchDimension(selectedItems(), dim))
    const distribute = (axis: 'h' | 'v') => applyPlaced(distributeLayout(selectedItems(), axis))

    return { selectedIds, clearSelection, handleSelect, deselect, align, match, distribute }
}
