import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SectionBody } from './SectionBody'
import type { CharacterField, CharacterSection } from '../model/characterSheet'

const actionsSection = (fields: CharacterField[]): CharacterSection => ({
    id: 's',
    title: 'Attacks',
    description: '',
    accent: '#000',
    kind: 'actions',
    scale: 1,
    fields,
    layout: { x: 0, y: 0, w: 1, h: 1 },
})

const field = (overrides: Partial<CharacterField>): CharacterField => ({
    id: 'f',
    label: 'Action',
    type: 'text',
    value: '',
    description: '',
    ...overrides,
})

describe('ActionCards', () => {
    it('interpolates hit from the scope and rolls an attack', () => {
        const onRoll = vi.fn()
        const section = actionsSection([
            field({ id: 'a', label: 'Punch', meta: { hit: '+{str_mod + proficiency}', damage: '1d10+{str_mod}', type: 'bludgeoning' } }),
        ])
        render(
            <SectionBody
                section={section}
                results={new Map()}
                onUpdateField={() => { }}
                scope={{ str_mod: 5, proficiency: 3 }}
                onRoll={onRoll}
            />,
        )
        expect(screen.getByText('+8')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Attack/ }))
        expect(onRoll).toHaveBeenCalledWith(expect.objectContaining({ kind: 'attack' }))
    })

    it('spends a resource when the cost button is clicked', () => {
        const onSpend = vi.fn()
        const section = actionsSection([
            field({ id: 'h', label: 'Haymaker', meta: { cost: '1', costField: 'moxie_points', costLabel: 'Moxie' } }),
        ])
        render(
            <SectionBody
                section={section}
                results={new Map()}
                onUpdateField={() => { }}
                scope={{ moxie_points: 3 }}
                onRoll={() => { }}
                onSpend={onSpend}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Moxie/ }))
        expect(onSpend).toHaveBeenCalledWith('moxie_points', 1)
    })

    it('applies an active toggle that replaces the base damage and to-hit', () => {
        const section = actionsSection([
            field({
                id: 'f',
                label: 'Quarterstaff',
                meta: { hit: '+{str_mod + proficiency}', damage: '1d6+{str_mod}', type: 'bludgeoning' },
                toggles: [
                    {
                        id: 't',
                        label: 'Shillelagh',
                        active: true,
                        hitMode: 'replace',
                        hit: '+{wis_mod + proficiency}',
                        setType: '',
                        parts: [{ mode: 'replace', damage: '1d8+{wis_mod}', type: 'bludgeoning' }],
                        description: '',
                    },
                ],
            }),
        ])
        render(
            <SectionBody
                section={section}
                results={new Map()}
                onUpdateField={() => { }}
                scope={{ str_mod: 2, wis_mod: 4, proficiency: 3 }}
                onRoll={() => { }}
            />,
        )
        // Damage die and to-hit reflect the toggle's replacements, not the base weapon.
        expect(screen.getByText(/1d8\+4/)).toBeInTheDocument()
        expect(screen.getByText('+7')).toBeInTheDocument()
    })

    it('adds an extra damage part for an active add-mode toggle', () => {
        const section = actionsSection([
            field({
                id: 'f',
                label: 'Handaxe',
                meta: { damage: '1d6', type: 'slashing' },
                toggles: [
                    { id: 't', label: 'Flame Tongue', active: true, hitMode: 'add', hit: '', setType: '', parts: [{ mode: 'add', damage: '2d6', type: 'fire' }], description: '' },
                ],
            }),
        ])
        render(<SectionBody section={section} results={new Map()} onUpdateField={() => { }} scope={{}} onRoll={() => { }} />)
        // Base slashing part stays and the fire part is added alongside it.
        expect(screen.getByText(/1d6 slashing/)).toBeInTheDocument()
        expect(screen.getByText(/2d6 fire/)).toBeInTheDocument()
    })

    it('adds several typed damage parts from one toggle', () => {
        const section = actionsSection([
            field({
                id: 'f',
                label: 'Booming Blade Sword',
                meta: { damage: '1d8', type: 'slashing' },
                toggles: [
                    {
                        id: 't',
                        label: 'Empowered Strike',
                        active: true,
                        hitMode: 'add',
                        hit: '',
                        setType: '',
                        parts: [
                            { mode: 'add', damage: '1d8', type: 'thunder' },
                            { mode: 'add', damage: '1d6', type: 'cold' },
                            { mode: 'add', damage: '1d6', type: 'radiant' },
                        ],
                        description: '',
                    },
                ],
            }),
        ])
        render(<SectionBody section={section} results={new Map()} onUpdateField={() => { }} scope={{}} onRoll={() => { }} />)
        expect(screen.getByText(/1d8 thunder/)).toBeInTheDocument()
        expect(screen.getByText(/1d6 cold/)).toBeInTheDocument()
        expect(screen.getByText(/1d6 radiant/)).toBeInTheDocument()
    })

    it('recolours the whole attack to one type via setType', () => {
        const section = actionsSection([
            field({
                id: 'f',
                label: 'True Strike Blade',
                meta: { damage: '1d8', type: 'slashing' },
                toggles: [
                    { id: 't', label: 'True Strike', active: true, hitMode: 'add', hit: '', setType: 'radiant', parts: [], description: '' },
                ],
            }),
        ])
        render(<SectionBody section={section} results={new Map()} onUpdateField={() => { }} scope={{}} onRoll={() => { }} />)
        // The base slashing damage is recoloured radiant while the toggle is on.
        expect(screen.getByText(/1d8 radiant/)).toBeInTheDocument()
        expect(screen.queryByText(/slashing/)).toBeNull()
    })

    it('flips a toggle active state via onUpdateField', () => {
        const onUpdateField = vi.fn()
        const section = actionsSection([
            field({
                id: 'f',
                label: 'Handaxe',
                meta: { damage: '1d6', type: 'slashing' },
                toggles: [
                    { id: 't', label: 'Flame Tongue', active: false, hitMode: 'add', hit: '', setType: '', parts: [{ mode: 'add', damage: '2d6', type: 'fire' }], description: '' },
                ],
            }),
        ])
        render(<SectionBody section={section} results={new Map()} onUpdateField={onUpdateField} scope={{}} onRoll={() => { }} />)
        fireEvent.click(screen.getByRole('switch', { name: 'Flame Tongue' }))
        expect(onUpdateField).toHaveBeenCalledWith('f', { toggles: [expect.objectContaining({ active: true })] })
    })

    it('reads a field-bound toggle as on from the scope, not its local flag', () => {
        const section = actionsSection([
            field({
                id: 'f',
                label: 'Handaxe',
                meta: { damage: '1d6', type: 'slashing' },
                toggles: [
                    { id: 't', label: 'Flame Tongue', active: false, field: 'flame_tongue', hitMode: 'add', hit: '', setType: '', parts: [{ mode: 'add', damage: '2d6', type: 'fire' }], description: '' },
                ],
            }),
        ])
        // The linked boolean is on in the scope, so the extra fire part applies
        // even though the toggle's own `active` is false.
        render(<SectionBody section={section} results={new Map()} onUpdateField={() => { }} scope={{ flame_tongue: 1 }} onRoll={() => { }} onToggleFlag={() => { }} />)
        expect(screen.getByRole('switch', { name: 'Flame Tongue' })).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByText(/2d6 fire/)).toBeInTheDocument()
    })

    it('flips the shared boolean (not local state) when a field-bound toggle is clicked', () => {
        const onToggleFlag = vi.fn()
        const onUpdateField = vi.fn()
        const section = actionsSection([
            field({
                id: 'f',
                label: 'Handaxe',
                meta: { damage: '1d6', type: 'slashing' },
                toggles: [
                    { id: 't', label: 'Flame Tongue', active: false, field: 'flame_tongue', hitMode: 'add', hit: '', setType: '', parts: [{ mode: 'add', damage: '2d6', type: 'fire' }], description: '' },
                ],
            }),
        ])
        render(<SectionBody section={section} results={new Map()} onUpdateField={onUpdateField} scope={{}} onRoll={() => { }} onToggleFlag={onToggleFlag} />)
        fireEvent.click(screen.getByRole('switch', { name: 'Flame Tongue' }))
        expect(onToggleFlag).toHaveBeenCalledWith('flame_tongue')
        expect(onUpdateField).not.toHaveBeenCalled()
    })
})

