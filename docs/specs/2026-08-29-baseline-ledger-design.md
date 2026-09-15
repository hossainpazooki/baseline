# BASELINE conformance ledger — design (MVP)

2026-08-29. Status: **BUILT with amendments** (v1 shipped 2026-08-31 in this
repo; see Amendments below for every deviation from the text that follows).
Originally intended for the site repo; BASELINE now lives as this standalone
repo so the page can be hosted anywhere.

---

## 1. What BASELINE ships

A conformance ledger: dated rows stating what the PARALLAX PIT gate has shown
about a named read surface, rendered as a static page, wrapped in a story
whose single aim is to make a non-technical reader recognize their own
fundamentals feed as the zero-baseline failure.

Two readers, one artifact:

- Technical reader: each row resolves to a replayable gate run (commit SHA +
  content hash) or to a dated documentation snapshot.
- Non-technical reader: the same rows rendered as one sentence each.

Rule: nothing on the page may claim more than the rows.

Not shipped: a dataset, a service, a spec for adoption. The ledger reports on
surfaces; it does not serve data.

## 2. Row kinds

Two kinds. A row is exactly one kind.

### 2.1 `GATE_VERDICT`

Emitted by the PARALLAX gate at the end of a run.

| field | value |
|---|---|
| `kind` | `GATE_VERDICT` |
| `surface` | human name of the read surface (e.g. `vantage-gold-local-parquet`) |
| `lane` | `1` local Parquet · `2` Unity Catalog · `3` Snowflake over Iceberg |
| `cell` | `live` or `twin` |
| `result` | `GREEN` · `RED` · `UNEVALUABLE` |
| `checks` | object: check name → violation count |
| `rows` | as-of rows examined |
| `parallax_sha` | commit the gate ran from |
| `content_hash` | SHA-256 over the data read (live) or the staged twin |
| `ran_at` | ISO-8601 UTC |
| `runner` | `local` or `ci` |

`RED` on a `twin` cell must carry the planted-mutation count; the expected
value is exactly one violation per affected check.

### 2.2 `SURFACE_AUDIT`

Hand-authored. A claim about a third party's published surface, established by
reading its documentation. Visibly not a gate run.

| field | value |
|---|---|
| `kind` | `SURFACE_AUDIT` |
| `surface` | vendor product name, or `commercial-fundamentals-api` if unnamed (see §7) |
| `doc_url` | page read |
| `fetched_at` | ISO-8601 UTC |
| `snapshot_hash` | SHA-256 of the committed snapshot file |
| `field_quoted` | the field name that dates a period |
| `result` | `NO_AS_OF_MODE` · `NO_ACCEPTANCE_INSTANT` · `AS_OF_MODE_PRESENT` |

