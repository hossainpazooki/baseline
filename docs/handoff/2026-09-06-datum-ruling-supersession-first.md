# Handoff — DATUM ruling: not a catalog; `superseded_by` before adoption

2026-09-06 (UTC 2026-09-07 at write). Newest commit this brief describes:
**`775978f`** (`feat: default to paper theme`, `main`, level with origin,
tree clean). Cross-repo anchors: datum **`91be859`** (DATUM v2), meridian
**`a087ab2`**, site **`000150c`** local (15 behind origin, none touching
`baseline/`). Pick-up measures drift from `775978f`.

**Nothing in this repo changed this session** except three learnings
entries, this brief, and the two index rows, all uncommitted. The session
ran the full pick-up of `2026-09-01-reviewer-portal-on-vercel.md`, then
brainstormed MERIDIAN's registration, measured that it fails, and wrote
DATUM. That brief's ledger-mechanics, hosting and portal sections stand;
this brief changes what "next" means.

## Current state

- **built, verified this session** — all four local gates exit 0 at
  `775978f`: `test-ledger` (4 positive + 17 negative controls held),
  `check-ledger` (all rows bound, valid, status-free), `build --check`
  (committed page matches the ledger), `denaming-sweep` (clean, 2 terms,
  0 hits).
  re-verify: `cd ~/dev/baseline && node scripts/test-ledger.mjs >/dev/null && node scripts/check-ledger.mjs >/dev/null && node scripts/build.mjs --check >/dev/null && sh scripts/denaming-sweep.sh >/dev/null && echo ALL-GREEN`
- **built, verified this session** — live equals committed byte for byte;
  CI `ledger-gate` success on `775978f`, `00ed022`, `45a9a46`.
  re-verify: `cd ~/dev/baseline && curl -sS https://baseline-beryl.vercel.app/ | cmp - index.html && echo IDENTICAL`
  re-verify: `gh run list --limit 1 --json headSha,conclusion --jq '.[0] | "\(.headSha[0:7]) \(.conclusion)"'` -> `775978f success`
- **built, verified this session** — every re-verify line in the portal
  brief passed (hp-theme 2, rundetail 2, essay mentions 0, site→ledger
  links 3). The portal brief's "first" open item, the fate of the site's
  `/baseline` page, was closed after that brief by site `000150c` (concept
  page, links here three times, one-way).
  re-verify: `curl -sS https://hossainpazooki.github.io/baseline/ | grep -c "baseline-beryl.vercel.app"` -> `3`
- **built (elsewhere)** — DATUM v2 at datum `91be859`: the governing text
  for baseline, traverse, meridian; pack design
  `~/dev/datum/docs/2026-09-06-datum-design.md`; research note.
  re-verify: `git -C ~/dev/datum log --oneline -1` -> `91be859 ...`
- **planned, unblocked** — `superseded_by`. The gap was demonstrated on
  2026-09-01 (a cited row URL 404s on replacement) and DATUM's rollout puts
  BASELINE's re-emit after it. Nothing built.
  re-verify: `grep -rn superseded scripts/` -> no output
- **planned, blocked** — DATUM adoption (rollout step 3): generalize the
  checker to `gate_sha`/`gate_worktree` and `unevaluable_reason`, rename
  in PARALLAX's emitter, re-emit both rows against the gold surface,
  re-bind `SOURCE.md`, vendor the pack, CI step, README DATUM section.
  Blocked on the pack (not built), on `superseded_by`, and on operator
  access to the gold surface for the re-emit.
- **planned, operator-only** — custom domain. `pazooki.com` is owned, not
  purchasable (learnings entry); a subdomain on the Vercel project
  (`prj_mB2XNbHwqrXFMdM38Y0fDMsxtucD`) plus one DNS record at the registrar.
- **not started, unchanged** — `MEASUREMENT` row kind for the 17,787 /
  1.51% figures; lane 2 (blocked producer-side in VANTAGE); row signing;
  prose lint.

Learnings gate state at write time: `node
~/dev/rigor/scripts/check-learnings.mjs docs/learnings` exits 1 on a
PRE-EXISTING pair, `2026-08-31-ledger-has-no-supersession.md` and
`2026-08-31-denaming-is-name-level-only.md`, which share a `ts:` (their
own text says they were co-landed). The three new entries carry distinct
capture timestamps and pass; two are dated 2026-09-07 because their bases
landed after midnight UTC, which the gate requires the filename to match. Do not edit the old entries; a superseding
entry with `kills:` is the operator's call.