describe('SpellCards', () => {
    const spellSection = (fields: CharacterField[]): CharacterSection => ({
        id: 's',
        title: 'Spells',
        description: '',
        accent: '#000',
        kind: 'spellcards',
        scale: 1,
        fields,
        layout: { x: 0, y: 0, w: 1, h: 1 },
    })

    it('renders the level badge and interpolated damage', () => {
        const section = spellSection([
            field({ id: 'bh', label: 'Burning Hands', meta: { level: '1', school: 'Evocation', save: 'DC {spell_save_dc} DEX', damage: '3d6', type: 'fire' } }),
        ])
        render(<SectionBody section={section} results={new Map()} onUpdateField={() => { }} scope={{ spell_save_dc: 15 }} onRoll={() => { }} />)
        expect(screen.getByText('Lvl 1')).toBeInTheDocument()
        expect(screen.getByText('DC 15 DEX')).toBeInTheDocument()
        expect(screen.getByText(/3d6 fire/)).toBeInTheDocument()
    })

    it('spends the linked spell slot when Cast is clicked', () => {
        const onSpend = vi.fn()
        const section = spellSection([
            field({ id: 'bh', label: 'Burning Hands', meta: { level: '1', damage: '3d6', type: 'fire', slot: 'level_1', cost: '1', slotLabel: 'L1 slot' } }),
        ])
        render(<SectionBody section={section} results={new Map()} onUpdateField={() => { }} scope={{ level_1: 2 }} onRoll={() => { }} onSpend={onSpend} />)
        fireEvent.click(screen.getByRole('button', { name: /Cast/ }))
        expect(onSpend).toHaveBeenCalledWith('level_1', 1)
    })

    it('disables Cast when the linked slot is exhausted', () => {
        const onSpend = vi.fn()
        const section = spellSection([
            field({ id: 'bh', label: 'Burning Hands', meta: { level: '1', slot: 'level_1', cost: '1' } }),
        ])
        render(<SectionBody section={section} results={new Map()} onUpdateField={() => { }} scope={{ level_1: 0 }} onRoll={() => { }} onSpend={onSpend} />)
        const cast = screen.getByRole('button', { name: /Cast/ })
        expect(cast).toBeDisabled()
        fireEvent.click(cast)
        expect(onSpend).not.toHaveBeenCalled()
    })

    it('casts a cantrip (no slot) without spending', () => {
        const onSpend = vi.fn()
        const onRoll = vi.fn()
        const section = spellSection([
            field({ id: 'fb', label: 'Fire Bolt', meta: { level: '0', damage: '1d10', type: 'fire' } }),
        ])
        render(<SectionBody section={section} results={new Map()} onUpdateField={() => { }} scope={{}} onRoll={onRoll} onSpend={onSpend} />)
        expect(screen.getByText('Cantrip')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Cast/ }))
        expect(onSpend).not.toHaveBeenCalled()
        expect(onRoll).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('cast') }))
    })
})

