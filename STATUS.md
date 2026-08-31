# STATUS

- **2026-08-31** — BASELINE ledger v1 built: renders Lane 1 both cells
  (live GREEN over 440,661 as-of rows; twin RED matching the planted error
  exactly) and one surface audit (48-page vendor corpus, controls held),
  gated by `check-ledger.mjs` with 3 positive + 17 negative controls run in
  CI before the page builds. Verdict rows re-emitted 2026-08-31 by a fresh
  gate run (`parallax_sha 71d3c9d`, worktree **dirty** — the verdict emitter
  itself was uncommitted at emission; rows carry the flag). Signing, prose
  lint, lanes 2–3, a ledger row for the study-001 measurement: **not built** —
  the 17,787 filer-quarter / 1.51% sign-flip measurement renders with a
  "reported, not on the ledger" badge.
