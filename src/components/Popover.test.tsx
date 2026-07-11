import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Popover } from './Popover'

describe('Popover', () => {
    it('is closed until the trigger is clicked', async () => {
        const user = userEvent.setup()
        render(
            <Popover trigger="✐" ariaLabel="Quick edit">
                {() => <p>Panel body</p>}
            </Popover>,
        )

        expect(screen.queryByText('Panel body')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Quick edit' }))
        expect(screen.getByText('Panel body')).toBeInTheDocument()
    })

    it('closes on Escape', async () => {
        const user = userEvent.setup()
        render(
            <Popover trigger="✐" ariaLabel="Quick edit">
                {() => <p>Panel body</p>}
            </Popover>,
        )

        await user.click(screen.getByRole('button', { name: 'Quick edit' }))
        expect(screen.getByText('Panel body')).toBeInTheDocument()
        await user.keyboard('{Escape}')
        expect(screen.queryByText('Panel body')).not.toBeInTheDocument()
    })

    it('closes on an outside click', async () => {
        const user = userEvent.setup()
        render(
            <div>
                <button type="button">outside</button>
                <Popover trigger="✐" ariaLabel="Quick edit">
                    {() => <p>Panel body</p>}
                </Popover>
            </div>,
        )

        await user.click(screen.getByRole('button', { name: 'Quick edit' }))
        expect(screen.getByText('Panel body')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'outside' }))
        expect(screen.queryByText('Panel body')).not.toBeInTheDocument()
    })

    it('passes a close callback to its render function', async () => {
        const user = userEvent.setup()
        render(
            <Popover trigger="✐" ariaLabel="Quick edit">
                {(close) => (
                    <button type="button" onClick={close}>
                        done
                    </button>
                )}
            </Popover>,
        )

        await user.click(screen.getByRole('button', { name: 'Quick edit' }))
        await user.click(screen.getByRole('button', { name: 'done' }))
        expect(screen.queryByRole('button', { name: 'done' })).not.toBeInTheDocument()
    })
})
