# Handoff — BASELINE conformance ledger v1, built and published

2026-09-01. Newest commit this brief describes: **`b4656610bc9b06ac97dc810658ff408ce2f2e505`**
(baseline `main`, CI green, run 33432063605). PARALLAX side:
**`3a70dfa8270c66a1637b24734291dc1b2ca793a7`**.

Measure drift from those two commits. **Both repos carry substantial
uncommitted work at the time of writing** — see Open / next. Nothing below
claims the working tree is committed or pushed.

## Current state

**BUILT — the ledger and its gate.** Rows under `ledger/` (two `GATE_VERDICT`
cells for lane 1, one corpus-shaped `SURFACE_AUDIT`), hash-bound in
`ledger/SOURCE.md`, validated by `scripts/check-ledger.mjs`, which is itself
held by 4 positive and 17 negative controls in `scripts/test-ledger.mjs`. A
control that does not fail the check is a test failure.
re-verify: `cd ~/dev/baseline && node scripts/test-ledger.mjs && node scripts/check-ledger.mjs`

**BUILT — the page, generated not written.** `scripts/build.mjs` reads the
rows and emits `./index.html` (committed, so any static host serves the repo
as-is). Every row-backed number is interpolated from row JSON; prose without a
row carries a visible "reported, not on the ledger" badge. Statuses are
recomputed from cells at every build for all three lanes.
re-verify: `cd ~/dev/baseline && node scripts/build.mjs --check`

**BUILT — published.** GitHub Pages serves `main` root at
https://hossainpazooki.github.io/baseline/. Verified by probing, with a 404
negative control so the 200s mean something. The repo was already `PUBLIC`
before Pages.
re-verify: `curl -sS -o /dev/null -w '%{http_code}\n' https://hossainpazooki.github.io/baseline/ && curl -sS -o /dev/null -w '%{http_code}\n' https://hossainpazooki.github.io/baseline/ledger/verdicts/no-such-row.json`
(expect `200` then `404`; a `200` on the second line means you are reading a
fallback and every other probe on this page proves nothing)

**BUILT — CI.** `.github/workflows/ci.yml` runs the negative controls, then the
ledger gate, then `build.mjs --check`, in that order. No `|| true`.
re-verify: `cd ~/dev/baseline && gh run list --limit 3`

**BUILT — the emitter, PARALLAX side.** `gate/verdict.py` serializes a
`GateReport` into a row (canonical Arrow-IPC content hash, git sha + worktree
state, Windows-safe filenames, LF newlines); `scripts/run_gate_local.py
--emit-verdicts` writes the live and twin cells.
re-verify: `cd ~/dev/parallax && .venv/Scripts/python.exe -m pytest tests/test_verdict.py -q`

**BUILT — the twin-scope correction, and the clean re-emit it gated.** Landed
in PARALLAX as `25e12b8`; both lane-1 rows were re-emitted from the clean tree
on 2026-09-01 and now carry `parallax_worktree: clean` with the twin's real
scope (`staged twin over cik % 97 == 0 sample`) instead of a full-surface
claim. `STATUS.md` and `ledger/SOURCE.md` agree again.
re-verify: `cd ~/dev/baseline && grep -h '"scope"' ledger/verdicts/*.json` (no row may say "full surface")

**BUILT — the de-naming sweep as a real gate.** `scripts/denaming-sweep.sh`
reads a gitignored `.denylist`; missing or empty list is UNEVALUABLE (exit 2),
never clean. Replaces a hand-run grep whose committed pattern made it fire on
its own documentation.
re-verify: `cd ~/dev/baseline && sh scripts/denaming-sweep.sh`

**BUILT — Vercel hosting config.** `vercel.json` runs the negative controls,
the ledger gate and `build --check` as its build command, so a ledger that
contradicts the page cannot reach the live URL. It verifies rather than
regenerates, which is what keeps "what is live is what is in git" true. The
sweep is deliberately absent from that build: `.denylist` is gitignored, so it
would be permanently unevaluable there and stays a local pre-commit gate.
re-verify: `cd ~/dev/baseline && sh -c "node scripts/test-ledger.mjs && node scripts/check-ledger.mjs && node scripts/build.mjs --check"; echo "exit=$?"`

**BUILT — the orientation section.** The page now names VANTAGE and PARALLAX
with links, each bound to the rows by a field interpolated from them
(`surface`, `parallax_sha`) rather than typed.
re-verify: `cd ~/dev/baseline && grep -c 'pit-fundamentals-lakehouse\|pit-revision-examiner' index.html`

**NOT STARTED.** Row signing (rows render "hash-anchored, unsigned";
`UNATTESTED` reserved), the §4 prose-placement lint, automated vendoring of
`verdicts/` at a pinned commit, lanes 2 and 3, any full-surface run, and a row
kind for the study-001 measurement (17,787 filer-quarters / 1.51% sign flips
currently renders badged, not on the ledger).
re-verify: `cd ~/dev/baseline && sed -n '/^## 8\./,/^## 9\./p' docs/specs/2026-08-29-baseline-ledger-design.md`

## Locked decisions

- **BASELINE is a standalone repo, page at root.** Chosen 2026-08-31 so it can
  be hosted anywhere; `hossainpazooki.github.io/baseline` was concept-only.
  Reason still holds only while the page has no dependency on the site repo.
- **The audited vendor stays de-named** (`commercial-fundamentals-api`,
  `vendor_alias: APERTURE`). Design amendment 2. The `doc_url` field the
  original spec required was *dropped*, because a required doc_url plus a
  committed vendor page is itself the naming act. Note the limit recorded in
  `docs/learnings/2026-08-31-denaming-is-name-level-only.md`: the 48 corpus
  paths still fingerprint the vendor. Accepted risk, not protection.
