import { createContext, useContext } from 'react'

/** Severity of a toast — drives its accent colour and how long it lingers. */
export type ToastVariant = 'info' | 'success' | 'error'

export interface Toast {
    id: number
    message: string
    variant: ToastVariant
}

/** Fire a transient toast. `variant` defaults to `'info'`. */
export type ShowToast = (message: string, variant?: ToastVariant) => void

export const ToastContext = createContext<ShowToast | null>(null)

/** Access the `toast(message, variant?)` function. Must be called within a
 *  `ToastProvider`. */
export function useToast(): ShowToast {
    const show = useContext(ToastContext)
    if (!show) throw new Error('useToast must be used within a ToastProvider')
    return show
}
