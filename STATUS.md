# STATUS

- **2026-09-16** -- First shared-row generation: lane 1 re-emitted under the
  new basis. The four rows the PARALLAX gate emitted at its commit
  `fc962f584074aee9903115b50a295e1ab699fc56` (tree clean) are hand-copied
  into `ledger/runs/20260916T204716.976835Z/`: one live row (GREEN,
  `content_hash`
  `sha256:4179658b002599d44c40a85cd4675cc4f81b2b8f5f87c7d6a2ca5ada0e40474a`)
  and three twins (`plant_future_accepted`, `plant_vanishing_key`,
  `plant_wrong_winner`, each RED for exactly its planted counts). The two
  generation-zero rows are superseded through `ledger/supersession.json`
  (live to live, twin to the `plant_future_accepted` twin) and stay at their
  URLs as history. Lane 1 is credited from the shared rows check by check:
  `no_future_accepted` and `restatement_visibility` are set nonzero by the
  first twin and `as_of_monotonicity` by the second, so the lane derives
  CLAIMABLE with no unfalsified check. The page moved: the current cell
  reads the new rows, the history table shows the two superseded rows with
  successor links, and the twin-basis disclosure of 2026-09-15 moved with
  its row to the history table. `check-ledger.mjs --current-generation`
  prints `runs/20260916T204716.976835Z`. Gates after the change:

  ```
  check-ledger: all rows bound, valid, and status-free
  test-ledger: 22 positive + 119 negative controls + 7 CLI checks, all held
  build --check: committed page matches the ledger
  denaming-sweep: clean (2 terms, 0 hits)
  ```

  Corroboration under this basis at this commit is one run, this one.
  Earlier runs on the uncommitted emitter change produced the same live hash
  and are not on the ledger.

- **2026-09-15** -- What `content_hash` claims, restated. The page and
  `ledger/SOURCE.md` said a reader holding a frame could use `content_hash`
  to confirm it is byte-identical to the one the gate read. That was false and
  is withdrawn. The hash identifies the values of the gold columns, in the row
  order and under the serialization the row's own basis names; it is not a
  hash of a file. Measured this day against the gold surface: the live frame
  reproduces its published
  `sha256:3fcfb3c3c28a0c28f3dc3e454b89767461f34fa6431238f58633c4bad8a31b65`,
  but a copy of the same values written to parquet and read back the way the
  gate reads it hashes
  `sha256:b27eaac16b3e75d09d1f92a3d8482f3fb0e56724bce31257f8473aab44b33501`;
  the twin reproduces `01be4edf771b...` and its read-back hashes
  `bbe60bf9daf1...`. The two published rows are frozen, so the twin gap is
  disclosed on the page and in `SOURCE.md` rather than edited into the row,
  and the four-run corroboration paragraph keeps its evidence under a dated
  scope note. Prose only: no row emitted, edited or removed, no `SOURCE.md`
  sha256 line moved, the page regenerated because two sentences live in
  `scripts/build.mjs`. Gates after the change:

  ```
  test-ledger: 22 positive + 119 negative controls + 7 CLI checks, all held
  check-ledger: all rows bound, valid, and status-free
  build --check: committed page matches the ledger
  denaming-sweep: clean (2 terms, 0 hits)
  ```

- **2026-09-14** — Ledger mechanics for re-emitting rows, built; the live
  page did not move (`build.mjs --check` passes against the unchanged
  `index.html`). A row can now be retired without being edited:
  `ledger/supersession.json` (hash-bound, empty today) points a superseded
  row at its successor in a new generation directory
  `ledger/runs/<UTC stamp>/`, and the page renders superseded rows in a
  history table at their published URLs, with their result and a successor
  link. `ledger/runs/` may hold only generation directories: a file placed
  directly in it refuses the ledger, as does any subdirectory inside a
  generation, `verdicts/` or `audits/`. Every generation must satisfy the
  structural cell rules on its own, superseded or not: valid rows, one live
  per cell, distinct twin mutations, the `rows` binding, bound files;
  controls on superseded rows pin the row rules, the `rows` binding and the
  `SOURCE.md` binding there. A live RED, a GREEN twin or a twin RED for the
  wrong reason refuses the ledger only in the current generation (checked
  before a cell can derive UNEVALUABLE); in a superseded generation that row
  stays as history, shown only in the history table, with its result and a
  link to its successor. Rows in a generation
  directory use the shared row schema (DATUM, a private governing text,
  defines it) and the row rules the conformance pack applies: a closed
  property set, an exact schema id, a 40-hex `gate_sha`, at least one check,
  `evaluated` keys equal to `checks` keys, no violations on a GREEN live,
  some on a RED twin, and a plant that expects at least one violation. A
  cell there may hold several twins: each twin's file name carries its
  mutation, two mutations that differ only by case or whitespace are
  refused, and a twin's successor carries the same mutation. Lane status
  there is credited check by check, so a check no twin has set nonzero
  makes the lane PARTIAL and is named on the page. `ledger/verdicts/` is
  frozen to its two committed rows (file set and hashes fixed in code, so
  rebinding `SOURCE.md` cannot change it) and keeps its published
  derivation. Measured on those rows: the twin never moves
  `as_of_monotonicity` off 0, so check-by-check crediting would turn lane 1
  PARTIAL; that is why the rule applies only to new generations and today's
  page still renders CLAIMABLE. Also closed: a ledger file with a duplicate
  JSON key is refused; `snapshots/` may hold only files an audit row names,
  never a verdict row; a generation's stamp is no later than its first row
  and later than every row of the generation before it; `ran_at` is parsed
  as a strict ISO-8601 UTC instant and ordered as one; the whole ledger root
  is listed, so any file under `ledger/` must be bound and no unknown folder
  may sit there; both CLIs refuse unknown flags and extra arguments (exit
  2); `--current-generation` exits 2 on a ledger the gate refuses. Rules,
  the measurement and the known cost (a new generation re-emits every
  still-live cell) are in the design spec's 2026-09-14 amendment.
  `test-ledger.mjs`: 22 positive + 119 negative controls + 7 CLI checks,
  all held. Not built: re-emitting the rows, vendoring the pack. Known
  limits are listed at the end of this file.