- **Hashes are over LF-normalized bytes**, computed with `sha256()` in
  `scripts/lib/ledger.mjs`. Reason: a gate stricter than its own parser emits
  only false positives (it took CI down on 2026-08-31). `sha256sum` is wrong
  here and will silently produce mismatching pins.
- **Status is always derived, never authored.** `check-ledger.mjs` fails the
  build on any of the three derived-status literals appearing as a value in a
  row, and as of the 2026-08-31 fix wave `build.mjs` derives all three lanes
  rather than hand-writing lanes 2 and 3.
- **`CLAIMABLE` requires the twin's red to match the plant exactly.** A red for
  the wrong reason credits nothing; `live RED` or `twin GREEN` refuses to
  derive at all and fails the build ("needs a human").
- **The human owns git history in these repos.** Agents do not commit or push;
  they leave work in the tree and emit the commands. Uncommitted work is by
  design here, not an incomplete task.

## Reuse map

- `scripts/lib/ledger.mjs` — the **only** implementation of row validation,
  hashing, and derived status. `check-ledger.mjs` (the gate) and `build.mjs`
  (the generator) both import it, which is what makes "a status can never be
  authored" true rather than aspirational. Extend here, never fork the logic.
- `scripts/test-ledger.mjs` — the control harness. Add a control here for every
  new failure mode; the file already demonstrates the pattern (each control
  must fail for its *own* reason, matched by message pattern, so a control
  cannot pass by tripping an unrelated leg).
- `gate/verdict.py` (PARALLAX) — row serialization, including the `scope`
  override that exists specifically to keep a staged cell from publishing a
  full-surface claim. Read its docstring before adding a field.
- `ledger/SOURCE.md` — the hand-copy seam's hash bindings plus the replay
  command and its precondition. Any new ledger file must be bound here or the
  gate fails.
- `docs/specs/2026-08-29-baseline-ledger-design.md` — the design plus its
  as-built amendments. The amendments are the truth where they conflict with
  the body; add an item rather than editing the body.
- `docs/learnings/` — five dated findings from this build, each with a
  read-only re-verify line. Read these before re-deriving them the hard way.

## Invariants

- **Nothing on the page may claim more than the rows.** This is the product.
  A field that is true of a run but false as a published claim is a defect —
  see the twin-scope learning.
- **A verdict row is gate output and is never hand-edited.** If a row is
  wrong, the run is wrong. Fix the emitter and re-emit.
- **Never weaken a gate to make data pass.** If `check-ledger.mjs` fails, the
  ledger data or the prose is wrong.
- **Every ledger file is bound by hash in `SOURCE.md`.** Unlisted files and
  bindings without files both fail. Recompute with the repo's own `sha256()`.
- **A twin's `checks` must equal its `planted.expected_violations` exactly.**
  Violating this silently converts a corrupt twin into a green surface.
- **Fail-closed on unevaluable.** An empty evaluation domain is `UNEVALUABLE`,
  never `PASS`; any unevaluable cell refuses the whole run.
- **De-naming sweep before any publish-adjacent commit:**
  `sh scripts/denaming-sweep.sh` must exit 0. The denied terms live in a
  gitignored `.denylist`, not in the script -- a committed pattern is itself
  the naming act, and made the sweep fire on its own documentation. Missing
  or empty list is UNEVALUABLE and exits 2, never a green.
- **Emitted rows must be LF.** Python's `write_text` needs `newline="\n"`;
  `.gitattributes` holds the checkout side.

## Open / next

**The blocker is cleared.** The twin-scope fix landed in PARALLAX as
`25e12b8`, the gate was re-run from the clean tree, and both rows were
replaced with their bindings recomputed by the repo's own `sha256()`. The live
cell's `content_hash` came back
`sha256:3fcfb3c3c28a…` for the fourth independent time.

**The open item is hosting.** A Vercel project `baseline`
(`prj_mB2XNbHwqrXFMdM38Y0fDMsxtucD`) exists but has no git link, no
deployment and no domain — the link failed on first creation and
`create_git_project` cannot reconnect an existing unlinked project of the same
name. Connect `hossainpazooki/baseline` in that project's Git settings in the
Vercel dashboard; the push then deploys through the gated build. Note the API
quirk that cost time here: the project resolves under `teamId:
"hossainpazooki"` but 404s under `teamId: "team_hlDtyE3vPpE1GLfh831Ljal7"`,
and `list_projects` on the team id does not show it at all. Once the domain is
assigned, the canonical URL moves off GitHub Pages and Pages is retired — a
second commit, so that no commit ever names a URL that is not yet live.

**Then, in rough value order:** a `MEASUREMENT` row kind so the study-001
numbers (the strongest thing on the page) stop wearing the "reported, not on
the ledger" badge; an ADR for row supersession before anyone cites a row URL
(see the learning — correcting a row 404s its predecessor, and one such URL is
live right now); a clause in `SOURCE.md` recording that three independent runs
reproduced the same `content_hash`, which is the best evidence here and is
currently stated nowhere in the prose; and lane 2, whose real blocker is
producer-side in VANTAGE (gold is a path-addressed Delta table on a UC volume,
so there is no catalog-managed object to read through).

**Known-stale on arrival:** none outstanding. The `docs/specs/…` §7 heading,
flagged in an earlier draft of this brief as still reading "Open items …
blocking publish" on a published repo, was rewritten to record both items as
resolved (amendments 2 and 9) before this brief was committed.
