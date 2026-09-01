# Handoff — the reviewer portal: design system, evidence cards, public-facing copy

2026-09-01, late. Newest commits this brief describes: **`45a9a46`** (baseline
`main`, pushed, tree clean) and **`9c59d5e`** (site repo
`hossainpazooki.github.io`, cloned at `~/dev/site`). Supersedes the layout and
copy described by the two earlier briefs of this date; their ledger-mechanics
and hosting sections stand.

## Current state

**BUILT — the page wears the site's design system.** Full token set (paper +
ink), IBM Plex Sans/Mono + Space Grotesk, sticky nav, panel tables, scroll
reveals with a noscript fallback, and the ink/paper toggle wired to the same
`hp-theme` localStorage key as the user site, so the choice carries across.
re-verify: `curl -sS https://baseline-beryl.vercel.app/ | grep -c "hp-theme"` (expect ≥ 2)

**BUILT — live equals committed, byte for byte.** The Vercel build command
verifies (`--check`) rather than regenerates, so the served page is the
committed file or the deploy fails.
re-verify: `cd ~/dev/baseline && curl -sS https://baseline-beryl.vercel.app/ | cmp - index.html && echo IDENTICAL`

**BUILT — figures whose every value is interpolated.** The claim-path diagram
(two cells on a gold baseline converging on the gate) and the hero figure (the
parallax construction labeled in the data's own words: "the restatement",
"read as-of day D") plus four baseline cards. Figures 00–02 are the site
essay's broken-baseline variants verbatim; 03 is variant 01 with dashed red
`B = ?` swapped for solid gold `B = cited`. No typed numbers anywhere in SVG.
re-verify: `cd ~/dev/baseline && node scripts/build.mjs --check` (regenerates from rows and diffs against the committed page)

**BUILT — each broken-baseline card cites evidence.** 00 → the audit row's
results/corpus/dating field; 01 → the checker rule that a lone live cell
derives PARTIAL (held by the control named "lone live cell passes"); 02 → the
twin row's plant and violation vector; 03 → the derived lane status.
re-verify: `cd ~/dev/baseline && node scripts/test-ledger.mjs 2>&1 | grep "lone live cell"`

**BUILT — deep detail folded into disclosures, cards promoted.** The checks
table, plant sentence, and run-anatomy table live in a `<details>` under the
claim sentence; the audit's sentence/notes/controls/corpus in a second
`<details>` by the SURFACE_AUDIT table. Bessel paragraph and the standalone
vendor section were deleted as duplicative (cards 03 and 00 carry them).
re-verify: `cd ~/dev/baseline && grep -c "<details class=\"rundetail" index.html` (expect 2)

**BUILT — self-contained public hero.** "What did you know, and when?" over a
domain-first lede (restatements, backtests reading the future, "a row you can
open"). Every reference to "the essay" was removed from the page — nav link,
lede closer, footer — at the operator's direction.
re-verify: `cd ~/dev/baseline && awk 'BEGIN{IGNORECASE=1} /essay/{n++} END{print n+0}' index.html` (expect 0)

**BUILT — the essay→ledger seam, one-way.** The site's `/baseline` page links
to the ledger in three places (nav, lede, footer), committed as `9c59d5e` and
live. The ledger deliberately does not link back.
re-verify: `curl -sS https://hossainpazooki.github.io/baseline/ | grep -c "baseline-beryl.vercel.app"` (expect 3)

**NOT STARTED.** `superseded_by` row pointers, a custom domain, the
`MEASUREMENT` row kind for the 17,787 / 1.51% figures (still badged), lane 2,
row signing.

## Locked decisions

- **The ledger page never mentions the essay.** Operator, this session: "there
  is no essay so stop confusing the reader" — a cold visitor must need nothing
  off-page. Honor it even when adding new sections; the site page may still
  link IN.
- **Hero speaks the domain before the project.** Restated revenue and
  backtests come before any use of "gate"/"surface"/"twin"; jargon is defined
  by the sections that use it. Reason: two rounds of operator feedback called
  the abstract versions vague for a public page.
- **The cards lead; detail is one click aside.** Operator: the tables were
  "burying the most important part." Move detail into `<details>`, never
  delete evidence.
- **Figure values are interpolated or absent.** A number in an SVG is read
  from a row like any other number on the page. Spec amendments 14–16 record
  the mechanism.
- **Vercel build verifies, never regenerates** — "what is live is what is in
  git" depends on it. (Carried from the hosting brief; still load-bearing.)
- **Figures 00–02 stay verbatim copies of the site's variants.** The visual
  kinship is the point; drift them only with the operator.

## Reuse map

- `scripts/build.mjs` — everything renders from here: `FIGS` (the four glyph
  variants), `CHECK_DOCS` (check semantics, dash when unknown), `fmtChecks`,
  `pairTd` (spanning cell only when values are equal), the `g-*` SVG glyph
  vocabulary and `details.rundetail` CSS. Extend these; do not fork.
- `~/dev/site/baseline/index.html` — the design-system source of truth
  (tokens, both themes, glyph styles). CRLF line endings; match terminators
  when editing.
- Large multi-block edits to `build.mjs`: write a patch script to the
  scratchpad and run it. Inline bash heredocs above a few KB fail with
  "unexpected EOF" (bit three times this session).

## Invariants

- **Nothing on the page may claim more than the rows** — including inside
  SVG text nodes and card copy.
- **A verdict row is gate output; fix the emitter and re-emit, never the row.**
- **Every ledger file is bound by LF-normalized hash in `ledger/SOURCE.md`.**
- **De-naming sweep before any publish-adjacent commit:**
  `sh scripts/denaming-sweep.sh` exits 0; terms live only in gitignored
  `.denylist`; missing/empty list is UNEVALUABLE exit 2, never clean.
- **`build --check` green before any commit touching `build.mjs` or
  `index.html`** — they move together or the deploy gate refuses them.
- **The two URLs serve two different things on purpose**: the user site's
  `/baseline` path belongs to the site repo (see the shadowing learning);
  never re-enable Pages on this repo, or it will silently shadow that page
  again.

## Open / next

**First: the fate of the site's `/baseline` page.** The operator said "there
is no essay"; the page nonetheless exists, is live, and now links here three
times. Options are keep-as-is (traffic flows one way; harmless), rewrite, or
remove/redirect — operator's call, and `~/dev/site` is cloned and ready.
Related: `~/dev/site` carries an operator-made edit to `rigor/index.html`,
uncommitted, not part of this work — do not fold it into ledger commits.

**Then, in value order:** custom domain (the `-beryl` in the canonical URL is
a Vercel-assigned random word — weak for a page whose pitch is citability, and
`pazooki.com` is available); `superseded_by` pointers before anyone cites a
row URL (the gap is now demonstrated, not predicted — see the supersession
learning); the `MEASUREMENT` row kind; lane 2 (blocked producer-side in
VANTAGE).

**Untracked at handoff:** this brief, its index row, and the learnings entry
`2026-09-01-project-pages-shadowed-the-site-path.md` — commit commands were
emitted to the operator alongside this brief.
