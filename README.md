# BASELINE

A conformance ledger for point-in-time correctness of fundamentals read
surfaces. Every read surface handles restatements against a baseline that is
**zero** (revisions overwrite in place), **unknown** (history exists but no
as-of query can reach it), or **flexing** (an as-of mode exists but its
boundary moves). BASELINE records, in dated machine-checkable rows, what the
[PARALLAX](https://github.com/hossainpazooki/parallax) PIT gate has shown
about named surfaces — and renders those rows as one page for two readers at
once: each row resolves to a replayable gate run for the technical reader, and
to one sentence for everyone else.

The rule the build enforces: **nothing on the page may claim more than the
rows.** The ledger reports on surfaces; it serves no data.

## Layout

- `index.html` — the page, generated; committed so any static host can serve
  the repo as-is
- `ledger/verdicts/` — `GATE_VERDICT` rows, written only by the PARALLAX gate
- `ledger/audits/` — `SURFACE_AUDIT` rows, hand-authored from vendor
  documentation audits (visibly not gate runs)
- `ledger/snapshots/` — committed audit artifacts the rows pin by hash
- `ledger/SOURCE.md` — sha256 binding for every ledger file + replay command
- `scripts/check-ledger.mjs` — the gate CI runs before the page may build
- `scripts/build.mjs` — generator; `--check` proves the committed page matches
  the ledger
- `scripts/test-ledger.mjs` — positive fixtures + negative controls; a control
  that does not fail the check is itself a test failure
- `docs/specs/` — the governing design and its amendments

## Verify locally

```
node scripts/test-ledger.mjs
node scripts/check-ledger.mjs
node scripts/build.mjs --check
```

Derived statuses (`CLAIMABLE` / `PARTIAL` / `UNCLAIMED` / `UNEVALUABLE`) are
recomputed from rows at every build; a status literal found in any row fails
the build. Rows are hash-anchored and unsigned — signing is a planned
extension. Evidence tables and dated results live in the rows and in
`STATUS.md`, not here.
