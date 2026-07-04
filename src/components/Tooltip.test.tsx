import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip } from './Tooltip'

// UI/UX test: renders the component into a fake browser DOM and simulates a
// real user hovering, then asserts what they would actually see.
describe('Tooltip', () => {
    it('shows the description only while hovering the trigger', async () => {
        const user = userEvent.setup()
        render(
            <Tooltip content="Bonus action available">
                <button>Rage</button>
            </Tooltip>,
        )

        // Trigger is visible; the tooltip bubble is not shown yet.
        const trigger = screen.getByText('Rage')
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

        // Hover -> the tooltip appears with the expected text.
        await user.hover(trigger)
        expect(screen.getByRole('tooltip')).toHaveTextContent('Bonus action available')

        // Move away -> the tooltip disappears again.
        await user.unhover(trigger)
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('renders children directly when there is no description', () => {
        render(
            <Tooltip content="">
                <span>Plain</span>
            </Tooltip>,
        )
        expect(screen.getByText('Plain')).toBeInTheDocument()
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
})