`SURFACE_AUDIT` results never render green or red; they use their own color
class (the site's `blue` / measured-value token).

### 2.3 Derived status (never authored)

Per surface × lane, computed at build time from `GATE_VERDICT` rows:

- `CLAIMABLE` — a `live` row with `GREEN` and a `twin` row with `RED`, both
  present.
- `PARTIAL` — exactly one of the two cells present. Not green-colored.
- `UNCLAIMED` — no rows. Lanes 2 and 3 render this in v1.
- `UNEVALUABLE` — any present cell reports `UNEVALUABLE`.

Any status found in a file rather than recomputed is a build failure.

## 3. Provenance pipeline (v1)

1. **Gate emits.** PARALLAX gate writes
   `verdicts/<surface>-<lane>-<cell>-<ran_at>.json` on completion. Only the
   gate writes this directory. The two Lane 1 cells (live GREEN over 440,661
   rows; twin RED) are re-run to produce the first files — the 2026-08-07 run
   is not retro-fitted from memory.
2. **Audit authored.** One `SURFACE_AUDIT` JSON plus the fetched documentation
   page committed under `audits/` as a snapshot.
3. **Copy to site.** Verdict and audit files are copied by hand into the site
   repo under `baseline/ledger/`, with `PARALLAX_SHA` recorded in
   `baseline/ledger/SOURCE.md`.
4. **Ledger gate.** `scripts/check-ledger.mjs` runs in site CI before build:
   - every rendered row resolves to exactly one file in `baseline/ledger/`;
   - `snapshot_hash` matches the committed snapshot for every audit;
   - derived status recomputed from cells; a status literal in any file fails;
   - required fields present and enumerations valid.
   Any failure fails the build. No `|| true`.
5. **Render.** One generator reads the JSON and emits both the table and the
   sentence form. The page's story prose is hand-written; for v1 every
   number in it is checked by hand against a row.

## 4. Story layer

Purpose: after reading, a non-technical reader should distrust a feed that
carries no viewpoint.

Spine, all already on the page and all row-backed after §3:

- Bessel 1838: value revised (0.3136″ → 0.286″), embarrassing nothing because
  the viewpoint was stored beside it. The model VANTAGE's gold implements.
- The first measurement: 17,787 filer-quarters, 1.51% sign flips — rare,
  violent where it lands. (Row-backed only if a `GATE_VERDICT`-adjacent
  measurement record is added; otherwise this stays prose and is flagged as
  "reported, not on the ledger" in v1.)
- The vendor finding: nanosecond trades, no as-of on fundamentals. Backed by
  the `SURFACE_AUDIT` row.
- The three failures (zero / unknown / flexing) each mapped to a caught case.

Placement: story sections may reference rows by id. In v1 this is a
convention checked by hand; the lint that enforces it is v2.

Sentence form per row, generated:

- `GATE_VERDICT`: "On {ran_at}, the gate read {rows} rows of {surface} and
  found {result}. The same check, run on a copy with one planted error, went
  {twin result}." (twin sentence only when both cells exist)
- `SURFACE_AUDIT`: "As of {fetched_at}, {surface}'s fundamentals endpoints
  offered no way to ask what was known on a given day. Field that dates a
  period: {field_quoted}. Source: {doc_url}."

## 5. Error handling

- Missing or malformed row file → build fails.
- Snapshot hash mismatch → build fails.
- Status literal in a file → build fails.
- Unknown `result` value → build fails.
- Only one Lane 1 cell present → renders `PARTIAL`, not green; build passes.
- Lanes 2–3 → `UNCLAIMED`; build passes.

## 6. Testing

`check-ledger.mjs` ships with fixtures and negative controls, one per failure
in §5, each a mutation of a good fixture. A control that does not fail the
check is itself a test failure.

PARALLAX side: one test that the emitted verdict JSON round-trips the gate's
in-memory result, and one that a twin run emits `RED` with the expected
violation count.

## 7. Open items - RESOLVED before publication

Both were settled before the site went live on 2026-08-31; neither gate was
skipped. Kept here as a record of how they were decided.

- ~~Whether the vendor is named on the ledger.~~ **Resolved: not named.** The
  page carries `vendor_alias: APERTURE` and the spec's required `doc_url`
  field was dropped, because a required doc_url beside a committed vendor page
  is itself the naming act (amendment 2). Limit recorded in
  `docs/learnings/2026-08-31-denaming-is-name-level-only.md`: the corpus paths
  still fingerprint the vendor, so this is de-naming, not anonymity.
- ~~Whether the 17,787-row measurement gets its own row kind in v1.~~
  **Resolved: it stays prose**, rendered with a visible "reported, not on the
  ledger" badge (amendment 9). A `MEASUREMENT` row kind is the leading v2 item.

## 8. Not built (v2)

- ed25519 signing of rows. Until then every row renders a visible
  "hash-anchored, unsigned" mark. `UNATTESTED` status is reserved.
- Prose lint enforcing §4 placement.
- Automated vendoring of `verdicts/` at a pinned commit.
- Lane 2 and Lane 3 runs. Each lane re-earns both cells against a twin staged
  in that catalog.
- Any full-surface run beyond `cik % 10`.

## 9. STATUS.md row (to add on ship)

"BASELINE ledger renders Lane 1 both cells and one surface audit, gated by
`check-ledger.mjs` with negative controls. Signing, prose lint, lanes 2–3:
not built."

---

# Amendments — 2026-08-31 (as built)

The v1 implementation deviates from the text above in these ways; where they
conflict, the amendment is what is built and enforced.

1. **Standalone repo, page at root.** BASELINE is its own repo, not a site
   subdirectory; `build.mjs` emits `./index.html` (committed) so any static
   host serves the repo as-is. §3.3's "copy to site" is a copy into this
   repo's `ledger/`.
2. **§7's naming question was already decided by §2.2's own schema.** A
   required `doc_url` plus a committed fetched page *is* the naming act — a
   vendor docs page carries the vendor's identity throughout, and committing
   it publishes it at build time, not publish time. As built: the vendor is
   de-named (`surface: commercial-fundamentals-api`, `vendor_alias:
   APERTURE`), `doc_url` is dropped, and the committed snapshot is the
   machine-audit artifact (relative doc paths only, replayable against the
   vendor origin by the auditor script), never the vendor's own pages. The
   §4 audit sentence cites the artifact instead of a URL.
3. **`SURFACE_AUDIT` is corpus-shaped, not page-shaped.** What makes `ABSENT`
   credible is 48 pages searched with zero hits *plus* held method controls
   (live-fire, positive, negative). The row carries `docs_searched`,
   `controls`, and a `results` **list** (the one audit established both
   `NO_AS_OF_MODE` and `NO_ACCEPTANCE_INSTANT`); `check-ledger.mjs` fails any
   audit whose controls are not all held.
4. **The hand-copy seam is hash-bound.** `SOURCE.md` records a sha256 for
   every ledger file; `check-ledger.mjs` recomputes each and fails on any
   mismatch, any unlisted file, and any binding without a file. (§3's
   `content_hash`/`parallax_sha` are self-reported inside the copied file and
   bind nothing by themselves.)
5. **`CLAIMABLE` requires the twin's red to match the plant.** A twin `RED`
   whose per-check violation counts differ from `planted.expected_violations`
   fails the build — a red for the wrong reason credits nothing. Live rows
   carrying a plant also fail.
6. **Cell patterns outside v1 semantics refuse.** `live RED` or `twin GREEN`
   with both cells present is not mapped to any status; derivation throws and
   the build fails ("needs a human").
7. **Verdict extras.** Rows also carry `evaluated` (per-check non-vacuity
   evidence; `rows` must equal `evaluated.no_future_accepted`, and a check
   that evaluated 0 rows with a non-`UNEVALUABLE` result fails),
   `scope`, `params`, `content_hash_basis` (canonical Arrow IPC of the gated
   frame — hash what the gate consumed, not raw directory bytes),
   `parallax_worktree` (`clean`/`dirty`), and for twins `planted`.
8. **Windows-safe filenames.** `ran_at` is compacted (no colons) in
   filenames: `<surface>-lane<lane>-<cell>-<YYYYMMDDTHHMMSS[.ffffff]Z>.json`;
   the filename must agree with the row's surface/lane/cell.
9. **Row-backed numbers are interpolated, not hand-checked.** §3.5's "checked
   by hand" is replaced: the generator interpolates every row-backed number
   from the row JSON, and CI runs `build.mjs --check` so a committed page
   that disagrees with the ledger fails. Prose numbers without a row (the
   study-001 measurement) render under a visible "reported, not on the
   ledger" badge. The §4 placement lint remains v2.
10. **§8's `cik % 10` is study-001's scope.** The gate's evidenced scope is
    `cik % 97`; the v2 exclusion means "no full-surface run beyond the
    sampled scopes already evidenced."
11. **§9's row** was written to `STATUS.md` with the controls count added.
    An earlier version of this item also described a dirty-worktree
    disclosure; that no longer applies — the row instead records the
    worktree state at its most recent clean re-emit (see item 12). The
    controls count is 4 positive + 17 negative, up from 3+17 when this item
    was first written.
12. **2026-08-31, later the same day.** As-built history since item 11:
    (a) both verdict rows were re-emitted from a clean PARALLAX tree at the
    sha item 11 records; (b) the ledger's hash function was fixed to
    normalize CRLF to LF before hashing, closing the raw-byte pin
    false-positive caught in CI, and `.gitattributes` now forces LF in every
    working tree; (c) the twin row's `scope` field, previously the literal
    `"full surface"` inherited from the staged twin directory's own gate
    invocation, was corrected at the PARALLAX emission boundary
    (`verdict_row()` gained an explicit `scope` override, defaulted to the
    prior behavior) to name the sampled basis instead of the directory's
    apparent full population — this correction's own re-emission ran
    against a PARALLAX tree the fix itself had left dirty, so the rows it
    produced are stamped `parallax_worktree: dirty`, a regression from
    item 12(a)'s clean emission pending a PARALLAX commit and a follow-up
    clean re-emit; (d) GitHub Pages was enabled, publishing `main` root at
    https://hossainpazooki.github.io/baseline/.
13. **2026-09-01.** Supersedes item 12(c)'s open end. (a) The twin-scope fix
    was committed in PARALLAX as `25e12b8` and both lane-1 rows were
    re-emitted from the clean tree, so they are stamped
    `parallax_worktree: clean` and the twin names its real basis
    (`staged twin over cik % 97 == 0 sample`); the live cell's
    `content_hash` reproduced for a fourth independent time, now recorded as
    its own paragraph in `ledger/SOURCE.md`. (b) The de-naming invariant
    became an executable gate, `scripts/denaming-sweep.sh`, reading a
    gitignored `.denylist`; the previous hand-run grep had its pattern
    written into its own documentation, which both made it fire on itself and
    committed the very term the policy forbids. A missing or empty list is
    UNEVALUABLE (exit 2), never clean. (c) The page gained a "three pieces"
    orientation section naming VANTAGE and PARALLAX with links, each bound to
    the rows by an interpolated field (`surface`, `parallax_sha`). (d) The
    canonical host moved from GitHub Pages to Vercel
    (<https://baseline-beryl.vercel.app/>), whose build command runs the
    controls, the ledger gate and `build --check`, making the page-may-not-
    outrun-its-rows invariant enforced by the host and not only by CI. Pages
    was retired; superseding item 12(d).
14. **2026-09-01, later.** Granularity pass: the page now renders row fields
    it previously held back — per-check `evaluated` counts and plain-language
    check semantics (tied to `parallax_sha`; an undescribed check renders a
    dash, never a guess), the `scope` of every cell (a new verdict-table
    column and the diagram's live-node label), the viewpoint params `d` and
    `d_earlier`, the plant's expected-vs-observed violation vectors with the
    exact-match rule stated, a field-by-field run-anatomy table (identical
    live/twin values collapse into one spanning cell only when equal, so
    layout cannot hide a divergence), and the audit row's `doc_scope`,
    method-control booleans, and verbatim `notes`. Every added value is
    interpolated from a row; no new hand-typed figures.
15. **2026-09-01, later still.** The prose-only "three failures" paragraph
    became the essay's broken-baseline card grid, extended by one: figures
    00-02 are the essay's variants verbatim (zero / unknown `B = ?` /
    flexing), and figure 03 is variant 01 with the dashed red `B = ?`
    replaced by a solid gold `B = cited` — the held baseline. Each card's
    "on this ledger" half is bound to evidence: 00 to the audit row's
    results/corpus/dating-field, 01 to the checker rule that a lone live
    cell derives PARTIAL (held by the named control "lone live cell passes"),
    02 to the twin row's plant and violation vector, 03 to the derived lane
    status and the live cell's rows/viewpoint. Interpolated, never typed.
16. **2026-09-01, evening.** Layout inversion so the card grid stops being
    buried: the checks table, plant sentence, and run-anatomy table moved
    into a native `<details>` disclosure directly under the claim sentence
    (nothing removed, one click away, works without JS); the card grid now
    follows the diagram immediately and gained a nav anchor. Two prose
    sections were deleted as duplicative rather than moved: the Bessel
    paragraph (card 03 carries the standard; the essay carries the story)
    and the standalone vendor-finding section (card 00 carries the essence;
    the audit row's sentence, verbatim notes, method controls, and corpus
    now live in a second disclosure attached to the SURFACE_AUDIT table).
    The 1.51% badged measurement kept its own section, after the cards.

---

# Amendments — 2026-09-14 (re-emitting without rewriting: supersession, generations, multi-twin cells, check-by-check crediting)

Everything below is built and enforced by `scripts/lib/ledger.mjs`,
`scripts/check-ledger.mjs` and `scripts/build.mjs`, each rule held by a
named control in `scripts/test-ledger.mjs`. The committed page did not move:
`build.mjs --check` passes against the unchanged `index.html`. Nothing here
re-emits a row; the two committed lane-1 rows are still the only verdicts.

**A1. Input holes.** The original loader selected rows with
`f.endsWith(".json")` (case-sensitive) and never checked that a directory
entry was a regular file, so an uppercase-extension file (`BAD.JSON`) could
be hash-bound in `SOURCE.md` yet never loaded as a row, and a subdirectory
inside `verdicts/` was silently skipped. Every regular file in a rows
directory is now a row regardless of extension case, and any non-regular
entry refuses the ledger; `ledger/runs/` may hold only generation
directories, so a file placed directly in it is refused. The gate also lists
the whole ledger root: every file under `ledger/` except `SOURCE.md` must be
bound, and the root may hold only `verdicts/`, `audits/`, `snapshots/`,
`runs/`, `SOURCE.md` and `supersession.json`. Before this, a row in
`ledger/verdicts-old/`, a loose `ledger/*.json`, or a case variant such as
`ledger/Verdicts/` on a case-sensitive runner passed the gate and would still
have been served. Controls: "subdirectory in verdicts/", "bound upper-case
BAD.JSON live-RED row", "bound row in a folder outside the rows
directories", "unbound loose file at the ledger root". `snapshots/` is not a
rows directory: every file in it must be named as the `audit_artifact` of an
audit row, a file there that is itself a verdict row is refused by name, and
an audit's `audit_artifact` must name a file under `snapshots/`. Before this,
a bound live RED verdict row placed in `ledger/snapshots/` passed the gate
and the page still rendered CLAIMABLE. `audits/` already refused any row
whose kind is not `SURFACE_AUDIT`. Controls: "verdict row hidden in
snapshots/", "snapshot that no audit row names", "verdict row in audits/",
"audit artifact outside snapshots/".

**A2. Supersession.** A superseded row is never edited or deleted — a
hand-copied row must stay byte-identical to what the gate emitted or its own
binding breaks — so a replacement is a pointer:
`ledger/supersession.json` is exactly
`{"superseded": {"<row path>": "<successor row path>"}}`, hash-bound like
every other ledger file; absent and empty mean the same thing, and any other
shape (`null`, an unknown key, a non-string target) is refused with a named
reason. Each pointer joins two existing rows of the same surface, lane and
cell; the successor's `ran_at` is strictly later and it sits in a later
generation; a twin's successor carries the same `planted.mutation` (compared
after trimming, and two mutations that differ only by case or whitespace are
refused); the pointer graph has no cycle. The current generation is
derived, never named: the one directory holding every non-superseded row,
and no superseded row may sit in it. `build.mjs` renders superseded rows in
a separate "superseded, history only" table at their published URLs, each
with its own result and a link to its successor.
`check-ledger.mjs --current-generation` prints the current generation, and
exits 2 — never a guess — when the gate refuses the ledger or the rows span
more than one directory.

**A3. Generations and time.** `ledger/verdicts/` is generation zero; later
generations are `ledger/runs/<YYYYMMDDTHHMMSS[.fraction]Z>/`. A generation
directory name must parse as a UTC instant on a real calendar date, two
names may not denote the same instant, a generation may not be empty, and
every row of a generation must have run strictly after every row of each
earlier generation, so directory order and `ran_at` order agree. A
generation's stamp is also no later than the earliest `ran_at` of its own
rows, and later than the latest row of the generation before it (the legacy
directory included), so a stamp cannot sit outside the run it names; before
this, `runs/19990101T000000Z` holding rows that ran in 2026 was accepted as
the current generation. `ran_at` is
parsed as a strict ISO-8601 UTC instant (`YYYY-MM-DDTHH:MM:SS[.fraction]Z`,
real calendar date) and instants are compared as parsed values; the earlier
string comparison ranked `…48.9Z` after `…48.951466Z` and let an older
successor, a `+05:00` offset and the string `9` through. **The known cost:**
a new generation must re-emit every cell of every lane that is still live,
not only the one being changed; a ledger whose non-superseded rows span two
directories is refused, so "the current generation" is always one place a
reader can point at.

**A4. Two row dialects, one per generation.** Rows in `ledger/verdicts/`
keep the dialect they were published in (`parallax_sha`,
`parallax_worktree`), frozen. Rows in a generation directory are the shared
GATE_VERDICT row, schema version 1, which a conformance pack checks across
the repositories that adopt it (DATUM, a private governing text, defines
both): its properties are a closed set, so an unknown top-level key is
refused and so is a leftover `parallax_*` key; it carries `schema` (its
exact version-1 identifier), a 40-hex `gate_sha`, `gate_worktree` of `clean`
or `dirty`, and `unevaluable_reason` exactly when `result` is `UNEVALUABLE`.
A shared row also obeys the cross-field rules the pack applies to it:
`checks` has at least one check; every count in `checks`, `evaluated` and
`planted.expected_violations` is a non-negative integer; `evaluated` has
exactly the keys of `checks`; a GREEN live has no violations and a RED twin
has some; `planted` holds exactly `mutation`, `mutated_rows` and
`expected_violations`, and the plant expects at least one violation.
Without these, a live GREEN and a twin RED that both reported no checks at
all derived CLAIMABLE (with no check keys, nothing is left unfalsified), and
a live GREEN with violations was credited. In every row, a status literal is
refused as a whole word in any string or object key. This ledger
additionally keeps requiring `rows`, bound to
`evaluated.no_future_accepted`, and the binding can no longer be skipped: a
`checks` or `evaluated` that is null or not an object is refused by name,
where before it passed the gate and crashed the page build. A ledger file
with a duplicate JSON key at any depth is refused, as malformed JSON is
(exit 1): `JSON.parse` keeps the last of two equal keys without a word, so a
row could carry `"result": "RED"` and then `"result": "GREEN"` and read as
GREEN. `build.mjs` labels the gate commit by the field the row actually
carries (`parallax_sha` or `gate_sha`), and compares a plant with its checks
through the library rather than by serialized key order. The single-surface
guard in `build.mjs` and the `rows` binding hold for both dialects.

**A5. Several twins per cell, in shared-row generations.** A cell in a
generation directory may hold several twins with distinct
`planted.mutation` values (required there, matching `[a-z0-9_]+`); a second
twin with the same mutation is refused, mutations are compared after
trimming, and two that differ only by case or whitespace are refused rather
than counted as two twins. File names carry the cell and, for a twin, the
mutation: `<surface>-lane<n>-live-<stamp>.json` and
`<surface>-lane<n>-twin-<mutation>-<stamp>.json`, the mutation segment equal
to `planted.mutation`; the legacy file-name rule is unchanged. The page
renders every twin: the figure, the checks table and the run-anatomy table
gain one column per twin (anatomy cells still collapse only when every value
agrees), the plant sentences, the card that shows the plant and the verdict
table list each twin, and the stored-viewpoint card counts them. A control
asserts each of those places; forcing the single-twin rendering used to
leave the suite green. With exactly one twin every rendered string is the
one the page has always rendered. The frozen legacy
generation keeps its one-twin-per-cell rule; this lifts, for new
generations only, the one-twin rule recorded as a locked decision on
2026-09-06.

**A6. Status credited check by check, in shared-row generations — and why
the legacy derivation stays frozen.** A GREEN live with at least one twin,
every twin RED as planted, is CLAIMABLE only if every check key the live row
reports has been set nonzero by at least one of those twins; otherwise the
lane derives PARTIAL and the page names the unfalsified checks on the status
board and in the stored-viewpoint card. A group with any UNEVALUABLE row
derives UNEVALUABLE, and check-by-check crediting does not apply to it; a
lone live, or twins without a live, derive PARTIAL. This is the status the
conformance pack derives, so this ledger's own derivation can be compared
with the pack's once the pack is vendored.

Measured before choosing, read-only, against the committed lane-1 rows
(`ledger/verdicts/vantage-gold-local-parquet-lane1-{live,twin}-*.json`):

| live check key | live value | twin value | set nonzero by the twin? |
|---|---|---|---|
| `no_future_accepted` | 0 | 1 | yes |
| `as_of_monotonicity` | 0 | 0 | **no** |
| `restatement_visibility` | 0 | 1 | yes |

The single plant (`plant_future_accepted`, one row) never moves
`as_of_monotonicity` off zero, so applying check-by-check crediting to these
rows would change the published lane-1 status from CLAIMABLE to PARTIAL.
Changing what the committed page renders was not on the table, so the rule
applies to the shared-row dialect only: `ledger/verdicts/` keeps its
published derivation, frozen (CLAIMABLE when its one live is GREEN and its
one twin is RED matching the plant, no check-by-check crediting). The
consequence is scheduled, not avoided: once these rows are re-emitted into a
generation directory with this one plant, lane 1 derives PARTIAL naming
`as_of_monotonicity`, and it derives CLAIMABLE again only when some twin —
for instance a second plant that breaks monotonicity — sets that check
nonzero. A scratch build of the real rows converted into a generation showed
both: PARTIAL naming `as_of_monotonicity` with the one twin, CLAIMABLE with a
second twin that sets it nonzero.

**A7. Every generation satisfies the structural cell rules on its own; a
needs-a-human result refuses only in the current generation.** Superseded or
not, a generation must hold valid rows, one live per cell and distinct twin
mutations (one twin per cell in the legacy dialect), keep the `rows` binding,
and have every file bound; a superseded generation that breaks one of these
still refuses the ledger. A live RED (a real surface failed), a GREEN twin
(the gate missed the plant) and a twin RED that does not match its plant (a
red for the wrong reason) refuse the ledger only when the row sits in the
current generation, and there they are checked before a cell can derive
UNEVALUABLE, so an UNEVALUABLE row in the same cell never hides one. In a
superseded generation such a row stays as history: the page shows its result
and links its successor in the history table, it never appears in the main
gate-output table beside the current rows, and the ledger is accepted. The
legacy dialect follows the same split, so a lone live RED or a lone GREEN
twin in the current legacy generation now refuses, where the published
derivation rendered it PARTIAL; the committed rows are a GREEN live and a RED
twin as planted, so the page does not change. Controls: "superseded shared
generation with a live RED renders as history with its result and successor
link", the same for a GREEN twin and for a twin RED for the wrong reason;
"superseded rows render in the history table only, never in the main
gate-output table"; "live RED in the current shared generation", "GREEN twin
in the current shared generation", "twin RED for the wrong reason in the
current shared generation", "lone live RED in the current legacy
generation"; "superseded shared generation with a second live stays refused"
and "superseded shared generation with a duplicate twin mutation stays
refused"; for row validity on a superseded row, "superseded shared
generation with a twin RED over zero checks stays refused", "... with a live
GREEN carrying violations stays refused", "... with rows not equal to
evaluated stays refused" and "... with an UNEVALUABLE row without a reason
stays refused"; for bound files, "superseded row missing from SOURCE.md
stays refused" and "superseded row whose bytes drift from its SOURCE.md hash
stays refused".

The repository's owner decided this reading. The rule, in the owner's words:

> Rules per generation - Each generation must satisfy the cell rules on its
> own. A superseded RED or GREEN twin may stay only as history, and the page
> shows its result with a link to its successor. Tests pin this.

On whether a superseded live RED is history too, the owner's clarification of
2026-09-15, verbatim:

> Live RED becomes history too - A later GREEN generation supersedes a RED
> live. The RED stays on the page in the history table, with its result and a
> link to its successor. Round 4 already built this.

The behaviour that clarification calls already built is the behaviour this
item records.

**A8. Command lines.** `check-ledger.mjs [ledger-dir] [--current-generation]`
and `build.mjs [--check]` refuse any unknown flag or extra positional
argument with exit 2; `build.mjs` refuses before gating or writing anything.

**A9. Adopting the pack — not built.** When the conformance pack is vendored
into this repository it lives at `gates/conformance/`, pinned to a pack
commit, and CI runs it next to `check-ledger.mjs`; the shared-row derivation
above is the second derivation of status that CI then compares with the
pack's, failing on disagreement. Re-emitting the lane-1 rows (an operator
step that needs the gold surface), renaming the fields in the PARALLAX
emitter, vendoring and that CI step are all still not built.

**A10. Generation zero is frozen in code.** `ledger/verdicts/` must hold
exactly the two committed lane-1 rows, each at its committed sha256
(LF-normalized, the hash `SOURCE.md` records). The file set and the hashes
are fixed in `scripts/lib/ledger.mjs`, so a legacy row cannot be added,
changed or removed, rebound in `SOURCE.md`, and then judged under the
legacy rules; new rows go into a generation directory. The test fixtures
therefore carry byte copies of the committed rows. A control that has to
reach a changed legacy generation still names its own reason beside the
freeze's; where a rule can only be shown on a changed legacy generation (a
superseded legacy live RED, lone RED live or lone GREEN twin), the control
asserts that the freeze is the only refusal. Controls: "legacy row added to
generation zero", "committed legacy row changed and rebound", "committed
legacy row removed", "the committed ledger passes the gate".
