import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyCanvas } from './EmptyCanvas'
import { SECTION_TEMPLATES } from '../state/templates'

describe('EmptyCanvas', () => {
    it('renders the empty-state prompt and a + Section call to action', () => {
        render(<EmptyCanvas onAddSection={vi.fn()} onAddTemplate={vi.fn()} />)
        expect(screen.getByText('Your sheet is empty')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '+ Section' })).toBeInTheDocument()
    })

    it('calls onAddSection when the + Section button is clicked', () => {
        const onAddSection = vi.fn()
        render(<EmptyCanvas onAddSection={onAddSection} onAddTemplate={vi.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: '+ Section' }))
        expect(onAddSection).toHaveBeenCalledTimes(1)
    })

    it('offers a quick-add button for every template and passes it back on click', () => {
        const onAddTemplate = vi.fn()
        render(<EmptyCanvas onAddSection={vi.fn()} onAddTemplate={onAddTemplate} />)
        for (const template of SECTION_TEMPLATES) {
            expect(screen.getByRole('button', { name: template.label })).toBeInTheDocument()
        }
        const first = SECTION_TEMPLATES[0]
        fireEvent.click(screen.getByRole('button', { name: first.label }))
        expect(onAddTemplate).toHaveBeenCalledWith(first)
    })
})
