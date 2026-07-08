import { useState } from 'react'
import { clsx } from 'clsx'
import type { CharacterSheet } from '../model/characterSheet'
import { characterSheetSchema } from '../model/characterSheet'
import { parseCharacterJson, looksLikeDdbCharacter, type ParseResult } from '../import/parseCharacterJson'

interface QuickStartModalProps {
    onClose: () => void
    onConfirm: (sheet: CharacterSheet) => void
}

const PLACEHOLDER = `Paste your D&D Beyond character JSON here for an exact import.

See the steps above to fetch it, or paste a sheet previously exported from this app.`

export function QuickStartModal({ onClose, onConfirm }: QuickStartModalProps) {
    const [text, setText] = useState('')
    const [result, setResult] = useState<ParseResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleParse = () => {
        const trimmed = text.trim()
        if (!trimmed) {
            setError('Paste your character JSON first.')
            return
        }
        setError(null)
        setResult(null)
        let json: unknown
        try {
            json = JSON.parse(trimmed)
        } catch {
            setError('That is not valid JSON. Copy the full character JSON and try again.')
            return
        }
        // A sheet exported from this app imports directly.
        const own = characterSheetSchema.safeParse(json)
        if (own.success) {
            setResult({ sheet: own.data, detected: ['This app’s own exported sheet'] })
            return
        }
        // A D&D Beyond character-service payload.
        if (looksLikeDdbCharacter(json)) {
            setResult(parseCharacterJson(json))
            return
        }
        setError('This JSON is not a D&D Beyond character or an exported sheet.')
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Quick start import"
        >
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
                <header className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
                    <h2 className="m-0 text-lg font-semibold text-slate-100">Quick start from D&amp;D Beyond</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </header>

                <div className="flex-1 overflow-auto p-5">
                    <p className="mt-0 text-sm text-slate-300">
                        Paste your character <strong>JSON</strong> for an exact import, then review what we
                        detected before replacing your sheet.
                    </p>

                    <details className="mt-3 rounded-md border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-300" open>
                        <summary className="cursor-pointer font-semibold text-slate-100">
                            How to get your character JSON from D&amp;D Beyond
                        </summary>
                        <ol className="mt-2 mb-0 list-decimal space-y-1 pl-5 text-xs text-slate-300">
                            <li>
                                Make the character <strong>public</strong>: on D&amp;D Beyond open the character,
                                then <span className="text-slate-200">Manage → Privacy</span> (or the campaign's
                                privacy settings) and set <span className="text-slate-200">Character Privacy</span>{' '}
                                to <span className="text-slate-200">Public</span>. Private characters return nothing.
                            </li>
                            <li>
                                Find the character ID — it's the number at the end of the sheet URL:{' '}
                                <code className="rounded bg-slate-800 px-1 text-slate-200">
                                    dndbeyond.com/characters/<strong>12345678</strong>
                                </code>
                                .
                            </li>
                            <li>
                                Open the JSON endpoint in your browser (swap in your ID):{' '}
                                <code className="break-all rounded bg-slate-800 px-1 text-slate-200">
                                    https://character-service.dndbeyond.com/character/v5/character/12345678
                                </code>
                                .
                            </li>
                            <li>
                                Select all (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>A</kbd>), copy, and paste it below —
                                or use your browser's <span className="text-slate-200">Save As</span> to save a{' '}
                                <code className="rounded bg-slate-800 px-1 text-slate-200">.json</code> file.
                            </li>
                        </ol>
                        <p className="mt-2 mb-0 text-xs text-slate-400">
                            You can also paste a sheet you previously exported from this app.
                        </p>
                    </details>

                    <textarea
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        placeholder={PLACEHOLDER}
                        className="mt-3 h-56 w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
                        aria-label="Character JSON"
                    />

                    {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}

                    {result && (
                        <div className="mt-4 rounded-md border border-slate-700 bg-slate-950/60 p-3">
                            <h3 className="m-0 text-sm font-semibold text-slate-100">Detected</h3>
                            {result.detected.length > 0 ? (
                                <ul className="mt-1 mb-2 list-disc pl-5 text-xs text-slate-300">
                                    {result.detected.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-1 mb-2 text-xs text-slate-400">
                                    Nothing auto-detected — we'll create an editable notes section.
                                </p>
                            )}
                            <p className="m-0 text-xs text-slate-400">
                                {result.sheet.sections.length} section(s) ·{' '}
                                {result.sheet.sections.reduce((n, s) => n + s.fields.length, 0)} field(s)
                            </p>
                        </div>
                    )}
                </div>

                <footer className="flex items-center justify-end gap-2 border-t border-slate-700 px-5 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleParse}
                        className="rounded-md bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600"
                    >
                        Parse
                    </button>
                    <button
                        type="button"
                        disabled={!result}
                        onClick={() => result && onConfirm(result.sheet)}
                        className={clsx(
                            'rounded-md px-3 py-1.5 text-sm font-medium',
                            result
                                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                                : 'cursor-not-allowed bg-slate-800 text-slate-500',
                        )}
                    >
                        Replace my sheet
                    </button>
                </footer>
            </div>
        </div>
    )
}
