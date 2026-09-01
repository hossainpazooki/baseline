# STATUS

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
