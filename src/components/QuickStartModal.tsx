import { useRef, useState } from 'react'
import { clsx } from 'clsx'
import type { CharacterSheet } from '../model/characterSheet'
import { parseCharacterText, type ParseResult } from '../import/parseCharacter'
import { parseCharacterJson, looksLikeDdbCharacter } from '../import/parseCharacterJson'
import { recognizeImage } from '../import/ocr'

interface QuickStartModalProps {
    onClose: () => void
    onConfirm: (sheet: CharacterSheet) => void
}

const PLACEHOLDER = `Paste text copied from your D&D Beyond character sheet — or paste the character JSON for an exact import.\n\nJSON (most accurate): open https://character-service.dndbeyond.com/character/v5/character/<id> for a public character, copy all, and paste here.\n\nText/screenshots also work (Actions, Features, and the top stat block parse best).`

export function QuickStartModal({ onClose, onConfirm }: QuickStartModalProps) {
    const [text, setText] = useState('')
    const [result, setResult] = useState<ParseResult | null>(null)
    const [ocrStatus, setOcrStatus] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    const handleParse = () => {
        const trimmed = text.trim()
        if (!trimmed) {
            setError('Add some text, paste JSON, or upload a screenshot first.')
            return
        }
        setError(null)
        // Exact path: a pasted D&D Beyond character JSON.
        if (trimmed.startsWith('{')) {
            try {
                const json: unknown = JSON.parse(trimmed)
                if (looksLikeDdbCharacter(json)) {
                    setResult(parseCharacterJson(json))
                    return
                }
            } catch {
                // Not valid JSON — fall back to the tolerant text parser.
            }
        }
        setResult(parseCharacterText(text))
    }

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return
        setError(null)
        setResult(null)
        try {
            let collected = text ? `${text}\n` : ''
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                setOcrStatus(`Reading ${file.name} (${i + 1}/${files.length})…`)
                const recognized = await recognizeImage(file, (status, progress) => {
                    setOcrStatus(`${file.name}: ${status} ${Math.round(progress * 100)}%`)
                })
                collected += `${recognized}\n`
            }
            setText(collected)
            setOcrStatus('Done. Review the text and parse.')
        } catch (err) {
            setOcrStatus(null)
            setError(
                err instanceof Error
                    ? `${err.message}. You can paste the text manually instead.`
                    : 'OCR failed. Paste the text manually instead.',
            )
        }
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
                        Paste your character <strong>JSON</strong> for an exact import, or paste text /
                        upload screenshots to extract it automatically. Then review what we detected
                        before replacing your sheet.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                        >
                            Upload screenshot(s)
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(event) => void handleFiles(event.target.files)}
                        />
                        {ocrStatus && <span className="self-center text-xs text-cyan-300">{ocrStatus}</span>}
                    </div>

                    <textarea
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        placeholder={PLACEHOLDER}
                        className="mt-3 h-48 w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                        aria-label="Character text"
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
