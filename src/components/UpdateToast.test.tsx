import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpdateToast } from './UpdateToast'

describe('UpdateToast', () => {
    it('renders nothing when hidden', () => {
        const { container } = render(
            <UpdateToast show={false} onReload={() => {}} onDismiss={() => {}} />,
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('shows the prompt and fires reload / dismiss', async () => {
        const onReload = vi.fn()
        const onDismiss = vi.fn()
        render(<UpdateToast show onReload={onReload} onDismiss={onDismiss} />)

        expect(screen.getByText(/new version is available/i)).toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
        expect(onReload).toHaveBeenCalledOnce()

        await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
        expect(onDismiss).toHaveBeenCalledOnce()
    })
})
