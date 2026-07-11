import { describe, expect, it, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster, ToastProvider } from './Toast'
import { useToast, type ToastVariant } from './toastContext'

/** A tiny harness that fires a toast on button click via the hook. */
function Harness({ message, variant }: { message: string; variant?: ToastVariant }) {
    const toast = useToast()
    return (
        <button type="button" onClick={() => toast(message, variant)}>
            fire
        </button>
    )
}

describe('Toaster', () => {
    it('renders nothing when there are no toasts', () => {
        const { container } = render(<Toaster toasts={[]} onDismiss={() => {}} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders each toast and dismisses on ✕', async () => {
        const onDismiss = vi.fn()
        render(
            <Toaster
                toasts={[{ id: 1, message: 'Hello', variant: 'info' }]}
                onDismiss={onDismiss}
            />,
        )
        expect(screen.getByText('Hello')).toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
        expect(onDismiss).toHaveBeenCalledWith(1)
    })
})

describe('useToast', () => {
    it('throws when used outside a ToastProvider', () => {
        // Silence the expected React error boundary log.
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        expect(() => render(<Harness message="x" />)).toThrow(/ToastProvider/)
        spy.mockRestore()
    })
})

describe('ToastProvider', () => {
    it('shows a fired toast and auto-dismisses it', () => {
        vi.useFakeTimers()
        try {
            render(
                <ToastProvider>
                    <Harness message="Saved" variant="success" />
                </ToastProvider>,
            )
            act(() => {
                fireEvent.click(screen.getByRole('button', { name: 'fire' }))
            })
            expect(screen.getByText('Saved')).toBeInTheDocument()

            act(() => {
                vi.advanceTimersByTime(4000)
            })
            expect(screen.queryByText('Saved')).not.toBeInTheDocument()
        } finally {
            vi.useRealTimers()
        }
    })
})
