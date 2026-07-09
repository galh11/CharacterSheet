/** A small fixed toast that appears when a newer deployed build is ready.
 *
 *  Purely presentational: it takes the update state and callbacks from
 *  `useAppUpdate` (via `App`) so it stays trivial to test. */
export interface UpdateToastProps {
    /** Whether a new build is waiting; the toast only renders when true. */
    show: boolean
    /** Reload the page onto the new build. */
    onReload: () => void
    /** Hide the toast without reloading. */
    onDismiss: () => void
}

export function UpdateToast({ show, onReload, onDismiss }: UpdateToastProps) {
    if (!show) return null
    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed bottom-4 left-4 z-50 flex max-w-xs items-center gap-3 rounded-lg border border-cyan-700 bg-slate-900/95 px-4 py-3 text-sm text-slate-200 shadow-lg"
        >
            <span>A new version is available.</span>
            <button
                type="button"
                onClick={onReload}
                className="rounded-md bg-cyan-600 px-2.5 py-1 font-medium text-white hover:bg-cyan-500"
            >
                Reload
            </button>
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss update notice"
                className="rounded-md px-1.5 py-1 text-slate-400 hover:text-slate-200"
            >
                ✕
            </button>
        </div>
    )
}
