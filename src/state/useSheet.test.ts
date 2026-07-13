import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSheet } from './useSheet'

describe('useSheet', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('starts from the persisted (or starter) sheet', () => {
        const { result } = renderHook(() => useSheet())
        expect(result.current.sheet.sections.length).toBeGreaterThan(0)
    })

    it('renames the sheet', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.renameSheet('Frodo'))
        expect(result.current.sheet.name).toBe('Frodo')
    })

    it('sets and clears the portrait', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.setPortrait('data:image/jpeg;base64,abc'))
        expect(result.current.sheet.portrait).toBe('data:image/jpeg;base64,abc')
        act(() => result.current.setPortrait(undefined))
        expect(result.current.sheet.portrait).toBeUndefined()
    })

    it('adds and deletes sections', () => {
        const { result } = renderHook(() => useSheet())
        const before = result.current.sheet.sections.length

        act(() => result.current.addSection())
        expect(result.current.sheet.sections).toHaveLength(before + 1)

        const lastId = result.current.sheet.sections.at(-1)!.id
        act(() => result.current.deleteSection(lastId))
        expect(result.current.sheet.sections).toHaveLength(before)
    })

    it('reorders sections with moveSection (drag-to-reorder) and is undoable', () => {
        const { result } = renderHook(() => useSheet())
        const ids = result.current.sheet.sections.map((s) => s.id)
        expect(ids.length).toBeGreaterThanOrEqual(2)
        const [first, second] = ids

        // Drop the second section onto the first → it lands before it.
        act(() => result.current.moveSection(second, first))
        expect(result.current.sheet.sections.map((s) => s.id).slice(0, 2)).toEqual([second, first])

        // Dropping a section on itself is a no-op.
        act(() => result.current.moveSection(second, second))
        expect(result.current.sheet.sections.map((s) => s.id).slice(0, 2)).toEqual([second, first])

        // An omitted target moves the source to the end.
        act(() => result.current.moveSection(second))
        expect(result.current.sheet.sections.at(-1)!.id).toBe(second)

        // The reorder is a single undoable step back to the original order.
        act(() => result.current.undo())
        act(() => result.current.undo())
        expect(result.current.sheet.sections.map((s) => s.id).slice(0, 2)).toEqual([first, second])
    })

    it('adds, updates, and deletes a field', () => {
        const { result } = renderHook(() => useSheet())
        const sectionId = result.current.sheet.sections[0].id

        act(() => result.current.addField(sectionId, { label: 'Temp' }))
        const field = result.current.sheet.sections[0].fields.at(-1)!
        expect(field.label).toBe('Temp')

        act(() => result.current.updateField(sectionId, field.id, { label: 'Renamed' }))
        expect(
            result.current.sheet.sections[0].fields.find((f) => f.id === field.id)?.label,
        ).toBe('Renamed')

        act(() => result.current.deleteField(sectionId, field.id))
        expect(
            result.current.sheet.sections[0].fields.some((f) => f.id === field.id),
        ).toBe(false)
    })

    it('reorders fields with moveField', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.addSection())
        const sectionId = result.current.sheet.sections.at(-1)!.id

        act(() => result.current.addField(sectionId, { label: 'First' }))
        act(() => result.current.addField(sectionId, { label: 'Second' }))
        const second = result.current.sheet.sections.find((s) => s.id === sectionId)!.fields.at(-1)!

        act(() => result.current.moveField(sectionId, second.id, -1))
        const labels = result.current.sheet.sections
            .find((s) => s.id === sectionId)!
            .fields.map((f) => f.label)
        expect(labels).toEqual(['Second', 'First'])
    })

    it('moves a field to another section with moveFieldToSection', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.addSection())
        act(() => result.current.addSection())
        const fromId = result.current.sheet.sections.at(-2)!.id
        const toId = result.current.sheet.sections.at(-1)!.id

        act(() => result.current.addField(fromId, { label: 'Wanderer' }))
        const field = result.current.sheet.sections.find((s) => s.id === fromId)!.fields.at(-1)!

        act(() => result.current.moveFieldToSection(fromId, field.id, toId))

        const from = result.current.sheet.sections.find((s) => s.id === fromId)!
        const to = result.current.sheet.sections.find((s) => s.id === toId)!
        expect(from.fields.some((f) => f.id === field.id)).toBe(false)
        expect(to.fields.at(-1)!.id).toBe(field.id)
        expect(to.fields.at(-1)!.label).toBe('Wanderer')

        // Undoable in one step.
        act(() => result.current.undo())
        expect(result.current.sheet.sections.find((s) => s.id === fromId)!.fields.some((f) => f.id === field.id)).toBe(true)
    })

    it('autosaves changes to localStorage', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.renameSheet('Saved Hero'))
        const raw = localStorage.getItem(`character-sheet:char:${result.current.activeId}`)
        expect(raw).not.toBeNull()
        expect(JSON.parse(raw!).sheet.name).toBe('Saved Hero')
    })

    it('creates, switches between, and deletes characters', () => {
        const { result } = renderHook(() => useSheet())
        const firstId = result.current.activeId
        act(() => result.current.newCharacter())
        const secondId = result.current.activeId
        expect(secondId).not.toBe(firstId)
        expect(result.current.characters).toHaveLength(2)

        act(() => result.current.switchCharacter(firstId))
        expect(result.current.activeId).toBe(firstId)

        act(() => result.current.deleteCharacter(secondId))
        expect(result.current.characters.some((c) => c.id === secondId)).toBe(false)
        expect(result.current.characters).toHaveLength(1)
    })

    it('duplicates the active character with a copied name', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.renameSheet('Original'))
        const firstId = result.current.activeId
        act(() => result.current.duplicateCharacter())
        expect(result.current.activeId).not.toBe(firstId)
        expect(result.current.sheet.name).toBe('Original copy')
        expect(result.current.characters).toHaveLength(2)
    })

    it('undoes and redoes a change', () => {
        const { result } = renderHook(() => useSheet())
        const original = result.current.sheet.name
        expect(result.current.canUndo).toBe(false)

        act(() => result.current.renameSheet('Aragorn'))
        expect(result.current.sheet.name).toBe('Aragorn')
        expect(result.current.canUndo).toBe(true)

        act(() => result.current.undo())
        expect(result.current.sheet.name).toBe(original)
        expect(result.current.canRedo).toBe(true)

        act(() => result.current.redo())
        expect(result.current.sheet.name).toBe('Aragorn')
    })

    it('clears the redo stack after a new change', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.renameSheet('A'))
        act(() => result.current.undo())
        expect(result.current.canRedo).toBe(true)
        act(() => result.current.renameSheet('B'))
        expect(result.current.canRedo).toBe(false)
    })

    it('duplicates a section with fresh ids after the original', () => {
        const { result } = renderHook(() => useSheet())
        const first = result.current.sheet.sections[0]
        const count = result.current.sheet.sections.length

        act(() => result.current.duplicateSection(first.id))

        const sections = result.current.sheet.sections
        expect(sections).toHaveLength(count + 1)
        const clone = sections[1]
        expect(clone.title).toBe(`${first.title} copy`)
        expect(clone.id).not.toBe(first.id)
        expect(clone.fields[0]?.id).not.toBe(first.fields[0]?.id)
        expect(clone.layout.x).toBe(first.layout.x + 24)
    })

    it('deletes several sections in one undoable step (bulk action)', () => {
        const { result } = renderHook(() => useSheet())
        const ids = result.current.sheet.sections.slice(0, 2).map((s) => s.id)
        const before = result.current.sheet.sections.length
        expect(ids.length).toBe(2)

        act(() => result.current.deleteSections(ids))
        expect(result.current.sheet.sections).toHaveLength(before - 2)
        expect(result.current.sheet.sections.some((s) => ids.includes(s.id))).toBe(false)

        // A single undo restores both sections.
        act(() => result.current.undo())
        expect(result.current.sheet.sections).toHaveLength(before)

        // An empty id list is a no-op (no history entry).
        act(() => result.current.deleteSections([]))
        expect(result.current.sheet.sections).toHaveLength(before)
    })

    it('duplicates several sections in one undoable step (bulk action)', () => {
        const { result } = renderHook(() => useSheet())
        const originals = result.current.sheet.sections.slice(0, 2)
        const ids = originals.map((s) => s.id)
        const before = result.current.sheet.sections.length

        act(() => result.current.duplicateSections(ids))
        expect(result.current.sheet.sections).toHaveLength(before + 2)
        // Each clone sits just after its original with a fresh id and copied name.
        const after = result.current.sheet.sections
        expect(after[1].title).toBe(`${originals[0].title} copy`)
        expect(after[1].id).not.toBe(originals[0].id)

        // A single undo removes both clones.
        act(() => result.current.undo())
        expect(result.current.sheet.sections).toHaveLength(before)
    })

    it('recolours several sections in one undoable step (bulk action)', () => {
        const { result } = renderHook(() => useSheet())
        const ids = result.current.sheet.sections.slice(0, 2).map((s) => s.id)

        act(() => result.current.recolorSections(ids, '#123456'))
        for (const id of ids) {
            expect(result.current.sheet.sections.find((s) => s.id === id)?.accent).toBe('#123456')
        }

        act(() => result.current.undo())
        expect(result.current.sheet.sections.find((s) => s.id === ids[0])?.accent).not.toBe('#123456')
    })

    const restSheet = () => ({
        id: 's',
        name: 'T',
        sections: [
            {
                id: 'sec',
                title: 'X',
                description: '',
                accent: '#000',
                kind: 'default' as const,
                scale: 1,
                layout: { x: 0, y: 0, w: 1, h: 1 },
                fields: [
                    { id: 'hp', label: 'Current HP', type: 'number' as const, value: '3', description: '' },
                    { id: 'mx', label: 'Max HP', type: 'number' as const, value: '20', description: '' },
                    { id: 'tmp', label: 'Temp HP', type: 'number' as const, value: '5', description: '' },
                    { id: 'ex', label: 'Exhaustion', type: 'counter' as const, value: '2', description: '' },
                    { id: 'mox', label: 'Moxie', type: 'resource' as const, value: '1', max: 5, description: '', meta: { recharge: 'short' } },
                    { id: 'luck', label: 'Luck', type: 'resource' as const, value: '0', max: 3, description: '', meta: { recharge: 'long' } },
                ],
            },
        ],
    })
    const fieldVal = (api: ReturnType<typeof useSheet>, id: string) =>
        api.sheet.sections[0].fields.find((f) => f.id === id)?.value

    it('long rest restores HP, clears temp, reduces exhaustion, and refills resources', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.replaceSheet(restSheet()))
        act(() => result.current.rest('long'))
        expect(fieldVal(result.current, 'hp')).toBe('20')
        expect(fieldVal(result.current, 'tmp')).toBe('0')
        expect(fieldVal(result.current, 'ex')).toBe('1')
        expect(fieldVal(result.current, 'mox')).toBe('5')
        expect(fieldVal(result.current, 'luck')).toBe('3')
    })

    it('short rest only refills short-rest resources and leaves HP alone', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.replaceSheet(restSheet()))
        act(() => result.current.rest('short'))
        expect(fieldVal(result.current, 'mox')).toBe('5') // short → refilled
        expect(fieldVal(result.current, 'luck')).toBe('0') // long → unchanged
        expect(fieldVal(result.current, 'hp')).toBe('3') // HP untouched
        expect(fieldVal(result.current, 'tmp')).toBe('5')
    })

    it('refills a resource whose max is a formula to the resolved value', () => {
        const sheet = {
            id: 's',
            name: 'T',
            sections: [
                {
                    id: 'sec',
                    title: 'X',
                    description: '',
                    accent: '#000',
                    kind: 'default' as const,
                    scale: 1,
                    layout: { x: 0, y: 0, w: 1, h: 1 },
                    fields: [
                        { id: 'prof', label: 'Proficiency', type: 'number' as const, value: '3', description: '' },
                        { id: 'tumble', label: "Hill's Tumble", type: 'resource' as const, value: '0', maxFormula: 'proficiency', description: '', meta: { recharge: 'long' } },
                    ],
                },
            ],
        }
        const { result } = renderHook(() => useSheet())
        act(() => result.current.replaceSheet(sheet))
        act(() => result.current.rest('long'))
        const tumble = result.current.sheet.sections[0].fields.find((f) => f.id === 'tumble')
        expect(tumble?.value).toBe('3')
    })

    it('heals current HP up to max', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.replaceSheet(restSheet()))
        act(() => result.current.healHp(5))
        expect(fieldVal(result.current, 'hp')).toBe('8')
        act(() => result.current.healHp(100))
        expect(fieldVal(result.current, 'hp')).toBe('20')
    })

    it('damageHp absorbs temp HP first, then reduces current HP, flooring at 0', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.replaceSheet(restSheet()))
        act(() => result.current.damageHp(4))
        expect(fieldVal(result.current, 'tmp')).toBe('1') // 5 temp absorbs 4
        expect(fieldVal(result.current, 'hp')).toBe('3') // current untouched
        act(() => result.current.damageHp(4))
        expect(fieldVal(result.current, 'tmp')).toBe('0') // last 1 temp absorbed
        expect(fieldVal(result.current, 'hp')).toBe('0') // remaining 3 floors at 0
    })

    const recoverySheet = () => ({
        id: 's',
        name: 'T',
        sections: [
            {
                id: 'hd',
                title: 'Hit Dice',
                description: '',
                accent: '#000',
                kind: 'hitdice' as const,
                scale: 1,
                layout: { x: 0, y: 0, w: 1, h: 1 },
                fields: [{ id: 'd12', label: 'd12', type: 'resource' as const, value: '1', max: 5, description: '' }],
            },
            {
                id: 'sl',
                title: 'Spell Slots',
                description: '',
                accent: '#000',
                kind: 'spellslots' as const,
                scale: 1,
                layout: { x: 0, y: 0, w: 1, h: 1 },
                fields: [{ id: 'l1', label: '1st', type: 'resource' as const, value: '0', max: 4, description: '' }],
            },
            {
                id: 'hp',
                title: 'Hit Points',
                description: '',
                accent: '#000',
                kind: 'hp' as const,
                scale: 1,
                meta: { deathSuccesses: '2', deathFailures: '1' },
                layout: { x: 0, y: 0, w: 1, h: 1 },
                fields: [
                    { id: 'cur', label: 'Current HP', type: 'number' as const, value: '0', description: '' },
                    { id: 'maxhp', label: 'Max HP', type: 'number' as const, value: '30', description: '' },
                ],
            },
        ],
    })
    const findVal = (api: ReturnType<typeof useSheet>, id: string) => {
        for (const s of api.sheet.sections) {
            const f = s.fields.find((x) => x.id === id)
            if (f) return f.value
        }
        return undefined
    }
    const hpMeta = (api: ReturnType<typeof useSheet>) =>
        api.sheet.sections.find((s) => s.kind === 'hp')?.meta

    it('long rest refills hit dice and spell slots and clears death saves', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.replaceSheet(recoverySheet()))
        act(() => result.current.rest('long'))
        expect(findVal(result.current, 'd12')).toBe('5')
        expect(findVal(result.current, 'l1')).toBe('4')
        expect(findVal(result.current, 'cur')).toBe('30')
        expect(hpMeta(result.current)?.deathSuccesses).toBe('0')
        expect(hpMeta(result.current)?.deathFailures).toBe('0')
    })

    it('healing above 0 HP clears recorded death saves', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.replaceSheet(recoverySheet()))
        act(() => result.current.healHp(5))
        expect(findVal(result.current, 'cur')).toBe('5')
        expect(hpMeta(result.current)?.deathSuccesses).toBe('0')
        expect(hpMeta(result.current)?.deathFailures).toBe('0')
    })

    it('short rest leaves hit dice and spell slots untouched', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.replaceSheet(recoverySheet()))
        act(() => result.current.rest('short'))
        expect(findVal(result.current, 'd12')).toBe('1')
        expect(findVal(result.current, 'l1')).toBe('0')
    })

    it('spendResource decrements the matching resource, clamped at zero', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.replaceSheet(restSheet()))
        act(() => result.current.spendResource('moxie', 1))
        expect(fieldVal(result.current, 'mox')).toBe('0')
        act(() => result.current.spendResource('luck', 1)) // luck is already 0
        expect(fieldVal(result.current, 'luck')).toBe('0')
    })

    it('applyTempHp keeps the larger value (temp HP does not stack)', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.replaceSheet(restSheet())) // temp starts at 5
        act(() => result.current.applyTempHp(3))
        expect(fieldVal(result.current, 'tmp')).toBe('5')
        act(() => result.current.applyTempHp(10))
        expect(fieldVal(result.current, 'tmp')).toBe('10')
    })

    it('restoreResource refills a resource to max and adds one to the cost counter', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.replaceSheet(restSheet())) // moxie 1/5, exhaustion 2
        act(() => result.current.restoreResource('moxie', 'exhaustion'))
        expect(fieldVal(result.current, 'mox')).toBe('5')
        expect(fieldVal(result.current, 'ex')).toBe('3')
    })

    it('restoreResource works without a cost counter', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.replaceSheet(restSheet()))
        act(() => result.current.restoreResource('moxie'))
        expect(fieldVal(result.current, 'mox')).toBe('5')
        expect(fieldVal(result.current, 'ex')).toBe('2')
    })

    it('addTemplateSection appends a section with the template kind and fields', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.replaceSheet(restSheet()))
        const before = result.current.sheet.sections.length
        act(() =>
            result.current.addTemplateSection({
                id: 'timers',
                label: 'Buff timers',
                title: 'Buff Timers',
                kind: 'timers',
                fields: [],
            }),
        )
        const sections = result.current.sheet.sections
        expect(sections.length).toBe(before + 1)
        expect(sections[sections.length - 1].kind).toBe('timers')
        expect(sections[sections.length - 1].title).toBe('Buff Timers')
    })

    it('toggleField flips the matching boolean flag by slug', () => {
        const { result } = renderHook(() => useSheet())
        act(() =>
            result.current.replaceSheet({
                id: 's',
                name: 'T',
                sections: [
                    {
                        id: 'sec',
                        title: 'Conditions',
                        description: '',
                        accent: '#000',
                        kind: 'conditions' as const,
                        scale: 1,
                        layout: { x: 0, y: 0, w: 1, h: 1 },
                        fields: [{ id: 'ft', label: 'Flame Tongue', type: 'boolean' as const, value: 'false', description: '' }],
                    },
                ],
            }),
        )
        act(() => result.current.toggleField('flame_tongue'))
        expect(result.current.sheet.sections[0].fields[0].value).toBe('true')
        act(() => result.current.toggleField('flame_tongue'))
        expect(result.current.sheet.sections[0].fields[0].value).toBe('false')
    })

    it('setSectionLayouts applies many layouts in one undo step', () => {
        const { result } = renderHook(() => useSheet())
        const first = result.current.sheet.sections[0].id
        const second = result.current.sheet.sections[1].id
        act(() =>
            result.current.setSectionLayouts([
                { id: first, layout: { x: 10, y: 20, w: 200, h: 100 } },
                { id: second, layout: { x: 220, y: 20, w: 200, h: 100 } },
            ]),
        )
        expect(result.current.sheet.sections[0].layout).toMatchObject({ x: 10, y: 20 })
        expect(result.current.sheet.sections[1].layout).toMatchObject({ x: 220, y: 20 })
        // A single undo reverts both moves together.
        act(() => result.current.undo())
        expect(result.current.sheet.sections[0].layout.x).not.toBe(10)
    })

    it('setFieldValueSilent updates without adding undo history', () => {
        const { result } = renderHook(() => useSheet())
        act(() => result.current.replaceSheet(restSheet())) // 1 undo step
        act(() => result.current.setFieldValueSilent('tmp', '7'))
        expect(fieldVal(result.current, 'tmp')).toBe('7')
        // A single undo reverts the replaceSheet — the silent edit added no step.
        act(() => result.current.undo())
        expect(result.current.canUndo).toBe(false)
    })
})
