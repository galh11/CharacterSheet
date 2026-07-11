/** Application version + changelog.
 *
 *  Bump `APP_VERSION` by adding a new entry to the top of `CHANGELOG` in the
 *  same PR that ships a user-visible change. The ⋯ More menu shows the current
 *  version (and build time) and a "What's new" panel reads this list, so anyone
 *  opening the deployed app in a browser can tell which build they're running
 *  and which pull request each version relates to — no digging required. */

export interface ChangelogEntry {
    /** Semver for this release. */
    version: string
    /** ISO date (YYYY-MM-DD) the change landed on `main`. */
    date: string
    /** The pull request number this release corresponds to (links to GitHub). */
    pr?: number
    /** One-line, human-readable summary of what changed. */
    summary: string
}

/** GitHub repository the pull requests live in. */
export const REPO_URL = 'https://github.com/galh11/CharacterSheet'

/** Build the GitHub pull-request link for a changelog entry. */
export const prUrl = (pr: number): string => `${REPO_URL}/pull/${pr}`

/** Release history, newest first. The first entry's version is the running
 *  `APP_VERSION`. Keep summaries short — one line each. */
export const CHANGELOG: ChangelogEntry[] = [
    {
        version: '1.23.0',
        date: '2026-07-11',
        summary: 'Resource and counter caps can now be a formula (e.g. {wis_mod} or proficiency) instead of a frozen number, so a limited-use feature’s maximum scales with your level or ability and refills to the right value on a rest. Set it in a field’s “max formula” box in the section editor.',
    },
    {
        version: '1.22.0',
        date: '2026-07-11',
        summary: 'New “Game mechanics” pane (⋯ More → Settings) for table house rules: choose how critical hits roll damage — the default “double the dice”, or “max dice + a regular roll” — and the Crit buttons follow your choice.',
    },
    {
        version: '1.21.0',
        date: '2026-07-11',
        summary: 'Search upgrades: the box now shows a match count, press Enter to jump to the first match, matched titles are highlighted (and non-matches dimmed) in the Sections navigator, and the drawer list is filtered too.',
    },
    {
        version: '1.20.0',
        date: '2026-07-11',
        summary: 'Added a Sections navigator to the side nav: a collapsible list of your cards — click one to scroll it into view and highlight it, so finding a card on a crammed canvas is one click.',
    },
    {
        version: '1.19.2',
        date: '2026-07-11',
        summary: 'Internal refactor: extracted the canvas dashboard-grid layout and the drawer drag-and-tuck logic out of App into dedicated useCanvasGridLayout / useDrawerDrag hooks. No behaviour change.',
    },
    {
        version: '1.19.1',
        date: '2026-07-11',
        summary: 'Internal: extracted the side-nav rail into a dedicated HeaderToolbar component so the toolbar lives in one place — no change to how the app looks or behaves.',
    },
    {
        version: '1.19.0',
        date: '2026-07-11',
        summary: 'Merged each section\u2019s two edit buttons into one: the \u270e button now opens the quick-edit popover (rename, colour, layout), and its \u201cMore settings\u2026\u201d link opens the full editor \u2014 no more redundant pencil.',
    },
    {
        version: '1.18.0',
        date: '2026-07-11',
        summary: 'A numeric bonus an item or feature grants to a skill or saving throw (like a background feature adding your Wisdom modifier to a skill) now actually adds to that check’s modifier and roll — not just the little badge beside it.',
    },
    {
        version: '1.17.0',
        date: '2026-07-11',
        summary: 'The multi-select bar now does more than align cards: select sections on the canvas and Duplicate, Tuck into the drawer, Recolour, or Delete them all at once — each a single undo.',
    },
    {
        version: '1.16.0',
        date: '2026-07-11',
        summary: 'Added a ✐ quick-edit button on every section that opens a small non-blocking popover to rename it, recolour it (preset swatches or a custom colour) and switch its layout — without opening the full editor.',
    },
    {
        version: '1.15.0',
        date: '2026-07-11',
        summary: 'Actions like importing, exporting, sharing, resetting, and layout changes now confirm with brief pop-up toasts (green for success, red for errors) instead of a tiny line next to “Autosaved”, so nothing important is missed.',
    },
    {
        version: '1.14.0',
        date: '2026-07-11',
        summary: 'The HP card now shows resistances, immunities, vulnerabilities and reminder notes that come from your items and features — each with the source that grants it — and applies matching typed damage accordingly, so defenses can be authored on the item instead of as loose HP fields.',
    },
    {
        version: '1.13.0',
        date: '2026-07-11',
        summary: 'A sheet with no sections now shows a friendly empty state with a “+ Section” button and quick template picks, instead of a blank canvas.',
    },
    {
        version: '1.12.1',
        date: '2026-07-11',
        summary: 'Fixed the roll log carrying over (and being overwritten) when you switch characters — each character now correctly keeps and reloads its own roll history.',
    },
    {
        version: '1.12.0',
        date: '2026-07-11',
        summary: 'Replaced the three conflicting layout buttons (Tidy up / Fit all to content / Spread across width) with one “Auto-arrange” that fits every card to its content and packs them into tidy columns — no overlaps, no cropping, and pressing it again never changes anything.',
    },
    {
        version: '1.11.0',
        date: '2026-07-11',
        summary: 'Moved the top toolbar into a right-hand sidebar so the canvas gets the full height of the window. Collapse the tools with the ▴ toggle, or open it as a hamburger overlay on small screens.',
    },
    {
        version: '1.10.0',
        date: '2026-07-11',
        summary: 'Reorder sections in Stack view by dragging: hover a card to reveal a ⠿ grip at its top, then drag it onto another card to drop it into place (undoable). Pinned cards still stay on top.',
    },
    {
        version: '1.9.2',
        date: '2026-07-10',
        summary: 'On-hover descriptions now float above the whole page instead of being cropped to their section card — they flip above/below and stay within the window.',
    },
    {
        version: '1.9.1',
        date: '2026-07-10',
        summary: 'Grid column count now works properly: fewer columns make the cards wider (the columns divide a fixed canvas width) instead of shrinking the whole canvas, so it lines up correctly with and without Fit to width.',
    },
    {
        version: '1.9.0',
        date: '2026-07-10',
        summary: 'New “Spell cards” section kind: each spell shows its level, school, range, save and damage, with a Cast button that spends a linked spell slot and a Damage roll — add one from the + Template ▾ menu or switch any section to it.',
    },
    {
        version: '1.8.2',
        date: '2026-07-10',
        summary: 'Choose how many columns the canvas grid uses (6, 8 or 12) under View ▾ → Grid columns, and see faint column guides while dragging a card so you can tell where it will snap.',
    },
    {
        version: '1.8.1',
        date: '2026-07-10',
        summary: 'Renamed the View menu’s “Density” to “Zoom”, showing each preset’s percentage (80% / 100% / 120%) so it’s clear it scales the whole sheet; the choice now sticks between sessions and is greyed out while “Fit to width” overrides it.',
    },
    {
        version: '1.8.0',
        date: '2026-07-10',
        summary: 'Reworked the top toolbar: the crowd of buttons is grouped into clearer menus (a single View menu holds display mode, density, canvas layout tools and the drawer; templates get their own menu), plus a nicer search box with an inline icon.',
    },
    {
        version: '1.7.2',
        date: '2026-07-10',
        summary: 'Cards now slide out of the way live as you drag one across the grid, and a dropped card stays exactly where you release it.',
    },
    {
        version: '1.7.1',
        date: '2026-07-10',
        pr: 27,
        summary: 'Close an auto-opened empty drawer again when you drop the card back on the canvas instead of tucking it.',
    },
    {
        version: '1.7.0',
        date: '2026-07-10',
        summary: 'Canvas is now a dashboard-style column grid: cards snap to columns and the sheet auto-compacts upward on every drop, so it stays tidy with no overlaps or gaps.',
    },
    {
        version: '1.6.4',
        date: '2026-07-10',
        summary: 'Drag the roll log by its header to move it anywhere, resize it from a bigger bottom-right grip, and its history now scrolls inside a viewport-capped card instead of spilling off-screen.',
    },
    {
        version: '1.6.3',
        date: '2026-07-10',
        summary: 'Tidy now preserves your hand-built columns — it keeps each card in its column and closes the gaps instead of collapsing everything into the top-left corner.',
    },
    {
        version: '1.6.2',
        date: '2026-07-10',
        pr: 24,
        summary: 'Fix drawer drop placement when the canvas is zoomed (density or fit-to-width): cards now land exactly where released.',
    },
    {
        version: '1.6.1',
        date: '2026-07-10',
        summary: 'Fit to width now spans the full browser window on wide screens, not just the centred 1280px column.',
    },
    {
        version: '1.6.0',
        date: '2026-07-10',
        pr: 21,
        summary: 'Visual polish pass: a subtle depth glow, crisper text, themed selection, thin scrollbars, consistent keyboard focus rings, smoother hover transitions, and an elevated dropdown menu.',
    },
    {
        version: '1.5.0',
        date: '2026-07-10',
        pr: 20,
        summary: 'Drawer cards straddle in/out as you drag, land where you drop them, and the drawer auto-closes when empty.',
    },
    {
        version: '1.4.2',
        date: '2026-07-10',
        summary: 'Polish the roll log: colour-coded rows with a flash on each new roll, a collapsed latest-roll summary, and a clearer empty state.',
    },
    {
        version: '1.4.1',
        date: '2026-07-10',
        summary: 'Fit to width now scales the real card extent edge-to-edge (no trailing gap) and can enlarge narrow sheets.',
    },
    {
        version: '1.4.0',
        date: '2026-07-10',
        pr: 16,
        summary: 'Drag cards seamlessly in and out of the drawer, which auto-opens; bolder tab on the left.',
    },
    {
        version: '1.3.0',
        date: '2026-07-09',
        pr: 14,
        summary: 'Drag cards onto a peeking tab to tuck them into a per-view, free-canvas drawer.',
    },
    {
        version: '1.2.0',
        date: '2026-07-09',
        summary: 'Remove the D&D Beyond importer; import/export now covers this app’s own sheets only.',
    },
    {
        version: '1.1.0',
        date: '2026-07-09',
        pr: 11,
        summary: 'Prompt to reload when a new build deploys, plus a "Check for updates" menu item.',
    },
    {
        version: '1.0.0',
        date: '2026-07-09',
        pr: 9,
        summary: 'Show the app version, build time, and a readable changelog in the ⋯ More menu.',
    },
    {
        version: '0.7.0',
        date: '2026-07-09',
        pr: 7,
        summary: 'Character portrait avatar in the top bar.',
    },
    {
        version: '0.6.0',
        date: '2026-07-09',
        pr: 6,
        summary: 'Unify currency into a single D&D-Beyond-style inventory section.',
    },
    {
        version: '0.5.0',
        date: '2026-07-09',
        pr: 5,
        summary: 'Drawer, fit-to-width, spread, and background pan for the canvas.',
    },
    {
        version: '0.4.0',
        date: '2026-07-09',
        pr: 4,
        summary: 'Repeatable action toggles that add or replace damage / to-hit.',
    },
    {
        version: '0.3.0',
        date: '2026-07-09',
        pr: 3,
        summary: 'Agents verify a PR actually merged before finishing.',
    },
    {
        version: '0.2.0',
        date: '2026-07-09',
        pr: 2,
        summary: 'Merge death saves into the HP tracker.',
    },
]

/** The semantic version this build is running. */
export const APP_VERSION = CHANGELOG[0]?.version ?? '0.0.0'

/** Build timestamp, injected by Vite at build time (see vite.config.ts).
 *  Falls back to the current time in dev / tests where it isn't defined. */
declare const __APP_BUILD_TIME__: string | undefined
export const BUILD_TIME: string =
    typeof __APP_BUILD_TIME__ === 'string' ? __APP_BUILD_TIME__ : new Date().toISOString()
