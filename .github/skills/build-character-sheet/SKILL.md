---
name: build-character-sheet
description: "Build a new CharacterSheet app sheet from a source character — a D&D Beyond character ID / URL (fetched automatically if public), a D&D Beyond JSON export, a pasted stat block, or a markdown/PDF dump. Use when the user says: build/create/make/import a character sheet, quick-start a character, here's my D&D Beyond character id/link, turn this D&D Beyond export into a sheet, generate a sheet from this stat block, or add a sample character. Runs a three-stage pipeline: (1) obtain + save the source under samples/ (fetch the public character-service JSON when given only an ID/URL), (2) a read-only subagent sweeps the source into a compact character digest so the raw megabyte of DDB metadata never enters the build context, (3) a focused agent writes a scripts/gen-<slug>.mjs generator, produces samples/<slug>-sheet.json, and validates it. Do NOT use for editing an existing saved sheet or for generic coding."
argument-hint: "D&D Beyond character id / URL, or a path or paste of the source (DDB JSON / stat block / markdown)"
---

# Build a Character Sheet

Turn a source character into a native CharacterSheet app sheet
(`samples/<slug>-sheet.json`) that the user can load with **Import JSON…**. The
app has rich, non-trivial features (computed fields, relational effects, action
toggles, typed section kinds), and raw D&D Beyond exports are ~1 MB of noise, so
this skill deliberately splits the work into three stages to keep each agent's
context small and focused.

## When to use

- "Build / create / make a character sheet from this D&D Beyond export."
- "Here's my D&D Beyond character **id** / link — make a sheet."
- "Quick-start a sheet for <character>" / "turn this stat block into a sheet."
- "Add <character> as a sample sheet."

Do **not** use this for editing an already-saved sheet, or for generic coding.

## Prerequisites

- Node via conda: run `conda activate nodejs` first in a new terminal (Windows).
- Read the app's architecture notes in [AGENTS.md](../../../AGENTS.md) and the two
  reference generators [scripts/gen-yad.mjs](../../../scripts/gen-yad.mjs) and
  [scripts/gen-amarthon.mjs](../../../scripts/gen-amarthon.mjs) — they are canonical
  examples of a finished sheet's **structure and patterns** (section kinds,
  computed fields, the layout helper). Copy their *shape*, never their *content*:
  their abilities, items, and effects belong to those characters, and `gen-yad`
  even carries a couple of illustrative demo items that are **not** in its DDB
  export. Build every value of your character from its own digest — never by
  cloning a similar existing generator.
- If this sheet will be committed to the repo, do the whole thing inside a git
  worktree and land it via the auto-merging PR flow (see the "Parallel agents"
  section of AGENTS.md). For a **private / one-off** character the user just wants
  to import, skip the PR and only produce `samples/<slug>-sheet.json` locally.

## Pipeline

### Stage 1 — Obtain + save the source under `samples/`

1. Pick a short kebab-case `<slug>` from the character name (e.g. `yad-armhand`).
2. Get the source into `samples/<slug>-source.<ext>`:
   - **Given only a D&D Beyond character ID or URL** (e.g. `166905628` or
     `https://www.dndbeyond.com/characters/166905628`): pull the character ID out
     of the URL and fetch the **public character-service JSON** yourself from
     `https://character-service.dndbeyond.com/character/v5/character/<id>` (use
     the `fetch_webpage` tool). A public character returns
     `{"success": true, "data": { … }}`; save the whole payload as
     `samples/<slug>-source.json`. If it returns `success:false` or `data:null`,
     the character is **private** — tell the user to set its privacy to Public
     (Character Sheet → gear/settings → Campaign & Privacy) and try again; do not
     guess or fabricate data.
   - **Given a pasted blob or a file outside `samples/`**: save it verbatim as
     `samples/<slug>-source.<ext>` (`.json` for a DDB export, `.md`/`.txt` for
     text). If it's already in `samples/`, reuse it as-is.
3. Never hand-edit the source — it is the record of truth for the sweep.

