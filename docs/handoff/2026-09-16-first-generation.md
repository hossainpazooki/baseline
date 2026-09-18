# Handoff -- the first shared-row generation: lane 1 re-emitted under the new basis

2026-09-16. Newest commit this brief describes: **`867da65`**
(`docs: content-hash learnings entry and handoff`, `main`; `git log -1
--format='%H %s'` -> `867da659c8578e84492c50341df900dd98169790 docs:
content-hash learnings entry and handoff`). Pick-up measures drift from
`867da65`. Everything below is **uncommitted** on top of it.

This brief closes **Open / next item 1** of the 2026-09-15 brief (the
re-emit) and settles its item 2 (where the twin disclosure goes once its row
is history: under the history table).

## What changed here

- **built, uncommitted** -- `ledger/runs/20260916T204716.976835Z/` holds the
  four rows the PARALLAX gate emitted at its commit
  `fc962f584074aee9903115b50a295e1ab699fc56` on a clean tree, copied byte for
  byte: one live row, three twin rows named for their mutations.
  re-verify: `node scripts/check-ledger.mjs --current-generation` ->
  `runs/20260916T204716.976835Z`
- **built, uncommitted** -- `ledger/supersession.json` points the two
  generation-zero rows at their successors (live to live; the twin to the
  `plant_future_accepted` twin, the same mutation). Every ledger file is
  bound in `SOURCE.md`; the four new rows and the changed pointer file have
  new lines, no existing line moved.
  re-verify: `node scripts/check-ledger.mjs` -> `check-ledger: all rows
  bound, valid, and status-free`
- **built, uncommitted** -- the page regenerated: the current cell reads the
  shared rows (credited check by check, no unfalsified check, CLAIMABLE); the
  history table shows the two superseded rows with successor links; the
  twin-basis disclosure of 2026-09-15 now renders under the history table,
  keyed on the superseded twin's hash, and the orientation sentence names
  generation zero as the rows a copy does not reproduce.
  re-verify: `node scripts/build.mjs --check` -> `build --check: committed
  page matches the ledger`
- **built, uncommitted** -- `SOURCE.md` labels its header block as generation
  zero and gains a section for the new generation (gate commit, basis, live
  hash, one-run corroboration); `STATUS.md` gains the 2026-09-16 entry and a
  dated correction on the known-limits bullet that said the ledger held no
  rows under the new basis.
- **not run** -- CI and the Vercel deploy; both run on the operator's push.

## Locked decisions

1. **A generation is the whole lane, re-emitted.** Four rows landed, not
   one: the ledger refuses non-superseded rows that span two directories, so
   the legacy twin had to be superseded by a twin of the same mutation and
   the other two twins are new cells of the same generation.
2. **The disclosure follows its row.** A note about a frozen row's basis is
   rendered wherever that row is rendered, and nowhere else.
3. **Corroboration is counted per basis and per gate commit.** One run under
   this basis at this commit. Earlier runs on the uncommitted emitter change
   produced the same live hash and are not evidence on this ledger.

## Reuse map

- `ledger/runs/<stamp>/` -- the stamp is the live row's `ran_at`, compacted
  (no later than the earliest row, later than every row of the generation
  before); the four file names are the emitter's own.
- `ledger/supersession.json` -- `{"superseded": {"<old rel>": "<new rel>"}}`;
  a twin's successor must carry the same `planted.mutation`.
- `ledger/SOURCE.md` -- one `sha256  path` line per ledger file, hashes over
  LF-normalized bytes (`scripts/lib/ledger.mjs` exports `sha256`); the
  generation section names the gate commit and the basis.
- `scripts/build.mjs` -- `DISCLOSED_TWIN_HASH`, `twinHashNote` (current cell)
  and `historyNote` (history table) carry the one disclosure.

## Invariants

- Generation-zero rows are frozen in code (`FROZEN_LEGACY`); a new generation
  never edits them.
- The current generation is derived from `supersession.json`, never named.
- Every published number in `SOURCE.md` and `STATUS.md` is pasted from a gate
  run or a row; the hashes here come from the copied rows themselves.
- Only the operator writes git history.

## Open / next

1. **Commit and push; watch CI and the deploy.** `ledger/runs/` is untracked
   and needs `git add`; everything else is a modification.
2. **Corroborate the new basis.** A second clean-tree run at the same gate
   commit should reproduce `sha256:4179658b0025...`; record it in `SOURCE.md`
   when it exists, not before.
3. **Everything on the 2026-09-15 brief's list except its items 1 and 2.**

**Known limits:** the guard that makes the new basis reproducible (the
emitter's read-back check) lives upstream and is not verified from this
repository; `check-ledger` verifies bindings and row rules, not that a hash
reproduces from a frame. The `evaluated` denominators of the new live row are
the gate's own counts and are not re-derived here.