describe('HpWidget death saves', () => {
    const hpSection = (current: string, meta?: Record<string, string>): CharacterSection => ({
        id: 'hp',
        title: 'Hit Points',
        description: '',
        accent: '#000',
        kind: 'hp',
        scale: 1,
        meta,
        fields: [
            field({ id: 'cur', label: 'Current HP', type: 'number', value: current }),
            field({ id: 'max', label: 'Max HP', type: 'number', value: '20' }),
        ],
        layout: { x: 0, y: 0, w: 1, h: 1 },
    })

    it('hides the death-save panel while Current HP is above 0', () => {
        render(<SectionBody section={hpSection('5')} results={new Map()} onUpdateField={() => { }} />)
        expect(screen.queryByText('Death saves')).toBeNull()
    })

    it('shows the death-save panel once Current HP hits 0', () => {
        render(<SectionBody section={hpSection('0')} results={new Map()} onUpdateField={() => { }} />)
        expect(screen.getByText('Death saves')).toBeInTheDocument()
        expect(screen.getByLabelText('Successes 1 of 3')).toBeInTheDocument()
        expect(screen.getByLabelText('Failures 1 of 3')).toBeInTheDocument()
    })

    it('records a failure pip into the section meta', () => {
        const onUpdateSection = vi.fn()
        render(<SectionBody section={hpSection('0')} results={new Map()} onUpdateField={() => { }} onUpdateSection={onUpdateSection} />)
        fireEvent.click(screen.getByLabelText('Failures 2 of 3'))
        expect(onUpdateSection).toHaveBeenCalledWith({ meta: { deathSuccesses: '0', deathFailures: '2' } })
    })

    it('rolls a death save and reports it to the roll log', () => {
        const onRoll = vi.fn()
        const onUpdateSection = vi.fn()
        render(<SectionBody section={hpSection('0')} results={new Map()} onUpdateField={() => { }} onRoll={onRoll} onUpdateSection={onUpdateSection} />)
        fireEvent.click(screen.getByRole('button', { name: /Roll save/ }))
        expect(onRoll).toHaveBeenCalledWith(expect.objectContaining({ title: 'Death save', kind: 'save' }))
        expect(onUpdateSection).toHaveBeenCalled()
    })

    it('adds a failure when damage is taken while already at 0 HP', () => {
        const onUpdateSection = vi.fn()
        render(<SectionBody section={hpSection('0')} results={new Map()} onUpdateField={() => { }} onUpdateSection={onUpdateSection} />)
        fireEvent.change(screen.getByLabelText('HP amount'), { target: { value: '5' } })
        fireEvent.click(screen.getByRole('button', { name: 'Damage' }))
        expect(onUpdateSection).toHaveBeenCalledWith({ meta: { deathSuccesses: '0', deathFailures: '1' } })
    })

    it('clears death saves when healing back above 0 HP', () => {
        const onUpdateSection = vi.fn()
        render(
            <SectionBody
                section={hpSection('0', { deathSuccesses: '1', deathFailures: '2' })}
                results={new Map()}
                onUpdateField={() => { }}
                onUpdateSection={onUpdateSection}
            />,
        )
        fireEvent.change(screen.getByLabelText('HP amount'), { target: { value: '5' } })
        fireEvent.click(screen.getByRole('button', { name: 'Heal' }))
        expect(onUpdateSection).toHaveBeenCalledWith({ meta: { deathSuccesses: '0', deathFailures: '0' } })
    })
})

