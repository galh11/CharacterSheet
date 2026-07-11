import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SidebarStats } from './SidebarStats'
import { DEFAULT_SIDEBAR_STATS } from '../state/sidebarPrefs'

const scope = { str_mod: 3, str: 16, dex_mod: 1, dex: 12, ac: 15, initiative: 1, proficiency: 3, speed: 30 }

const baseProps = {
    scope,
    stats: DEFAULT_SIDEBAR_STATS,
    setStats: vi.fn(),
    portraitSize: 'md' as const,
    setPortraitSize: vi.fn(),
    rollLogDocked: true,
    setRollLogDocked: vi.fn(),
    theme: '#8b5cf6',
    hasInspiration: true,
    inspirationOn: false,
    toggleInspiration: vi.fn(),
    hpWidget: <div>HP-WIDGET</div>,
    onRollAbility: vi.fn(),
    onRollInitiative: vi.fn(),
}

describe('SidebarStats', () => {
    beforeEach(() => vi.clearAllMocks())

    it('shows core stat values read from the compute scope', () => {
        render(<SidebarStats {...baseProps} />)
        expect(screen.getByText('AC')).toBeInTheDocument()
        expect(screen.getByText('15')).toBeInTheDocument()
        expect(screen.getByText('Prof')).toBeInTheDocument()
        // STR ability tile shows the score prominently and the modifier below.
        expect(screen.getByText('16')).toBeInTheDocument()
        expect(screen.getAllByText('+3').length).toBeGreaterThanOrEqual(2)
        // The full HP widget node is rendered.
        expect(screen.getByText('HP-WIDGET')).toBeInTheDocument()
    })

    it('renders the provided HP widget only when HP is enabled', () => {
        const { rerender } = render(<SidebarStats {...baseProps} />)
        expect(screen.getByText('HP-WIDGET')).toBeInTheDocument()
        rerender(<SidebarStats {...baseProps} hpWidget={null} />)
        expect(screen.queryByText('HP-WIDGET')).not.toBeInTheDocument()
    })

    it('rolls an ability check when a tile is clicked', () => {
        render(<SidebarStats {...baseProps} />)
        fireEvent.click(screen.getByTitle('Roll a STR check (d20 +3)'))
        expect(baseProps.onRollAbility).toHaveBeenCalledWith('STR', 3)
    })

    it('rolls initiative with the resolved modifier', () => {
        render(<SidebarStats {...baseProps} />)
        fireEvent.click(screen.getByTitle('Roll initiative (d20 + mod)'))
        expect(baseProps.onRollInitiative).toHaveBeenCalledWith(1)
    })

    it('hides a stat that is toggled off', () => {
        render(<SidebarStats {...baseProps} stats={{ ...DEFAULT_SIDEBAR_STATS, ac: false }} />)
        expect(screen.queryByText('AC')).not.toBeInTheDocument()
    })

    it('toggles a stat, portrait size and roll-log docking from the settings popover', () => {
        render(<SidebarStats {...baseProps} />)
        fireEvent.click(screen.getByRole('button', { name: 'Sidebar stats settings' }))
        fireEvent.click(screen.getByLabelText('Speed'))
        expect(baseProps.setStats).toHaveBeenCalled()
        fireEvent.click(screen.getByRole('radio', { name: 'S' }))
        expect(baseProps.setPortraitSize).toHaveBeenCalledWith('sm')
        fireEvent.click(screen.getByLabelText('Dock roll log to sidebar'))
        expect(baseProps.setRollLogDocked).toHaveBeenCalledWith(false)
    })
})
