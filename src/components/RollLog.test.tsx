import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RollLog } from './RollLog'
import type { RollLogEntry } from '../model/dice'

const entry = (over: Partial<RollLogEntry> = {}): RollLogEntry => ({
    id: crypto.randomUUID(),
    title: 'Longsword',
    detail: 'd20[14] + 7',
    total: 21,
    kind: 'attack',
    ...over,
})

const noop = () => {}

const baseProps = {
    rollMode: 'normal' as const,
    onRollModeChange: noop,
    bonus: 0,
    onBonusChange: noop,
    bonusDie: 0,
    onBonusDieChange: noop,
    repeat: 1,
    onRepeatChange: noop,
    onSpendLuck: noop,
    onRollDice: noop,
    onClear: noop,
}

describe('RollLog', () => {
    it('shows an empty-state prompt when there are no rolls', () => {
        render(<RollLog {...baseProps} entries={[]} />)
        expect(screen.getByText(/click an attack, skill, save or hit die to roll/i)).toBeInTheDocument()
    })

    it('flashes the newest roll and lists the total', () => {
        render(<RollLog {...baseProps} entries={[entry({ title: 'Fireball', total: 28, kind: 'damage' })]} />)
        expect(screen.getByText('Fireball')).toBeInTheDocument()
        const total = screen.getByText('28')
        // The latest row rings briefly so a fresh result is noticed.
        expect(total.closest('li')).toHaveClass('animate-roll-flash')
    })

    it('exposes the roll mode as a radiogroup and reports selection', async () => {
        const user = userEvent.setup()
        const onRollModeChange = vi.fn()
        render(<RollLog {...baseProps} entries={[]} rollMode="advantage" onRollModeChange={onRollModeChange} />)

        const group = screen.getByRole('radiogroup', { name: /roll mode/i })
        expect(group).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: 'ADV' })).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByRole('radio', { name: 'Normal' })).toHaveAttribute('aria-checked', 'false')

        await user.click(screen.getByRole('radio', { name: 'DIS' }))
        expect(onRollModeChange).toHaveBeenCalledWith('disadvantage')
    })

    it('keeps a compact latest-roll summary when collapsed', async () => {
        const user = userEvent.setup()
        render(<RollLog {...baseProps} entries={[entry({ title: 'Stealth', total: 17, kind: 'check' })]} />)

        // Collapse the panel; the controls hide but the latest total stays visible.
        await user.click(screen.getByRole('button', { name: /collapse roll log/i }))
        expect(screen.queryByRole('radiogroup', { name: /roll mode/i })).not.toBeInTheDocument()
        expect(screen.getByText('Stealth')).toBeInTheDocument()
        expect(screen.getByText('17')).toBeInTheDocument()
    })
})
