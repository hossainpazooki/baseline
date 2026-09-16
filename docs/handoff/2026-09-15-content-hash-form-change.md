# Handoff -- `content_hash` restated; the form changes upstream, so corroboration restarts

2026-09-15. Newest commit this brief describes: **`0b2e184`**
(`docs: supersession amendment and STATUS entry`, `main`, tree clean at
session start; `git log -1 --format='%H %s'` ->
`0b2e1840ae2d44c758ce6a13fa73011778681281 docs: supersession amendment and
STATUS entry`). Pick-up measures drift from `0b2e184`.

**This brief supersedes one instruction** in
the 2026-09-06 brief indexed in `docs/handoff/HANDOFF.md`: its reuse map tells the
re-emit to add "a fifth run to add to the corroboration if the hash holds."
That instruction is withdrawn. The hash will not hold, by design: the emitter
upstream changes the canonical form, so re-emitted rows carry a new basis and a
new hash and begin their own corroboration at one run. The rest of that brief
stands.

## What changed here

Prose only. No row was emitted, edited or removed; `ledger/verdicts/` is
untouched and every `SOURCE.md` sha256 line is unchanged. The committed page
was regenerated (`node scripts/build.mjs`) because two of the sentences live in
`scripts/build.mjs`.

- `ledger/SOURCE.md` -- the replay paragraph now says what `content_hash`
  identifies (the values of the gold columns, in the row order and under the
  serialization the row's basis names) instead of claiming a frame a reader
  holds can be confirmed byte-identical to the one the gate read. Three dated
  notes follow it: the correction, with the measured read-back hash; the twin
  row disclosure; and a scope note on the four-run corroboration paragraph,
  which withdraws its "real identity check on the bytes" clause while keeping
  the four-run evidence.
- `scripts/build.mjs` -- the orientation paragraph's `content_hash` sentence
  restated the same way, and a disclosure beside the run-anatomy table's hash
  basis row, rendered only for the twin row that was measured (keyed on that
  row's own `content_hash`, so a row emitted under the new basis gets no note).
- `docs/specs/2026-08-29-baseline-ledger-design.md` -- dated in-place correction
  notes under the `GATE_VERDICT` field table and under amendment item 7, where
  "hash what the gate consumed, not raw directory bytes" claimed more than the
  old basis delivered.
- `docs/learnings/2026-09-15-cross-run-stability-is-not-frame-identity.md` --
  narrows, and does not kill,
  `2026-08-31-canonical-frame-hash-is-cross-run-stable.md`; that entry is
  immutable and still true for frames built from the Delta table the same way.

## The measurement everything above rests on

Both published rows reproduced their recorded hashes; a staged copy of the same
values, read back the way the gate reads it, did not:

```
polars 1.43.2
live cik%97 from Delta          sha256:3fcfb3c3c28a0c28f3dc3e454b89767461f34fa6431238f58633c4bad8a31b65
live staged parquet read back   sha256:b27eaac16b3e75d09d1f92a3d8482f3fb0e56724bce31257f8473aab44b33501
twin future_accepted in memory  sha256:01be4edf771b9a2fc84f86c93b6c79a858f1c3f6621ce5073609a062be43ff47
twin staged parquet read back   sha256:bbe60bf9daf145f7505565b434a1dbd9098c108862610f5aa2e5033ba0ebea8c
```

The learnings entry carries the full comparison, including the pinned form
under which the frame and its read-back agree, and the re-verification command.

## Gates at handoff

All four green, run in this working tree after the edits:

```
test-ledger: 22 positive + 119 negative controls + 7 CLI checks, all held
check-ledger: all rows bound, valid, and status-free
build --check: committed page matches the ledger
denaming-sweep: clean (2 terms, 0 hits)
```

## Invariants this brief does not change

- `ledger/verdicts/` is generation zero and frozen in code: the two committed
  lane-1 rows at their committed sha256. The twin discrepancy above is
  disclosed, never edited into the row.
- Learnings and handoffs are immutable. This brief supersedes an instruction in
  an earlier brief by saying so here; that brief is not edited.
- `SOURCE.md` prose may change; its sha256 lines may not. None moved.
- The de-naming sweep runs before any publish-adjacent commit; exit 2 is
  unevaluable, never clean.

## Open / next

1. **Re-emit the lane-1 rows under the new basis** -- an operator step, it needs
   the gold surface. The re-emitted rows go into a generation directory, not
   into `ledger/verdicts/`; the old rows stay published and are pointed at
   their successors through `ledger/supersession.json`. Their corroboration
   starts at one run. Do not look for a fifth run under the old hash.
2. **Retire the twin disclosure when it has no referent** -- the disclosure is
   keyed on the published twin row's `content_hash`. Once that row is history
   and a successor carries the new basis, decide whether the note belongs on
   the history table instead of the current cell.
3. Everything on that brief's own open list, except its fifth-run instruction.

**Untracked at handoff:** this brief, its index row, the learnings entry and
its index row. Everything else is a modification. Suggested commits, from the
repository root:

```bash
git add ledger/SOURCE.md scripts/build.mjs index.html docs/specs/2026-08-29-baseline-ledger-design.md
git commit -m "docs: restate what content_hash identifies"
git add docs/learnings/2026-09-15-*.md docs/learnings/LEARNINGS.md
git commit -m "docs: learning, cross-run stability is not frame identity"
git add docs/handoff/2026-09-15-content-hash-form-change.md docs/handoff/HANDOFF.md STATUS.md
git commit -m "docs: handoff, content_hash form change"
git push
```
