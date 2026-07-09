import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { FormulaInput } from './FormulaInput'
import { filterReferences, groupSuggestions, tokenAtCursor } from '../model/formulaSuggest'
import type { FieldReference } from '../model/compute'

const refs: FieldReference[] = [
    { slug: 'con_mod', label: 'Constitution Mod', value: 2, section: 'Ability Scores' },
    { slug: 'con_score', label: 'Constitution Score', value: 14, section: 'Ability Scores' },
    { slug: 'proficiency', label: 'Proficiency', value: 3, section: 'Core' },
    { slug: 'concentration', label: 'Concentration', value: 0, section: 'Combat' },
]

describe('tokenAtCursor', () => {
    it('returns the identifier run ending at the cursor', () => {
        expect(tokenAtCursor('1d4 + co', 8)).toEqual({ token: 'co', start: 6, end: 8 })
    })

    it('stops at operators and spaces', () => {
        expect(tokenAtCursor('con_mod + pr', 12)).toEqual({ token: 'pr', start: 10, end: 12 })
    })

    it('is empty right after a non-identifier char', () => {
        expect(tokenAtCursor('1d4 + ', 6).token).toBe('')
    })
})

describe('filterReferences', () => {
    it('matches by slug prefix', () => {
        const slugs = filterReferences(refs, 'con').map((r) => r.slug)
        expect(slugs).toEqual(expect.arrayContaining(['con_mod', 'con_score', 'concentration']))
        expect(slugs).not.toContain('proficiency')
    })

    it('matches a leading label word', () => {
        expect(filterReferences(refs, 'prof').map((r) => r.slug)).toContain('proficiency')
    })

    it('returns nothing for an empty token', () => {
        expect(filterReferences(refs, '')).toEqual([])
    })
})

describe('groupSuggestions', () => {
    it('groups matches by section in first-seen order', () => {
        const groups = groupSuggestions(filterReferences(refs, 'con'))
        expect(groups.map((g) => g.section)).toEqual(['Ability Scores', 'Combat'])
        expect(groups[0].items.map((i) => i.slug)).toEqual(['con_mod', 'con_score'])
    })
})

function Harness({ initial = '' }: { initial?: string }) {
    const [value, setValue] = useState(initial)
    return (
        <FormulaInput
            value={value}
            onChange={setValue}
            references={refs}
            aria-label="formula"
        />
    )
}

describe('<FormulaInput>', () => {
    it('shows section-grouped suggestions while typing and completes the token', () => {
        render(<Harness />)
        const input = screen.getByLabelText('formula') as HTMLInputElement
        fireEvent.change(input, { target: { value: 'co' } })

        const listbox = screen.getByRole('listbox')
        expect(within(listbox).getByText('Ability Scores')).toBeInTheDocument()
        expect(within(listbox).getByText('Combat')).toBeInTheDocument()

        fireEvent.mouseDown(within(listbox).getByRole('option', { name: /con_mod/ }))
        expect(input.value).toBe('con_mod')
    })

    it('completes the token in the middle of a formula', () => {
        render(<Harness initial="1d4 + " />)
        const input = screen.getByLabelText('formula') as HTMLInputElement
        // Simulate typing "co" at the end.
        fireEvent.change(input, { target: { value: '1d4 + co' } })
        fireEvent.mouseDown(screen.getByRole('option', { name: /con_score/ }))
        expect(input.value).toBe('1d4 + con_score')
    })

    it('does not open for a numeric token like 1d4', () => {
        render(<Harness />)
        const input = screen.getByLabelText('formula') as HTMLInputElement
        fireEvent.change(input, { target: { value: '1d4' } })
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('navigates with arrow keys and selects with Enter', () => {
        render(<Harness />)
        const input = screen.getByLabelText('formula') as HTMLInputElement
        fireEvent.change(input, { target: { value: 'con' } })
        // First option (con_mod) is active; ArrowDown moves to con_score.
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(input.value).toBe('con_score')
    })
})