### Stage 2 — Sweep the source into a compact digest (subagent)

Delegate this to a **read-only subagent** (use the `Explore` agent, or a plain
`runSubagent` with a read-only prompt) so the megabyte of raw metadata is read,
distilled, and discarded in an isolated context — it never pollutes the build
context.

Give the subagent:
- the path to `samples/<slug>-source.*`,
- the digest contract in [references/character-digest.md](./references/character-digest.md),
- an explicit reminder that for a DDB JSON it **must** mine `characterValues` for
  custom item names (`typeId 8`) and notes (`typeId 9`) — that is where player
  renames and homebrew effects (e.g. a "Reduce all damage taken by 3" note) live,
  and they are the easiest real bonus to miss,
- an instruction to **write** the result to `samples/<slug>-digest.md` and return
  a one-paragraph summary + the digest path, ending with a short **"not in the
  source"** reconciliation note if the character resembles an existing sample —
  flagging anything that sample has but this character's JSON does not support.

The digest is a small, human-readable markdown file with **only what matters** to
build the sheet (abilities and how they're derived, HP/AC/speed/init/proficiency,
saves & skills proficiency/expertise, senses, attacks, spellcasting, features &
traits as name + one-line effect, limited-use resources, inventory + coins,
conditions, languages). Everything else in the raw export is dropped.

### Stage 3 — Build the generator + sheet (focused agent)

Working from **only** `samples/<slug>-digest.md` (not the raw source), author a
self-contained `scripts/gen-<slug>.mjs` modeled on the reference generators, then
run it to emit `samples/<slug>-sheet.json`.

> **Never clone an existing similar sheet.** Even if the character resembles a
> committed sample (e.g. another build of the same character), do not start from
> that generator — build from *this* character's digest and reconcile every item,
> effect, and number against it. Copied generators silently import the other
> character's content (and any demo items), which is exactly how fabricated gear
> and inflated stats sneak in.

Follow the authoring conventions in
[references/sheet-authoring.md](./references/sheet-authoring.md): field/section
kinds, computed fields + `{expr}` interpolation, relational effects, action
toggles, the column-packing layout helper, and the `ORDER` re-pack. Key rules:

- Every value that depends on ability mods / proficiency is a **computed field**
  or an `{expr}` placeholder — never a hand-typed final number.
- Ability modifiers are explicit computed fields (`str_mod = floor((str-10)/2)`).
- Cross-field buffs use relational **effects**; per-weapon variants use **toggles**.
- Give fields on-hover `description`s for rules reminders.
- Include only items, effects, and numbers the digest supports — never carry over
  demo or example content from the reference generators.

Then validate and (optionally) load:

```powershell
conda activate nodejs
node scripts/gen-<slug>.mjs                                   # writes the sheet
node .github/skills/build-character-sheet/scripts/validate-sheet.mjs samples/<slug>-sheet.json
```

The validator zod-parses the sheet and runs `resolveSheet` so formula typos and
schema violations surface immediately. Fix the generator (not the JSON) until it
passes, then re-run. To preview in the app, start `npm run dev` and use **Import
JSON…**, or paste the file's contents.

## Landing it (only if committing as a sample)

If the character should become a committed sample, do Stages 1–3 in a worktree,
then run the full gate and open the auto-merging PR per AGENTS.md:

```powershell
npm run lint; npm run build; npm run test:run; npm run check:docs
```

Add the new `scripts/gen-<slug>.mjs` to the AGENTS.md project-structure map and
mention the new sample in `samples/README.md`. For a private character, skip all
of this — just deliver `samples/<slug>-sheet.json` for the user to import.

## Assets

- [references/character-digest.md](./references/character-digest.md) — the digest
  contract the Stage-2 subagent fills in.
- [references/sheet-authoring.md](./references/sheet-authoring.md) — how to write
  a generator: section kinds, field types, computed fields, effects, toggles,
  layout, and validation.
- [scripts/validate-sheet.mjs](./scripts/validate-sheet.mjs) — zod-validate +
  `resolveSheet` a generated sheet file.
