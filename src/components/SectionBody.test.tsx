import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SectionBody } from './SectionBody'
import type { CharacterField, CharacterSection } from '../model/characterSheet'

const actionsSection = (fields: CharacterField[]): CharacterSection => ({
    id: 's',
    title: 'Attacks',
    description: '',
    accent: '#000',
    kind: 'actions',
    scale: 1,
    fields,
    layout: { x: 0, y: 0, w: 1, h: 1 },
})

const field = (overrides: Partial<CharacterField>): CharacterField => ({
    id: 'f',
    label: 'Action',
    type: 'text',
    value: '',
    description: '',
    ...overrides,
})

describe('ActionCards', () => {
    it('interpolates hit from the scope and rolls an attack', () => {
        const onRoll = vi.fn()
        const section = actionsSection([
            field({ id: 'a', label: 'Punch', meta: { hit: '+{str_mod + proficiency}', damage: '1d10+{str_mod}', type: 'bludgeoning' } }),
        ])
        render(
            <SectionBody
                section={section}
                results={new Map()}
                onUpdateField={() => { }}
                scope={{ str_mod: 5, proficiency: 3 }}
                onRoll={onRoll}
            />,
        )
        expect(screen.getByText('+8')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Attack/ }))
        expect(onRoll).toHaveBeenCalledWith(expect.objectContaining({ kind: 'attack' }))
    })

    it('spends a resource when the cost button is clicked', () => {
        const onSpend = vi.fn()
        const section = actionsSection([
            field({ id: 'h', label: 'Haymaker', meta: { cost: '1', costField: 'moxie_points', costLabel: 'Moxie' } }),
        ])
        render(
            <SectionBody
                section={section}
                results={new Map()}
                onUpdateField={() => { }}
                scope={{ moxie_points: 3 }}
                onRoll={() => { }}
                onSpend={onSpend}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Moxie/ }))
        expect(onSpend).toHaveBeenCalledWith('moxie_points', 1)
    })

    it('gates extra damage on its toggle (extraWhen)', () => {
        const section = actionsSection([
            field({ id: 'f', label: 'Handaxe', meta: { damage: '1d6', type: 'slashing', extra: '2d6', extraType: 'fire', extraWhen: 'flame' } }),
        ])
        const props = { section, results: new Map(), onUpdateField: () => { }, onRoll: () => { } }
        const { rerender } = render(<SectionBody {...props} scope={{ flame: 0 }} />)
        expect(screen.getByTitle(/Inactive/)).toBeInTheDocument()
        rerender(<SectionBody {...props} scope={{ flame: 1 }} />)
        expect(screen.queryByTitle(/Inactive/)).toBeNull()
    })
})