describe('InventoryWidget', () => {
    const inventorySection = (fields: CharacterField[]): CharacterSection => ({
        id: 'inv',
        title: 'Inventory',
        description: '',
        accent: '#000',
        kind: 'inventory',
        scale: 1,
        fields,
        layout: { x: 0, y: 0, w: 1, h: 1 },
    })

    it('renders coin fields as a purse of steppers and steps them', () => {
        const onUpdateField = vi.fn()
        const section = inventorySection([
            field({ id: 'gp', label: 'GP', type: 'number', value: '5', meta: { coin: 'gp' } }),
            field({ id: 'rope', label: 'Rope', value: 'carried' }),
        ])
        render(<SectionBody section={section} results={new Map()} onUpdateField={onUpdateField} />)
        // The coin value lives in an editable input, the item value in its own input.
        expect(screen.getByLabelText('GP')).toHaveValue('5')
        fireEvent.click(screen.getByRole('button', { name: 'Increase GP' }))
        expect(onUpdateField).toHaveBeenCalledWith('gp', { value: '6' })
    })

    it('lists non-coin fields as editable item rows', () => {
        const onUpdateField = vi.fn()
        const section = inventorySection([
            field({ id: 'gp', label: 'GP', type: 'number', value: '5', meta: { coin: 'gp' } }),
            field({ id: 'rope', label: 'Rope', value: 'carried' }),
        ])
        render(<SectionBody section={section} results={new Map()} onUpdateField={onUpdateField} />)
        const item = screen.getByLabelText('Rope quantity')
        expect(item).toHaveValue('carried')
        fireEvent.change(item, { target: { value: '×2' } })
        expect(onUpdateField).toHaveBeenCalledWith('rope', { value: '×2' })
    })
})

describe('relational effect badges', () => {
    const skillsSection = (fields: CharacterField[]): CharacterSection => ({
        id: 'sk',
        title: 'Skills',
        description: '',
        accent: '#000',
        kind: 'skills',
        scale: 1,
        fields,
        layout: { x: 0, y: 0, w: 1, h: 1 },
    })

    it('shows an advantage tag with its reason and source next to a skill', () => {
        const section = skillsSection([field({ id: 'ath', label: 'Athletics', value: '+5' })])
        render(
            <SectionBody
                section={section}
                results={new Map()}
                onUpdateField={() => { }}
                onRoll={() => { }}
                effectTags={new Map([
                    ['athletics', [{ sourceId: 'grappler', sourceLabel: 'Grappler', op: 'advantage', value: 'to end grappled' }]],
                ])}
            />,
        )
        expect(screen.getByText('ADV')).toBeInTheDocument()
        expect(screen.getByText('to end grappled')).toBeInTheDocument()
        expect(screen.getByText('· Grappler')).toBeInTheDocument()
    })

    it('shows a tag next to an action', () => {
        const section = actionsSection([field({ id: 'gr', label: 'Grapple' })])
        render(
            <SectionBody
                section={section}
                results={new Map()}
                onUpdateField={() => { }}
                onRoll={() => { }}
                effectTags={new Map([
                    ['grapple', [{ sourceId: 'feat', sourceLabel: 'Tavern Brawler', op: 'advantage', value: '' }]],
                ])}
            />,
        )
        expect(screen.getByText('ADV')).toBeInTheDocument()
        expect(screen.getByText('· Tavern Brawler')).toBeInTheDocument()
    })
})
