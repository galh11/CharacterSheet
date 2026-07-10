import { clsx } from 'clsx'
import { useEffect } from 'react'
import type { FormulaResult } from '../model/formula'
import type { FieldReference, Contribution, EffectTag } from '../model/compute'
import { FormulaInput } from './FormulaInput'
import {
    type CharacterField,
    type CharacterSection,
    type FieldType,
    type SectionKind,
    type FieldEffect,
    type EffectOp,
    type ActionToggle,
    type ToggleMode,
    type ToggleDamagePart,
} from '../model/characterSheet'

interface SectionEditorModalProps {
    section: CharacterSection
    results: Map<string, FormulaResult>
    references: FieldReference[]
    /** Spendable resource/counter slugs, for the "resource to spend/refill" inputs. */
    resourceReferences?: FieldReference[]
    contributions?: Map<string, Contribution[]>
    effectTags?: Map<string, EffectTag[]>
    onClose: () => void
    onUpdateSection: (
        patch: Partial<Pick<CharacterSection, 'title' | 'description' | 'accent' | 'kind' | 'scale' | 'meta'>>,
    ) => void
    onDeleteSection: () => void
    onDuplicateSection: () => void
    onAddField: (overrides?: Partial<CharacterField>) => void
    onUpdateField: (fieldId: string, patch: Partial<CharacterField>) => void
    onDeleteField: (fieldId: string) => void
    onMoveField: (fieldId: string, direction: -1 | 1) => void
}

const FIELD_TYPES: FieldType[] = ['text', 'number', 'boolean', 'computed', 'counter', 'resource']

const SECTION_KINDS: { value: SectionKind; label: string }[] = [
    { value: 'default', label: 'List' },
    { value: 'abilities', label: 'Ability scores' },
    { value: 'hp', label: 'HP tracker' },
    { value: 'skills', label: 'Skills' },
    { value: 'actions', label: 'Actions' },
    { value: 'hitdice', label: 'Hit dice' },
    { value: 'conditions', label: 'Conditions' },
    { value: 'spellslots', label: 'Spell slots' },
    { value: 'spellcards', label: 'Spell cards' },
    { value: 'initiative', label: 'Initiative' },
    { value: 'currency', label: 'Currency' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'timers', label: 'Buff timers' },
]

/** A focused, roomy editor for a single section: its settings plus a full field
 *  editor with a live result preview for computed fields. Replaces the old
 *  global edit mode — opened per card from the pencil button. */
const EFFECT_OPS: { value: EffectOp; label: string }[] = [
    { value: 'add', label: '+ add' },
    { value: 'sub', label: '− subtract' },
    { value: 'set', label: '= set to' },
    { value: 'advantage', label: 'advantage' },
    { value: 'disadvantage', label: 'disadvantage' },
    { value: 'resist', label: 'resistance' },
    { value: 'immune', label: 'immunity' },
    { value: 'vulnerable', label: 'vulnerable' },
    { value: 'note', label: 'note' },
]

const isNumericOp = (op: EffectOp): boolean => op === 'add' || op === 'sub' || op === 'set'

/** Editor for the modifiers a field grants to other fields. Numeric effects fold
 *  into the target's value; the rest are annotation tags shown by the target. */
