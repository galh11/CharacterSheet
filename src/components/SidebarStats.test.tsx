import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SidebarStats } from './SidebarStats'
import { DEFAULT_SIDEBAR_STATS } from '../state/sidebarPrefs'
import { createField, createSection, type CharacterSheet } from '../model/characterSheet'

const hpSection = createSection(0, {
    kind: 'hp',
    title: 'Hit Points',
    fields: [
        createField({ label: 'Current HP', type: 'number', value: '20' }),
        createField({ label: 'Max HP', type: 'number', value: '42' }),
        createField({ label: 'Temp HP', type: 'number', value: '5' }),
    ],
})
const sheet = { id: 'c1', name: 'Hero', sections: [hpSection] } as CharacterSheet

const scope = { str_mod: 3, dex_mod: 1, ac: 15, initiative: 1, proficiency: 3, speed: 30 }

const baseProps = {
    scope,
    sheet,
    stats: DEFAULT_SIDEBAR_STATS,
    setStats: vi.fn(),
    portraitSize: 'md' as const,
    setPortraitSize: vi.fn(),
    theme: '#8b5cf6',
    hasInspiration: true,
    inspirationOn: false,
    toggleInspiration: vi.fn(),
    onDamage: vi.fn(),
    onHeal: vi.fn(),
    onTempHp: vi.fn(),
    onRollInitiative: vi.fn(),
}

describe('SidebarStats', () => {
    beforeEach(() => vi.clearAllMocks())

    it('shows core stat values read from the compute scope', () => {
        render(<SidebarStats {...baseProps} />)
        expect(screen.getByText('AC')).toBeInTheDocument()
        expect(screen.getByText('15')).toBeInTheDocument()
        expect(screen.getByText('Prof')).toBeInTheDocument()
        // STR mod (+3) and Proficiency (+3) both render.
        expect(screen.getAllByText('+3').length).toBeGreaterThanOrEqual(2)
        // Current HP.
        expect(screen.getByText('20')).toBeInTheDocument()
    })

    it('applies HP damage, healing and temp with the typed amount', () => {
        render(<SidebarStats {...baseProps} />)
        const input = screen.getByLabelText('HP amount')
        fireEvent.change(input, { target: { value: '7' } })
        fireEvent.click(screen.getByTitle('Take damage'))
        expect(baseProps.onDamage).toHaveBeenCalledWith(7)
        fireEvent.change(input, { target: { value: '4' } })
        fireEvent.click(screen.getByTitle('Heal'))
        expect(baseProps.onHeal).toHaveBeenCalledWith(4)
        fireEvent.change(input, { target: { value: '9' } })
        fireEvent.click(screen.getByTitle('Set temporary HP'))
        expect(baseProps.onTempHp).toHaveBeenCalledWith(9)
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

    it('toggles a stat and picks a portrait size from the settings popover', () => {
        render(<SidebarStats {...baseProps} />)
        fireEvent.click(screen.getByRole('button', { name: 'Sidebar stats settings' }))
        fireEvent.click(screen.getByLabelText('Speed'))
        expect(baseProps.setStats).toHaveBeenCalled()
        fireEvent.click(screen.getByRole('radio', { name: 'S' }))
        expect(baseProps.setPortraitSize).toHaveBeenCalledWith('sm')
    })
})