## Locked decisions

Carried from `2026-09-01-reviewer-portal-on-vercel.md`, premises re-checked:

1. **The ledger page never mentions the essay.** Reason holds: a cold
   visitor needs nothing off-page. (0 mentions, verified.)
2. **Hero speaks the domain before the project.** Reason holds.
3. **The cards lead; detail is one click aside.** Reason holds.
4. **Figure values are interpolated or absent.** Reason holds; spec
   amendments 14–16.
5. **Vercel build verifies, never regenerates.** Reason holds and is
   load-bearing for "what is live is what is in git" (cmp IDENTICAL).
6. **Figures 00–02 stay verbatim copies of the site's variants.** The
   lock stands as written, but **its reason has no referent**: the site
   page no longer carries the variants (learnings entry
   `2026-09-07-site-variants-gone-figure-lock-has-no-referent.md`).
   Surfaced, not acted on. Any future figure edit needs the operator's
   ruling on this lock first.

New, from the DATUM ruling (operator, 2026-09-06; `~/dev/datum/DATUM.md`):

7. **BASELINE is not a catalog.** Reason: the shared thing across
   baseline, traverse and meridian is the discipline and the row, and the
   copy was measured to fail at this checker. Consequence: the
   single-surface guard in `build.mjs`, the `rows`-to-`no_future_accepted`
   binding and the one-twin `groupCells` are BASELINE's own rules and are
   **not widened**; a second gate surface never enters this ledger.
8. **`gate_sha` / `gate_worktree` replace `parallax_sha` /
   `parallax_worktree`** in the shared row (DATUM rule 6). Reason: the
   name is emitter-specific and MERIDIAN was writing its own commit under
   it. For BASELINE this means: rename in PARALLAX's `verdict_row()`,
   re-emit the two rows, never edit the committed ones.
9. **`result` stays the exact enum; `unevaluable_reason` is a separate
   field** (DATUM rule 2). Reason: this checker already rejects a colon
   form; the field is additive here.
10. **`rows` is optional in the shared row and BASELINE keeps requiring
    it, bound to `no_future_accepted`.** Reason: the binding is a real
    PIT fact about this surface, not a generic rule.
11. **STATUS.md house rule** (DATUM rule 5): hand-written dated log plus a
    generated block between markers checked by `--check`. Reason: one
    convention across the three repos. BASELINE's STATUS.md is hand-written
    today and gains the block at adoption; `index.html` stays the page.
12. **`superseded_by` lands before any re-emit.** Reason: re-emitting
    replaces both row files and 404s their published URLs, which is the
    zero-baseline failure the page argues against
    (`2026-08-31-ledger-has-no-supersession.md`). DATUM design §6 step 3
    orders it the same way. Whether it is a row field or a ledger-level
    pointer is BASELINE's decision (design §9), not schema v1's.
13. **Rollout order: datum pack, meridian, then baseline, then traverse.**
    Reason: BASELINE has published URLs and needs the operator for the
    re-emit; MERIDIAN's rows regenerate.

## Reuse map

- `scripts/lib/ledger.mjs` — `VERDICT_REQUIRED` (line 20), `VERDICT_NAME`
  filename regex (32), `GATE_RESULTS` (10), `validateVerdict` with the
  plant match and the `rows` rule (83–125), `deriveStatus` (151),
  `groupCells` (167, the one-twin throw), `findStatusLiterals`, the
  `SOURCE.md` parser. `superseded_by` lives in `groupCells`/`deriveStatus`
  and one new validation; the `gate_sha` rename is `VERDICT_REQUIRED` plus
  every `parallax_sha` read in `build.mjs`.
- `scripts/test-ledger.mjs` — the control harness; add "two live rows,
  one superseded" (positive), "two live rows, neither superseded"
  (negative), and later "old key name" (negative).
- `scripts/build.mjs` — `REPOS` (25–35), single-surface guard (51–56),
  `CHECK_DOCS` (74), `FIGS` (194), `parallax_sha` reads (147, 181–182,
  321–322, 686). Large edits: patch script in the scratchpad, not a bash
  heredoc (fails above a few KB).
