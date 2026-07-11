import { useEffect } from 'react'
import { clsx } from 'clsx'
import { type CritMode, DEFAULT_CRIT_MODE } from '../model/characterSheet'

interface GameMechanicsModalProps {
    critMode: CritMode
    onSetCritMode: (mode: CritMode) => void
    onClose: () => void
}

/** House-rule options a table can toggle without touching any character data. */
const CRIT_MODES: { value: CritMode; label: string; hint: string }[] = [
    {
        value: 'double-dice',
        label: 'Double the dice (RAW)',
        hint: 'Roll twice as many damage dice; flat modifiers are added once. The default 5e rule.',
    },
    {
        value: 'max-plus-roll',
        label: 'Max dice + a regular roll',
        hint: 'Take the maximum of the normal dice, then add a rolled set on top (plus flat modifiers once). A common house rule.',
    },
]

/**
 * "Game Mechanics" settings pane: per-sheet house rules that change how the app
 * rolls, without editing any character field. Opened from the ⋯ More menu. Today
 * it configures the critical-hit damage rule; it's built to grow more toggles.
 */
export function GameMechanicsModal({ critMode, onSetCritMode, onClose }: GameMechanicsModalProps) {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])

    const active = critMode || DEFAULT_CRIT_MODE

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Game mechanics"
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
                <header className="flex items-center gap-2 border-b border-slate-700 px-4 py-3">
                    <h2 className="m-0 flex-1 text-base font-semibold text-slate-100">Game mechanics</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800"
                        aria-label="Close"
                    >
                        Close
                    </button>
                </header>
                <div className="flex flex-col gap-4 overflow-y-auto p-4">
                    <p className="m-0 text-xs text-slate-400">
                        House rules for this sheet. They change how rolls are made — no character fields are edited.
                    </p>
                    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                        <legend className="mb-1 p-0 text-sm font-semibold text-slate-200">Critical hit damage</legend>
                        {CRIT_MODES.map((opt) => (
                            <label
                                key={opt.value}
                                className={clsx(
                                    'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors',
                                    active === opt.value
                                        ? 'border-violet-500/60 bg-violet-500/10'
                                        : 'border-slate-700 hover:bg-slate-800/60',
                                )}
                            >
                                <input
                                    type="radio"
                                    name="crit-mode"
                                    value={opt.value}
                                    checked={active === opt.value}
                                    onChange={() => onSetCritMode(opt.value)}
                                    className="mt-0.5 h-4 w-4 shrink-0 accent-violet-500"
                                />
                                <span className="flex flex-col gap-0.5">
                                    <span className="text-sm font-medium text-slate-100">{opt.label}</span>
                                    <span className="text-xs text-slate-400">{opt.hint}</span>
                                </span>
                            </label>
                        ))}
                    </fieldset>
                </div>
            </div>
        </div>
    )
}
