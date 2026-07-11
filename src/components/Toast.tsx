import { clsx } from 'clsx'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ShowToast, type Toast, type ToastVariant } from './toastContext'

/** How long (ms) each variant stays before auto-dismissing. Errors linger so a
 *  failure isn't missed; neutral/success confirmations clear quickly. */
const TIMEOUT: Record<ToastVariant, number> = {
    info: 3500,
    success: 3500,
    error: 6000,
}

/** Holds the live toast queue, exposes `toast(...)` via context, and renders the
 *  floating `Toaster` stack alongside its children. Wrap the app once. */
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])
    const nextId = useRef(0)

    const dismiss = useCallback((id: number) => {
        setToasts((list) => list.filter((t) => t.id !== id))
    }, [])

    const show = useCallback<ShowToast>(
        (message, variant = 'info') => {
            const id = nextId.current++
            setToasts((list) => [...list, { id, message, variant }])
            setTimeout(() => dismiss(id), TIMEOUT[variant])
        },
        [dismiss],
    )

    return (
        <ToastContext.Provider value={show}>
            {children}
            <Toaster toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    )
}

/** Border accent per variant (matches the app's cyan/emerald/rose palette). */
const VARIANT_STYLE: Record<ToastVariant, string> = {
    info: 'border-cyan-700',
    success: 'border-emerald-700',
    error: 'border-rose-700',
}

/** Presentational stack of the current toasts (bottom-centre, above the canvas).
 *  Renders nothing when empty so it never affects the resting layout. */
export function Toaster({
    toasts,
    onDismiss,
}: {
    toasts: Toast[]
    onDismiss: (id: number) => void
}) {
    if (toasts.length === 0) return null
    return (
        <div
            className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 print:hidden"
            aria-live="polite"
        >
            {toasts.map((t) => (
                <div
                    key={t.id}
                    role="status"
                    className={clsx(
                        'pointer-events-auto flex max-w-sm items-center gap-3 rounded-lg border bg-slate-900/95 px-4 py-3 text-sm text-slate-200 shadow-lg backdrop-blur',
                        VARIANT_STYLE[t.variant],
                    )}
                >
                    <span className="min-w-0 flex-1">{t.message}</span>
                    <button
                        type="button"
                        onClick={() => onDismiss(t.id)}
                        aria-label="Dismiss notification"
                        className="rounded-md px-1.5 py-1 leading-none text-slate-400 hover:text-slate-200"
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    )
}
