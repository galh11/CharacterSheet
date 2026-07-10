import { clsx } from 'clsx'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FieldReference } from '../model/compute'
import {
    type FormulaSuggestion,
    filterReferences,
    groupSuggestions,
    isCompletable,
    tokenAtCursor,
} from '../model/formulaSuggest'

const MAX_SUGGESTIONS = 40

type PassthroughInputProps = Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'onKeyDown' | 'onSelect' | 'onClick' | 'onBlur'
>

interface FormulaInputProps extends PassthroughInputProps {
    value: string
    onChange: (value: string) => void
    references: FieldReference[]
    /** Classes for the positioning wrapper (e.g. flex sizing in a row). */
    wrapperClassName?: string
}

/** A single-line formula box with an inline, section-grouped autocomplete. As you
 *  type an identifier it lists matching field slugs — grouped under each section's
 *  bold name — and completes the token at the caret, so it works mid-formula
 *  (`1d4 + con_mod + pr…`) and inside `{expr}` interpolation alike. */
export function FormulaInput({ value, onChange, references, className, wrapperClassName, ...rest }: FormulaInputProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [cursor, setCursor] = useState(0)
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState(0)
    // Caret to restore after a programmatic insert (state update is async).
    const pendingCaret = useRef<number | null>(null)
    // The currently-highlighted option, so keyboard nav can scroll it into view.
    const activeItemRef = useRef<HTMLButtonElement>(null)

    const { token, start } = useMemo(() => tokenAtCursor(value, cursor), [value, cursor])
    const groups = useMemo(() => {
        if (!open || !isCompletable(token)) return []
        // Attach each item's position in the flattened list so keyboard nav and
        // active-row highlighting don't need any render-time mutation.
        let flatIndex = -1
        return groupSuggestions(filterReferences(references, token).slice(0, MAX_SUGGESTIONS)).map((group) => ({
            section: group.section,
            items: group.items.map((item) => {
                flatIndex += 1
                return { item, index: flatIndex }
            }),
        }))
    }, [open, token, references])
    const flat = useMemo(() => groups.flatMap((g) => g.items.map((i) => i.item)), [groups])
    const showList = groups.length > 0

    useLayoutEffect(() => {
        if (pendingCaret.current !== null && inputRef.current) {
            const pos = pendingCaret.current
            pendingCaret.current = null
            inputRef.current.setSelectionRange(pos, pos)
            setCursor(pos)
        }
    }, [value])

    // Keep the arrow-key selection visible when it moves past the scroll edge.
    useEffect(() => {
        if (showList) activeItemRef.current?.scrollIntoView?.({ block: 'nearest' })
    }, [active, showList])

    const syncCursor = () => setCursor(inputRef.current?.selectionStart ?? value.length)

    const choose = (item: FormulaSuggestion) => {
        const before = value.slice(0, start)
        const after = value.slice(cursor)
        const next = `${before}${item.slug}${after}`
        pendingCaret.current = start + item.slug.length
        onChange(next)
        setActive(0)
        setOpen(false)
    }

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showList) {
            if (event.key === 'Escape') setOpen(false)
            return
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActive((i) => (i + 1) % flat.length)
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((i) => (i - 1 + flat.length) % flat.length)
        } else if (event.key === 'Enter' || event.key === 'Tab') {
            const item = flat[active]
            if (item) {
                event.preventDefault()
                choose(item)
            }
        } else if (event.key === 'Escape') {
            event.preventDefault()
            setOpen(false)
        }
    }

    return (
        <div className={clsx('relative', wrapperClassName)}>
            <input
                {...rest}
                ref={inputRef}
                value={value}
                className={className}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                    setOpen(true)
                    setActive(0)
                    setCursor(event.target.selectionStart ?? event.target.value.length)
                    onChange(event.target.value)
                }}
                onKeyDown={onKeyDown}
                onClick={syncCursor}
                onSelect={syncCursor}
                onFocus={(event) => {
                    setOpen(true)
                    syncCursor()
                    rest.onFocus?.(event)
                }}
                onBlur={() => setOpen(false)}
            />
            {showList && (
                <ul
                    className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full min-w-48 overflow-y-auto rounded-md border border-slate-700 bg-slate-900 py-1 shadow-xl"
                    role="listbox"
                    aria-label="Field suggestions"
                >
                    {groups.map((group) => (
                        <li key={group.section}>
                            <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300">
                                {group.section}
                            </div>
                            <ul>
                                {group.items.map(({ item, index }) => {
                                    const isActive = index === active
                                    return (
                                        <li key={item.slug}>
                                            <button
                                                type="button"
                                                role="option"
                                                ref={isActive ? activeItemRef : undefined}
                                                aria-selected={isActive}
                                                // Keep focus on the input so blur doesn't close first.
                                                onMouseDown={(event) => {
                                                    event.preventDefault()
                                                    choose(item)
                                                }}
                                                className={clsx(
                                                    'flex w-full items-baseline justify-between gap-2 px-2 py-0.5 text-left text-[11px]',
                                                    isActive ? 'bg-slate-700 text-slate-100' : 'text-slate-300 hover:bg-slate-800',
                                                )}
                                                title={`${item.label} = ${item.value}`}
                                            >
                                                <span className="font-mono">{item.slug}</span>
                                                <span className="shrink-0 text-slate-500">{item.value}</span>
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
