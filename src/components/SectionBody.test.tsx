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

describe('HpWidget death saves', () => {
    const hpSection = (current: string, meta?: Record<string, string>): CharacterSection => ({
        id: 'hp',
        title: 'Hit Points',
        description: '',
        accent: '#000',
        kind: 'hp',
        scale: 1,
        meta,
        fields: [
            field({ id: 'cur', label: 'Current HP', type: 'number', value: current }),
            field({ id: 'max', label: 'Max HP', type: 'number', value: '20' }),
        ],
        layout: { x: 0, y: 0, w: 1, h: 1 },
    })

    it('hides the death-save panel while Current HP is above 0', () => {
        render(<SectionBody section={hpSection('5')} results={new Map()} onUpdateField={() => { }} />)
        expect(screen.queryByText('Death saves')).toBeNull()
    })

    it('shows the death-save panel once Current HP hits 0', () => {
        render(<SectionBody section={hpSection('0')} results={new Map()} onUpdateField={() => { }} />)
        expect(screen.getByText('Death saves')).toBeInTheDocument()
        expect(screen.getByLabelText('Successes 1 of 3')).toBeInTheDocument()
        expect(screen.getByLabelText('Failures 1 of 3')).toBeInTheDocument()
    })

    it('records a failure pip into the section meta', () => {
        const onUpdateSection = vi.fn()
        render(<SectionBody section={hpSection('0')} results={new Map()} onUpdateField={() => { }} onUpdateSection={onUpdateSection} />)
        fireEvent.click(screen.getByLabelText('Failures 2 of 3'))
        expect(onUpdateSection).toHaveBeenCalledWith({ meta: { deathSuccesses: '0', deathFailures: '2' } })
    })

    it('rolls a death save and reports it to the roll log', () => {
        const onRoll = vi.fn()
        const onUpdateSection = vi.fn()
        render(<SectionBody section={hpSection('0')} results={new Map()} onUpdateField={() => { }} onRoll={onRoll} onUpdateSection={onUpdateSection} />)
        fireEvent.click(screen.getByRole('button', { name: /Roll save/ }))
        expect(onRoll).toHaveBeenCalledWith(expect.objectContaining({ title: 'Death save', kind: 'save' }))
        expect(onUpdateSection).toHaveBeenCalled()
    })

    it('adds a failure when damage is taken while already at 0 HP', () => {
        const onUpdateSection = vi.fn()
        render(<SectionBody section={hpSection('0')} results={new Map()} onUpdateField={() => { }} onUpdateSection={onUpdateSection} />)
        fireEvent.change(screen.getByLabelText('HP amount'), { target: { value: '5' } })
        fireEvent.click(screen.getByRole('button', { name: 'Damage' }))
        expect(onUpdateSection).toHaveBeenCalledWith({ meta: { deathSuccesses: '0', deathFailures: '1' } })
    })

    it('clears death saves when healing back above 0 HP', () => {
        const onUpdateSection = vi.fn()
        render(
            <SectionBody
                section={hpSection('0', { deathSuccesses: '1', deathFailures: '2' })}
                results={new Map()}
                onUpdateField={() => { }}
                onUpdateSection={onUpdateSection}
            />,
        )
        fireEvent.change(screen.getByLabelText('HP amount'), { target: { value: '5' } })
        fireEvent.click(screen.getByRole('button', { name: 'Heal' }))
        expect(onUpdateSection).toHaveBeenCalledWith({ meta: { deathSuccesses: '0', deathFailures: '0' } })
    })
})
