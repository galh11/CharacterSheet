import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SectionNav } from './SectionNav'

const sections = [
    { id: 'a', title: 'Abilities', accent: '#ff0000' },
    { id: 'b', title: 'Combat' },
]

describe('SectionNav', () => {
    it('renders nothing when there are no sections', () => {
        const { container } = render(
            <SectionNav sections={[]} activeIds={new Set()} onJump={() => {}} />,
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('lists sections with a count and jumps on click', () => {
        const onJump = vi.fn()
        render(<SectionNav sections={sections} activeIds={new Set()} onJump={onJump} />)
        expect(screen.getByText('Sections · 2')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Jump to Combat' }))
        expect(onJump).toHaveBeenCalledWith('b')
    })

    it('collapses and expands the list', () => {
        render(<SectionNav sections={sections} activeIds={new Set()} onJump={() => {}} />)
        expect(screen.getByRole('button', { name: 'Jump to Abilities' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Sections · 2' }))
        expect(screen.queryByRole('button', { name: 'Jump to Abilities' })).not.toBeInTheDocument()
    })

    it('marks the active section', () => {
        render(<SectionNav sections={sections} activeIds={new Set(['a'])} onJump={() => {}} />)
        const active = screen.getByRole('button', { name: 'Jump to Abilities' })
        expect(active.className).toContain('bg-slate-700/70')
    })
})
