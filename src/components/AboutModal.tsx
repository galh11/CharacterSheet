import { useEffect } from 'react'
import { APP_VERSION, BUILD_TIME, CHANGELOG, REPO_URL, prUrl } from '../version'

interface AboutModalProps {
    onClose: () => void
}

/** "What's new" panel opened from the ⋯ More menu: shows the running app
 *  version, when this build was made, and the full changelog with a link to the
 *  pull request behind each release. */
export function AboutModal({ onClose }: AboutModalProps) {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])

    const built = new Date(BUILD_TIME)
    const builtLabel = Number.isNaN(built.getTime()) ? BUILD_TIME : built.toLocaleString()

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="About this app"
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
                <header className="flex items-center gap-2 border-b border-slate-700 px-4 py-3">
                    <h2 className="m-0 flex-1 text-base font-semibold text-slate-100">
                        What's new{' '}
                        <span className="ml-1 font-mono text-sm font-normal text-slate-400">v{APP_VERSION}</span>
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800"
                        aria-label="Close"
                    >
                        Close
                    </button>
                </header>
                <div className="flex flex-col gap-3 overflow-y-auto p-4">
                    <p className="m-0 text-xs text-slate-400">
                        Built {builtLabel}.{' '}
                        <a
                            href={REPO_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 underline decoration-dotted hover:text-cyan-300"
                        >
                            Source on GitHub
                        </a>
                    </p>
                    <ol className="m-0 flex list-none flex-col gap-2 p-0">
                        {CHANGELOG.map((entry) => (
                            <li
                                key={entry.version}
                                className="rounded-lg border border-slate-700 bg-slate-950/50 p-3"
                            >
                                <div className="flex items-baseline gap-2">
                                    <span className="font-mono text-sm font-semibold text-slate-100">
                                        v{entry.version}
                                    </span>
                                    <span className="text-xs text-slate-500">{entry.date}</span>
                                    {entry.pr != null && (
                                        <a
                                            href={prUrl(entry.pr)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-auto rounded bg-slate-800 px-1.5 py-0.5 text-xs text-cyan-400 hover:bg-slate-700"
                                            title="Open the pull request on GitHub"
                                        >
                                            #{entry.pr}
                                        </a>
                                    )}
                                </div>
                                <p className="m-0 mt-1 text-sm text-slate-300">{entry.summary}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </div>
    )
}