function EffectsEditor({
    field,
    references,
    onUpdateField,
}: {
    field: CharacterField
    references: FieldReference[]
    onUpdateField: (fieldId: string, patch: Partial<CharacterField>) => void
}) {
    const effects = field.effects ?? []
    const setEffects = (next: FieldEffect[]) => onUpdateField(field.id, { effects: next })
    const update = (index: number, patch: Partial<FieldEffect>) =>
        setEffects(effects.map((e, i) => (i === index ? { ...e, ...patch } : e)))
    const remove = (index: number) => setEffects(effects.filter((_, i) => i !== index))
    const add = () => setEffects([...effects, { target: '', op: 'add', value: '' }])

    return (
        <div className="mt-2 rounded border border-slate-800 bg-slate-950/60 p-2">
            <datalist id={`slugs-${field.id}`}>
                {references.map((r) => (
                    <option key={r.slug} value={r.slug}>
                        {r.label}
                    </option>
                ))}
            </datalist>
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300">Grants effects</span>
                {field.type !== 'boolean' ? (
                    <label className="flex items-center gap-1 text-[10px] text-slate-400" title="Turn off to unequip / suspend these effects">
                        <input
                            type="checkbox"
                            checked={field.effectsActive !== false}
                            onChange={(event) => onUpdateField(field.id, { effectsActive: event.target.checked })}
                        />
                        active
                    </label>
                ) : (
                    <span className="text-[10px] text-slate-500">active while toggled on</span>
                )}
            </div>
            {effects.length === 0 && (
                <p className="my-1 text-[10px] text-slate-500">
                    e.g. a Ring of Protection that grants <span className="font-mono">+1</span> to{' '}
                    <span className="font-mono">ac</span>.
                </p>
            )}
            <div className="mt-1 flex flex-col gap-1">
                {effects.map((effect, i) => (
                    <div key={i} className="flex items-center gap-1">
                        <select
                            value={effect.op}
                            onChange={(event) => update(i, { op: event.target.value as EffectOp })}
                            className="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-[11px] text-slate-200"
                            aria-label="Effect kind"
                        >
                            {EFFECT_OPS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                        <FormulaInput
                            value={effect.value}
                            onChange={(next) => update(i, { value: next })}
                            references={references}
                            placeholder={isNumericOp(effect.op) ? 'amount' : 'e.g. fire'}
                            className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
                            aria-label="Effect amount"
                        />
                        <span className="text-[10px] text-slate-500">→</span>
                        <input
                            list={`slugs-${field.id}`}
                            value={effect.target}
                            onChange={(event) => update(i, { target: event.target.value })}
                            placeholder="target field slug"
                            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-200"
                            aria-label="Effect target"
                        />
                        <button
                            type="button"
                            onClick={() => remove(i)}
                            className="rounded px-1 text-slate-500 hover:bg-slate-800 hover:text-rose-300"
                            aria-label="Remove effect"
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={add}
                className="mt-1 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
            >
                + effect
            </button>
        </div>
    )
}

/** Labeled inputs for an action field's core meta (to-hit, damage, resource
 *  cost…), so the editor shows friendly names instead of cryptic slugs. The
 *  `resource` flag marks inputs that point at a resource slug (not a formula), so
 *  they autocomplete spendable resources instead of formula fields. */
const ACTION_META_FIELDS: { key: string; label: string; placeholder: string; resource?: boolean }[] = [
    { key: 'hit', label: 'To-hit', placeholder: '+{str_mod + proficiency}' },
    { key: 'damage', label: 'Damage dice', placeholder: '1d8+{str_mod}' },
    { key: 'type', label: 'Damage type', placeholder: 'slashing' },
    { key: 'range', label: 'Range', placeholder: '5 ft' },
    { key: 'temp', label: 'Temp HP formula', placeholder: '{pugilist} + {con_mod}' },
    { key: 'cost', label: 'Resource cost (amount)', placeholder: '1' },
    { key: 'costField', label: 'Resource to spend (slug)', placeholder: 'moxie_points', resource: true },
    { key: 'costLabel', label: 'Resource label', placeholder: 'Moxie' },
    { key: 'refill', label: 'Refill resource (slug)', placeholder: 'ki_points', resource: true },
    { key: 'refillCost', label: 'Refill cost resource (slug)', placeholder: '', resource: true },
]

const TOGGLE_MODES: { value: ToggleMode; label: string }[] = [
    { value: 'add', label: 'add to' },
    { value: 'replace', label: 'replace' },
]

/** Labeled inputs for a spell-card field's meta (level, school, damage, the
 *  spell-slot resource its Cast button spends…). The `resource` flag marks the
 *  slot input so it autocompletes spendable resources instead of formula fields. */
const SPELL_META_FIELDS: { key: string; label: string; placeholder: string; resource?: boolean }[] = [
    { key: 'level', label: 'Spell level (0 = cantrip)', placeholder: '1' },
    { key: 'school', label: 'School', placeholder: 'Evocation' },
    { key: 'range', label: 'Range', placeholder: '60 ft' },
    { key: 'save', label: 'Save / to-hit', placeholder: 'DC {spell_save_dc} DEX' },
    { key: 'damage', label: 'Damage dice', placeholder: '3d6' },
    { key: 'type', label: 'Damage type', placeholder: 'fire' },
    { key: 'slot', label: 'Spell-slot resource to spend (slug)', placeholder: 'level_1', resource: true },
    { key: 'cost', label: 'Slots per cast', placeholder: '1' },
    { key: 'slotLabel', label: 'Slot label', placeholder: 'L1 slot' },
]

/** Editor for an action's activatable toggles — named on/off switches that add or
 *  replace the action's damage and to-hit while active (e.g. a Shillelagh that
 *  replaces the damage die, or a Flame Tongue that adds 2d6 fire). Add as many as
 *  you like. */
function ActionTogglesEditor({
    field,
    references,
    booleanReferences,
    onUpdateField,
}: {
    field: CharacterField
    references: FieldReference[]
    booleanReferences: FieldReference[]
    onUpdateField: (fieldId: string, patch: Partial<CharacterField>) => void
}) {
    const toggles = field.toggles ?? []
    const setToggles = (next: ActionToggle[]) => onUpdateField(field.id, { toggles: next })
    const update = (index: number, patch: Partial<ActionToggle>) =>
        setToggles(toggles.map((t, i) => (i === index ? { ...t, ...patch } : t)))
    const remove = (index: number) => setToggles(toggles.filter((_, i) => i !== index))
    const add = () =>
        setToggles([
            ...toggles,
            {
                id: crypto.randomUUID(),
                label: '',
                active: false,
                field: '',
                hitMode: 'add',
                hit: '',
                parts: [],
                setType: '',
                description: '',
            },
        ])
    const updatePart = (toggleIndex: number, partIndex: number, patch: Partial<ToggleDamagePart>) =>
        update(toggleIndex, {
            parts: (toggles[toggleIndex].parts ?? []).map((p, i) => (i === partIndex ? { ...p, ...patch } : p)),
        })
    const addPart = (toggleIndex: number) =>
        update(toggleIndex, { parts: [...(toggles[toggleIndex].parts ?? []), { mode: 'add', damage: '', type: '' }] })
    const removePart = (toggleIndex: number, partIndex: number) =>
        update(toggleIndex, { parts: (toggles[toggleIndex].parts ?? []).filter((_, i) => i !== partIndex) })

    return (
        <div className="mt-2 rounded border border-slate-800 bg-slate-950/60 p-2">
            <div className="text-[11px] font-semibold text-slate-300">Toggles (on/off modifiers)</div>
            {toggles.length === 0 && (
                <p className="my-1 text-[10px] text-slate-500">
                    e.g. a <span className="font-mono">Shillelagh</span> that <em>replaces</em> damage with{' '}
                    <span className="font-mono">1d8+{'{wis_mod}'}</span>, a Flame Tongue that <em>adds</em>{' '}
                    <span className="font-mono">2d6</span> fire, or one activation that adds several typed parts at once.
                    Set a <span className="font-mono">Linked</span> field to sync the on/off with a condition and other
                    cards (a bonus action, a Conditions chip).
                </p>
            )}
            <div className="mt-1 flex flex-col gap-2">
                {toggles.map((toggle, i) => (
                    <div key={toggle.id} className="rounded border border-slate-800 bg-slate-900/60 p-2">
                        <div className="flex items-center gap-1">
                            <input
                                value={toggle.label}
                                onChange={(event) => update(i, { label: event.target.value })}
                                placeholder="Toggle name (e.g. Shillelagh)"
                                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
                                aria-label="Toggle name"
                            />
                            {toggle.field ? (
                                <span className="text-[10px] text-slate-500" title="On/off follows the linked field">🔗 linked</span>
                            ) : (
                                <label className="flex items-center gap-1 text-[10px] text-slate-400" title="Start active?">
                                    <input
                                        type="checkbox"
                                        checked={toggle.active}
                                        onChange={(event) => update(i, { active: event.target.checked })}
                                    />
                                    on
                                </label>
                            )}
                            <button
                                type="button"
                                onClick={() => remove(i)}
                                className="rounded px-1 text-slate-500 hover:bg-slate-800 hover:text-rose-300"
                                aria-label="Remove toggle"
                            >
                                ✕
                            </button>
                        </div>
                        {/* Link to a boolean field so the weapon toggle, a bonus-action
                            card, and a Conditions chip all flip together. */}
                        <div className="mt-1 flex items-center gap-1">
                            <span className="w-14 text-[10px] text-slate-500" title="Bind on/off to a boolean field so every place linked to it toggles together (e.g. a Flame Tongue you can flip from the weapon or a bonus action)">Linked</span>
                            <FormulaInput
                                value={toggle.field ?? ''}
                                onChange={(next) => update(i, { field: next })}
                                references={booleanReferences}
                                placeholder="on/off field slug (optional, e.g. flame_tongue)"
                                wrapperClassName="min-w-0 flex-1"
                                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-200"
                                aria-label="Toggle linked field"
                            />
                        </div>
                        {/* Damage parts — add as many typed parts as you like. */}
                        <div className="mt-1 flex flex-col gap-1">
                            {(toggle.parts ?? []).map((part, pi) => (
                                <div key={pi} className="flex items-center gap-1">
                                    <span className="w-14 text-[10px] text-slate-500">{pi === 0 ? 'Damage' : ''}</span>
                                    <select
                                        value={part.mode}
                                        onChange={(event) => updatePart(i, pi, { mode: event.target.value as ToggleMode })}
                                        className="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-[11px] text-slate-200"
                                        aria-label="Toggle damage mode"
                                    >
                                        {TOGGLE_MODES.map((o) => (
                                            <option key={o.value} value={o.value}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                    <FormulaInput
                                        value={part.damage}
                                        onChange={(next) => updatePart(i, pi, { damage: next })}
                                        references={references}
                                        placeholder="1d8+{wis_mod}"
                                        wrapperClassName="min-w-0 flex-1"
                                        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-200"
                                        aria-label="Toggle damage dice"
                                    />
                                    <input
                                        value={part.type}
                                        onChange={(event) => updatePart(i, pi, { type: event.target.value })}
                                        placeholder="type"
                                        className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
                                        aria-label="Toggle damage type"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removePart(i, pi)}
                                        className="rounded px-1 text-slate-500 hover:bg-slate-800 hover:text-rose-300"
                                        aria-label="Remove damage part"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => addPart(i)}
                                className="self-start rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                            >
                                + damage part
                            </button>
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                            <span className="w-14 text-[10px] text-slate-500">To-hit</span>
                            <select
                                value={toggle.hitMode}
                                onChange={(event) => update(i, { hitMode: event.target.value as ToggleMode })}
                                className="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-[11px] text-slate-200"
                                aria-label="Toggle to-hit mode"
                            >
                                {TOGGLE_MODES.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                            <FormulaInput
                                value={toggle.hit}
                                onChange={(next) => update(i, { hit: next })}
                                references={references}
                                placeholder="+{wis_mod + proficiency} (leave blank for none)"
                                wrapperClassName="min-w-0 flex-1"
                                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-200"
                                aria-label="Toggle to-hit"
                            />
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                            <span className="w-14 text-[10px] text-slate-500" title="Recolour the whole attack to one damage type while active (e.g. True Strike → radiant)">Set type</span>
                            <input
                                value={toggle.setType}
                                onChange={(event) => update(i, { setType: event.target.value })}
                                placeholder="override all damage types (e.g. radiant) — optional"
                                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
                                aria-label="Toggle set damage type"
                            />
                        </div>
                        <input
                            value={toggle.description}
                            onChange={(event) => update(i, { description: event.target.value })}
                            placeholder="What does this toggle do? (hover text)"
                            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-400"
                            aria-label="Toggle description"
                        />
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={add}
                className="mt-1 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
            >
                + Add toggle
            </button>
        </div>
    )
}

export function SectionEditorModal({
    section,
    results,
    references,
    resourceReferences = [],
    onClose,
    onUpdateSection,
    onDeleteSection,
    onDuplicateSection,
    onAddField,
    onUpdateField,
    onDeleteField,
    onMoveField,
}: SectionEditorModalProps) {
    // Booleans (conditions) are technically 0/1 but rarely belong in a formula,
    // so keep them out of the autocomplete noise; users can still type a slug.
    const formulaReferences = references.filter((r) => r.kind !== 'boolean')
    // Boolean fields only, for binding a toggle's on/off to a shared condition.
    const booleanReferences = references.filter((r) => r.kind === 'boolean')
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])

    const setMeta = (field: CharacterField, key: string, value: string) =>
        onUpdateField(field.id, { meta: { ...field.meta, [key]: value } })

    const handleDelete = () => {
        if (window.confirm(`Delete the “${section.title}” section and all its fields?`)) {
            onDeleteSection()
            onClose()
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Edit ${section.title}`}
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
                <header className="flex items-center gap-2 border-b border-slate-700 px-4 py-3" style={{ borderTopColor: section.accent, borderTopWidth: 3 }}>
                    <h2 className="m-0 flex-1 text-base font-semibold text-slate-100">Edit section</h2>
                    <button
                        type="button"
                        onClick={onDuplicateSection}
                        className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                        title="Duplicate this section"
                    >
                        ⧉ Duplicate
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="rounded-md border border-rose-700/50 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/40"
                        title="Delete this section"
                    >
                        ✕ Delete
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="ml-1 rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800"
                        aria-label="Close editor"
                    >
                        Done
                    </button>
                </header>

                <div className="flex flex-col gap-4 overflow-y-auto p-4">
                    {/* Section settings */}
                    <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-950/50 p-3">
                        <label className="flex flex-col gap-1 text-xs text-slate-400">
                            Title
                            <input
                                value={section.title}
                                onChange={(event) => onUpdateSection({ title: event.target.value })}
                                className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm font-semibold text-slate-100"
                                aria-label="Section title"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-slate-400">
                            Description
                            <input
                                value={section.description}
                                onChange={(event) => onUpdateSection({ description: event.target.value })}
                                placeholder="Optional"
                                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300"
                                aria-label="Section description"
                            />
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 text-xs text-slate-400">
                                Layout
                                <select
                                    value={section.kind}
                                    onChange={(event) => onUpdateSection({ kind: event.target.value as SectionKind })}
                                    className="rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs text-slate-200"
                                    aria-label="Section layout"
                                >
                                    {SECTION_KINDS.map((k) => (
                                        <option key={k.value} value={k.value}>
                                            {k.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-400">
                                Colour
                                <input
                                    type="color"
                                    value={section.accent}
                                    onChange={(event) => onUpdateSection({ accent: event.target.value })}
                                    className="h-6 w-8 cursor-pointer rounded border border-slate-600 bg-slate-900"
                                    aria-label="Section color"
                                />
                            </label>
                            {section.kind === 'abilities' && (
                                <label className="flex items-center gap-2 text-xs text-slate-400" title="How many ability cards per row">
                                    Columns
                                    <input
                                        type="number"
                                        min={1}
                                        max={6}
                                        value={section.meta?.cols ?? '3'}
                                        onChange={(event) => onUpdateSection({ meta: { ...section.meta, cols: event.target.value } })}
                                        className="w-14 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                                        aria-label="Ability columns"
                                    />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Field editors */}
                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Fields</div>
                        {section.fields.length === 0 && (
                            <p className="text-xs italic text-slate-500">No fields yet — add one below.</p>
                        )}
                        {section.fields.map((field) => {
                            const result = results.get(field.id)
                            const computedError = field.type === 'computed' && result && !result.ok
                            return (
                                <div key={field.id} className="rounded-md border border-slate-700 bg-slate-900/60 p-2">
                                    <div className="flex items-center gap-2">
                                        <input
                                            value={field.label}
                                            onChange={(event) => onUpdateField(field.id, { label: event.target.value })}
                                            className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                                            aria-label="Field label"
                                            placeholder="Label"
                                        />
                                        <select
                                            value={field.type}
                                            onChange={(event) => onUpdateField(field.id, { type: event.target.value as FieldType })}
                                            className="rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs text-slate-200"
                                            aria-label="Field type"
                                        >
                                            {FIELD_TYPES.map((type) => (
                                                <option key={type} value={type}>
                                                    {type}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mt-2 flex items-center gap-2">
                                        {field.type === 'boolean' ? (
                                            <label className="flex items-center gap-2 text-xs text-slate-300">
                                                <input
                                                    type="checkbox"
                                                    checked={field.value === 'true'}
                                                    onChange={(event) =>
                                                        onUpdateField(field.id, { value: event.target.checked ? 'true' : 'false' })
                                                    }
                                                />
                                                Enabled
                                            </label>
                                        ) : field.type === 'computed' ? (
                                            <FormulaInput
                                                value={field.value}
                                                onChange={(next) => onUpdateField(field.id, { value: next })}
                                                references={formulaReferences}
                                                placeholder="formula e.g. floor((str-10)/2)"
                                                wrapperClassName="min-w-0 flex-1"
                                                className={clsx(
                                                    'w-full rounded border bg-slate-900 px-2 py-1 text-xs font-mono',
                                                    computedError ? 'border-rose-600 text-rose-200' : 'border-slate-600 text-slate-100',
                                                )}
                                                aria-label="Field value or formula"
                                            />
                                        ) : (
                                            <input
                                                value={field.value}
                                                onChange={(event) => onUpdateField(field.id, { value: event.target.value })}
                                                inputMode={field.type === 'number' ? 'decimal' : 'text'}
                                                placeholder="value"
                                                className={clsx(
                                                    'min-w-0 flex-1 rounded border bg-slate-900 px-2 py-1 text-xs',
                                                    'border-slate-600 text-slate-100',
                                                )}
                                                aria-label="Field value or formula"
                                            />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => onMoveField(field.id, -1)}
                                            className="rounded border border-slate-600 px-1 text-xs text-slate-300 hover:bg-slate-700"
                                            aria-label="Move field up"
                                            title="Move up"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onMoveField(field.id, 1)}
                                            className="rounded border border-slate-600 px-1 text-xs text-slate-300 hover:bg-slate-700"
                                            aria-label="Move field down"
                                            title="Move down"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDeleteField(field.id)}
                                            className="rounded border border-rose-700/50 px-1 text-xs text-rose-300 hover:bg-rose-900/40"
                                            aria-label="Delete field"
                                            title="Delete field"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    {(field.type === 'counter' || field.type === 'resource') && (
                                        <input
                                            type="number"
                                            value={field.max ?? ''}
                                            onChange={(event) =>
                                                onUpdateField(field.id, {
                                                    max: event.target.value === '' ? undefined : Number(event.target.value),
                                                })
                                            }
                                            placeholder="max (optional)"
                                            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-400"
                                            aria-label="Max value"
                                        />
                                    )}

                                    {field.type === 'resource' && (
                                        <select
                                            value={field.meta?.recharge ?? 'long'}
                                            onChange={(event) => setMeta(field, 'recharge', event.target.value)}
                                            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                                            aria-label="Recharge"
                                        >
                                            <option value="short">Recharges on short rest</option>
                                            <option value="long">Recharges on long rest</option>
                                            <option value="none">Manual only</option>
                                        </select>
                                    )}

                                    {section.kind === 'skills' && (
                                        <div className="mt-2 grid grid-cols-2 gap-1">
                                            <input
                                                value={field.meta?.ability ?? ''}
                                                onChange={(event) => setMeta(field, 'ability', event.target.value)}
                                                placeholder="ability (e.g. STR)"
                                                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                                                aria-label="Skill ability"
                                            />
                                            <select
                                                value={field.meta?.prof ?? 'none'}
                                                onChange={(event) => setMeta(field, 'prof', event.target.value)}
                                                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                                                aria-label="Proficiency"
                                            >
                                                <option value="none">not proficient</option>
                                                <option value="proficient">proficient</option>
                                                <option value="expertise">expertise</option>
                                            </select>
                                            <input
                                                value={field.meta?.adv ?? ''}
                                                onChange={(event) => setMeta(field, 'adv', event.target.value)}
                                                placeholder="advantage note (optional)"
                                                className="col-span-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                                                aria-label="Advantage"
                                            />
                                            <label className="col-span-2 flex items-center gap-2 text-[11px] text-slate-400">
                                                <input
                                                    type="checkbox"
                                                    checked={field.meta?.auto === 'true'}
                                                    onChange={(event) => setMeta(field, 'auto', event.target.checked ? 'true' : 'false')}
                                                />
                                                Auto modifier (ability + proficiency)
                                            </label>
                                        </div>
                                    )}

                                    {section.kind === 'hitdice' && (
                                        <input
                                            value={field.meta?.die ?? ''}
                                            onChange={(event) => setMeta(field, 'die', event.target.value)}
                                            placeholder="die type (e.g. d12)"
                                            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                                            aria-label="Hit die type"
                                        />
                                    )}

                                    {section.kind === 'initiative' && (
                                        <input
                                            value={field.meta?.mod ?? ''}
                                            onChange={(event) => setMeta(field, 'mod', event.target.value)}
                                            placeholder="initiative modifier (e.g. +2)"
                                            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                                            aria-label="Initiative modifier"
                                        />
                                    )}

                                    {section.kind === 'inventory' && (
                                        <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                                            <input
                                                type="checkbox"
                                                checked={!!field.meta?.coin}
                                                onChange={(event) =>
                                                    setMeta(field, 'coin', event.target.checked ? field.label.toLowerCase() : '')
                                                }
                                            />
                                            Currency coin (shown as a stepper in the coin purse)
                                        </label>
                                    )}

                                    {section.kind === 'actions' && (
                                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                                            {ACTION_META_FIELDS.map(({ key, label, placeholder, resource }) => (
                                                <label key={key} className="flex flex-col gap-0.5 text-[10px] text-slate-500">
                                                    {label}
                                                    <FormulaInput
                                                        value={field.meta?.[key] ?? ''}
                                                        onChange={(next) => setMeta(field, key, next)}
                                                        references={resource ? resourceReferences : formulaReferences}
                                                        placeholder={placeholder}
                                                        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                                                        aria-label={`Action ${label}`}
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    {section.kind === 'actions' && (
                                        <ActionTogglesEditor field={field} references={formulaReferences} booleanReferences={booleanReferences} onUpdateField={onUpdateField} />
                                    )}

                                    {section.kind === 'spellcards' && (
                                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                                            {SPELL_META_FIELDS.map(({ key, label, placeholder, resource }) => (
                                                <label key={key} className="flex flex-col gap-0.5 text-[10px] text-slate-500">
                                                    {label}
                                                    <FormulaInput
                                                        value={field.meta?.[key] ?? ''}
                                                        onChange={(next) => setMeta(field, key, next)}
                                                        references={resource ? resourceReferences : formulaReferences}
                                                        placeholder={placeholder}
                                                        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                                                        aria-label={`Spell ${label}`}
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                                        Tag colour
                                        <input
                                            type="color"
                                            value={field.meta?.color ?? '#64748b'}
                                            onChange={(event) => setMeta(field, 'color', event.target.value)}
                                            className="h-5 w-7 cursor-pointer rounded border border-slate-700 bg-slate-900"
                                            aria-label="Field tag colour"
                                        />
                                        {field.meta?.color && (
                                            <button
                                                type="button"
                                                onClick={() => setMeta(field, 'color', '')}
                                                className="rounded border border-slate-700 px-1 text-slate-400 hover:bg-slate-800"
                                            >
                                                clear
                                            </button>
                                        )}
                                    </label>

                                    <EffectsEditor field={field} references={formulaReferences} onUpdateField={onUpdateField} />

                                    {field.type === 'computed' && (
                                        <div className="mt-2 rounded border border-slate-800 bg-slate-950/60 p-2">
                                            <div className="flex items-center gap-2 text-[11px]">
                                                <span className="text-slate-500">Result =</span>
                                                {result?.ok ? (
                                                    <span className="font-mono text-emerald-300">{result.value}</span>
                                                ) : (
                                                    <span className="font-mono text-rose-300">{result?.error ?? 'enter a formula'}</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                        <button
                            type="button"
                            onClick={() => onAddField()}
                            className="mt-1 self-start rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                        >
                            + Add field
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