- **2026-09-01** — Canonical host moved to Vercel:
  <https://baseline-beryl.vercel.app/>, deployed from `main` on push behind a
  build command that runs the negative controls, the ledger gate and
  `build --check` — so a ledger that contradicts the page cannot reach the
  live URL. GitHub Pages retired; it served the same page from 2026-08-31.
  Also this day: the de-naming sweep became a real gate
  (`scripts/denaming-sweep.sh` over a gitignored `.denylist`, missing or empty
  list is UNEVALUABLE, never clean), and the page gained an orientation
  section naming VANTAGE and PARALLAX, each bound to the rows by a field
  interpolated from them rather than typed.

- **2026-08-31** — BASELINE ledger v1 built: renders Lane 1 both cells
  (live GREEN over 440,661 as-of rows; twin RED matching the planted error
  exactly) and one surface audit (48-page vendor corpus, controls held),
  gated by `check-ledger.mjs`, itself held by 4 positive + 17 negative
  controls in `test-ledger.mjs`, run in CI before the page builds. Verdict
  rows re-emitted 2026-09-01 by a fresh gate run (`parallax_sha 25e12b8`,
  worktree **clean** — the verdict emitter, its LF-newline fix and the
  twin-scope fix are all committed at this sha; the twin cell now publishes
  its real scope instead of claiming the full surface). Signing, prose lint, lanes 2–3, a ledger row for
  the study-001 measurement: **not built** — the 17,787 filer-quarter /
  1.51% sign-flip measurement renders with a "reported, not on the ledger"
  badge. GitHub Pages enabled 2026-08-31, serving `main` root at
  https://hossainpazooki.github.io/baseline/.

## Known limits

Facts about this tree as it stands; none of them is fixed.

- Neither generation-zero lane-1 row's `content_hash` can be reproduced from
  a parquet copy of its frame: under the basis those rows carry, the
  serialization depends on
  how the frame was assembled in memory, so a staged parquet read-back of the
  same values hashes differently. Nothing in this repository detects that, and
  nothing here can: the guard -- an emitter that hashes its own staged
  read-back and writes no row on a mismatch -- is upstream, unverified from
  here, and would in any case apply only to rows emitted under the new basis,
  of which this ledger holds none. *Corrected 2026-09-16: the ledger now holds
  four such rows, in `ledger/runs/20260916T204716.976835Z/`. The guard is
  still upstream and unverified from here; what this repository holds is the
  rows the emitter wrote after its own read-back check, at the gate commit
  each row names.*
- A current-generation live row whose `params` has no `d` passes
  `check-ledger.mjs`, and `build.mjs` then stops with a `TypeError` and a
  stack trace (exit 1) instead of a named refusal; a twin row without
  `params.d` builds, and the run-anatomy table shows `undefined` for its
  viewpoints.
- A row file with a duplicate JSON key, a row file that is not JSON, and a
  row file that starts with a byte-order mark are each refused with exit 1,
  the gate's refusal class; the conformance pack reports the same three
  files as unevaluable, exit 2.
- For a shared-row lane holding a live row and no twin, the gate derives
  PARTIAL and names no unfalsified check; the conformance pack derives the
  same PARTIAL and names every check the live row reports.
- In a superseded generation the gate accepts, as history, a twin RED that
  does not match its plant; the conformance pack run over that generation's
  directory refuses the same row (exit 1), so the two agree only while the
  pack runs over the current generation alone.
- Node 22 and a case-sensitive filesystem are exercised only by CI
  (`.github/workflows/ci.yml`: Node 22 on `ubuntu-latest`); the local runs
  used Node 24 on Windows.
- `README.md` lines 41-43 state the crediting rule as one live GREEN plus
  one twin RED for the planted reason, and the README does not mention
  several twins per cell, check-by-check crediting or the frozen legacy
  generation.
- The 2026-09-06 records in `docs/handoff/` and `docs/learnings/` carry the
  private governing text's name on 24 and 2 lines and in their file names,
  and `docs/handoff/HANDOFF.md` and `docs/learnings/LEARNINGS.md` carry it
  on one line each; they are dated records and keep the wording they were
  written with.
- No control pins three defence-in-depth checks, and removing any one of
  them leaves the suite green: the stored-viewpoint card's sentence naming
  unfalsified checks, the `cell`/`result`/`checks` shape test that
  recognises an untyped verdict row in `snapshots/`, and the refusal of an
  empty, `.` or `..` segment in an audit's `audit_artifact`.
- No control places a file directly in `ledger/runs/`, and none depends on
  the walk into an unknown folder at the ledger root: removing the rule that
  `runs/` holds only generation directories leaves the suite green, and such
  a file is still refused as a rows directory that is not a directory;
  removing that walk leaves the suite green, and the folder is still refused
  by name.
- No control creates a symbolic link or junction under `ledger/`; the gate
  refuses any entry that is neither a regular file nor a directory, and in
  the suite only a subdirectory inside a rows directory reaches that
  refusal.
- A shared row's file-name stamp is not compared with its own `ran_at`: a
  live row named `...-live-20260914T120000Z.json` whose `ran_at` is
  `2026-09-14T12:00:05Z` passes the gate.
