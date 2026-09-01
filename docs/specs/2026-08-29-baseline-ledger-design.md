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