- `ledger/SOURCE.md` — one `parallax_sha` line for the ledger plus
  per-file LF-normalized sha256; the four-run `content_hash` corroboration
  paragraph. Re-emit means new files, new hash lines, a fifth run to add to
  the corroboration if the hash holds.
- `scripts/denaming-sweep.sh` over gitignored `.denylist` — run before any
  publish-adjacent commit; exit 2 is UNEVALUABLE, never clean.
- `docs/learnings/2026-08-31-ledger-has-no-supersession.md` — the
  `groupCells` throw and its read-only re-verify line; the design
  constraint "at most one non-superseded cell per surface/lane".
- PARALLAX: `scripts/run_gate_local.py --emit-verdicts` and `verdict_row()`
  (the emitter to rename; the twin-scope override lives there too). Replay
  command in `SOURCE.md`; needs the gold surface.
- `~/dev/datum/docs/2026-09-06-datum-design.md` — §2 schema v1, §3
  crediting, §5 vendoring contract (`vendor/datum/`, `PIN`, CI order), §6
  step 3, §9 (`superseded_by` is BASELINE's).
- `~/dev/site/baseline/index.html` — the concept page, CRLF; the site
  clone is 15 commits behind origin (home and CV changes only). **Pull
  before editing anything in `~/dev/site`.**

## Invariants

- **Nothing on the page may claim more than the rows**, SVG text and card
  copy included.
- **A verdict row is gate output; fix the emitter and re-emit, never the
  row.** The `gate_sha` rename is the first time this will cost a gold-
  surface run; that cost is the rule working.
- **Every ledger file is bound by LF-normalized hash in `ledger/SOURCE.md`;
  CI and the Vercel build both recompute.** A re-emit that forgets the
  binding fails the deploy, by design.
- **`build --check` green before any commit touching `build.mjs` or
  `index.html`**; they move together or the deploy gate refuses them.
- **De-naming sweep before any publish-adjacent commit.** Local-only gate
  (the list is gitignored), so it depends on a human running it.
- **Never re-enable GitHub Pages on this repo**; it silently shadows the
  user site's `/baseline` path.
- **The single-surface guard is intentional** (decision 7). A future
  session that meets `FAIL v1 renders exactly 1 gate surface` is looking
  at a rule, not a limitation.
- **No re-emit before `superseded_by`** (decision 12); the two current row
  URLs are the ones that would 404.
- **Only the operator writes git history.** Emit commands grouped by repo,
  one concern per commit.

## Open / next

1. **`superseded_by`**, unblocked, this repo alone. Design first: row field
   versus ledger-level pointer (a pointer file keeps rows as pure gate
   output, which favours the pointer); checker allows at most one
   non-superseded `live` and one non-superseded `twin` per surface/lane;
   `deriveStatus` reads only non-superseded cells; the page renders
   superseded rows as history with their hashes; `SOURCE.md` keeps old rows
   bound; two new controls in `test-ledger.mjs`. Then build, `build
   --check`, sweep, commit commands.
2. **DATUM adoption**, after 1 and after the pack exists in
   `~/dev/datum/conformance/`. Vendor the pack and get its `test.mjs` green
   in CI before touching the checker, so the first `check.mjs` run over
   `ledger/verdicts/` is a measured red (missing `schema`, old key names).
   Then checker, PARALLAX emitter, re-emit with the operator, `SOURCE.md`,
   README DATUM section, STATUS generated block, copy the two rows into
   datum's `fixtures/real/baseline/`.
3. **Operator rulings wanted**: the figure lock (decision 6) and the
   custom domain hostname.
4. **`MEASUREMENT` row kind**, then lane 2 when VANTAGE unblocks it.

**Untracked at handoff:** this brief, its index row, and three learnings
entries with their index rows. Commit commands:

```bash
cd ~/dev/baseline
git add docs/learnings/2026-09-06-*.md docs/learnings/2026-09-07-*.md docs/learnings/LEARNINGS.md
git commit -m "docs: three learnings, DATUM ruling, figure lock, domain"
git add docs/handoff/2026-09-06-datum-ruling-supersession-first.md docs/handoff/HANDOFF.md
git commit -m "docs: handoff, DATUM ruling and supersession-first"
git push
```
