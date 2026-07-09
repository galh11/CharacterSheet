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
