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
