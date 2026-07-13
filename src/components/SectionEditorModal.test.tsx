import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SectionEditorModal } from './SectionEditorModal'
import type { CharacterField, CharacterSection } from '../model/characterSheet'

const field: CharacterField = {
    id: 'f1',
    label: 'Unarmed Strike',
    type: 'text',
    value: '',
    description: 'Fisticuffs die d10.',
    meta: { hit: '+{str_mod + proficiency}', damage: '1d10+{str_mod}', type: 'bludgeoning' },
}

const section: CharacterSection = {
    id: 's1',
    title: 'Attacks',
    description: '',
    accent: '#f59e0b',
    kind: 'actions',
    scale: 1,
    fields: [field],
    layout: { x: 0, y: 0, w: 300, h: 200 },
}

const noop = () => {}

function renderModal(onUpdateField = vi.fn()) {
    render(
        <SectionEditorModal
            section={section}
            results={new Map()}
            references={[]}
            onClose={noop}
            onUpdateSection={noop}
            onDeleteSection={noop}
            onDuplicateSection={noop}
            onAddField={noop}
            onUpdateField={onUpdateField}
            onDeleteField={noop}
            onMoveField={noop}
        />,
    )
    return onUpdateField
}

describe('SectionEditorModal field description', () => {
    it('shows each field description in an editable box', () => {
        renderModal()
        const box = screen.getByLabelText('Field description') as HTMLTextAreaElement
        expect(box.value).toBe('Fisticuffs die d10.')
    })

    it('lets the user rewrite the description', () => {
        const onUpdateField = renderModal()
        fireEvent.change(screen.getByLabelText('Field description'), {
            target: { value: 'My own attack notes.' },
        })
        expect(onUpdateField).toHaveBeenCalledWith('f1', { description: 'My own attack notes.' })
    })
})

describe('SectionEditorModal move field to section', () => {
    it('offers other sections and moves the field on select', () => {
        const onMoveFieldToSection = vi.fn()
        render(
            <SectionEditorModal
                section={section}
                results={new Map()}
                references={[]}
                onClose={noop}
                onUpdateSection={noop}
                onDeleteSection={noop}
                onDuplicateSection={noop}
                onAddField={noop}
                onUpdateField={vi.fn()}
                onDeleteField={noop}
                onMoveField={noop}
                sections={[
                    { id: 's1', title: 'Attacks' },
                    { id: 's2', title: 'Free Actions' },
                ]}
                onMoveFieldToSection={onMoveFieldToSection}
            />,
        )
        const select = screen.getByLabelText('Move field to section') as HTMLSelectElement
        // The field's own section is excluded from the options.
        expect(screen.getByRole('option', { name: 'Free Actions' })).toBeInTheDocument()
        expect(screen.queryByRole('option', { name: 'Attacks' })).toBeNull()
        fireEvent.change(select, { target: { value: 's2' } })
        expect(onMoveFieldToSection).toHaveBeenCalledWith('f1', 's2')
    })

    it('hides the control when there is nowhere else to move', () => {
        render(
            <SectionEditorModal
                section={section}
                results={new Map()}
                references={[]}
                onClose={noop}
                onUpdateSection={noop}
                onDeleteSection={noop}
                onDuplicateSection={noop}
                onAddField={noop}
                onUpdateField={vi.fn()}
                onDeleteField={noop}
                onMoveField={noop}
                sections={[{ id: 's1', title: 'Attacks' }]}
                onMoveFieldToSection={vi.fn()}
            />,
        )
        expect(screen.queryByLabelText('Move field to section')).toBeNull()
    })
})
