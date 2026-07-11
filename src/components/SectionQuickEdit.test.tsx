import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CharacterSection } from '../model/characterSheet'
import { SectionQuickEdit } from './SectionQuickEdit'

const section: CharacterSection = {
    id: 's',
    title: 'Combat',
    description: '',
    accent: '#7c3aed',
    kind: 'default',
    scale: 1,
    fields: [],
    layout: { x: 0, y: 0, w: 1, h: 1 },
}

describe('SectionQuickEdit', () => {
    it('renames the section as you type', async () => {
        const user = userEvent.setup()
        const onUpdateSection = vi.fn()
        render(<SectionQuickEdit section={section} onUpdateSection={onUpdateSection} />)

        await user.click(screen.getByRole('button', { name: 'Quick edit Combat' }))
        await user.type(screen.getByLabelText('Section name'), '!')
        expect(onUpdateSection).toHaveBeenCalledWith({ title: 'Combat!' })
    })

    it('changes the layout kind', async () => {
        const user = userEvent.setup()
        const onUpdateSection = vi.fn()
        render(<SectionQuickEdit section={section} onUpdateSection={onUpdateSection} />)

        await user.click(screen.getByRole('button', { name: 'Quick edit Combat' }))
        await user.selectOptions(screen.getByLabelText('Section layout'), 'hp')
        expect(onUpdateSection).toHaveBeenCalledWith({ kind: 'hp' })
    })

    it('recolours from a preset swatch', async () => {
        const user = userEvent.setup()
        const onUpdateSection = vi.fn()
        render(<SectionQuickEdit section={section} onUpdateSection={onUpdateSection} />)

        await user.click(screen.getByRole('button', { name: 'Quick edit Combat' }))
        await user.click(screen.getByRole('button', { name: 'Set colour #059669' }))
        expect(onUpdateSection).toHaveBeenCalledWith({ accent: '#059669' })
    })

    it('opens the full editor from "More settings…" and closes', async () => {
        const user = userEvent.setup()
        const onEdit = vi.fn()
        render(<SectionQuickEdit section={section} onUpdateSection={vi.fn()} onEdit={onEdit} />)

        await user.click(screen.getByRole('button', { name: 'Quick edit Combat' }))
        await user.click(screen.getByRole('button', { name: 'More settings…' }))
        expect(onEdit).toHaveBeenCalledOnce()
        expect(screen.queryByLabelText('Section name')).not.toBeInTheDocument()
    })
})
