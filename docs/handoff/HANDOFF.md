# Handoff index

Pointers only, newest first. Entries are immutable: a later session writes a
new dated brief rather than editing an old one. Evidence lives in the briefs
and in `docs/learnings/`, never here.

| brief | describes commit | one-line |
|---|---|---|
| [2026-09-15-content-hash-form-change](2026-09-15-content-hash-form-change.md) | `0b2e184` (baseline) | `content_hash` restated to what it identifies, with the measured read-back hashes and a frozen-twin disclosure; supersedes the 2026-09-06 brief's "fifth corroborating run" instruction, because the re-emit carries a new basis and starts its own corroboration. |
| [2026-09-06-datum-ruling-supersession-first](2026-09-06-datum-ruling-supersession-first.md) | `775978f` (baseline) · `91be859` (datum) | pick-up green, nothing changed in-repo; DATUM ruling makes the single-surface guard an invariant; `superseded_by` first, then DATUM adoption (`gate_sha` re-emit) with the operator; figure lock has lost its referent. |
| [2026-09-01-reviewer-portal-on-vercel](2026-09-01-reviewer-portal-on-vercel.md) | `45a9a46` (baseline) · `9c59d5e` (site) | portal restyle in the site design system, evidence-backed baseline cards, self-contained public hero; open item is the fate of the site's /baseline page. |
| [2026-09-01-canonical-host-moved-to-vercel](2026-09-01-canonical-host-moved-to-vercel.md) | `8746530` (baseline) | canonical host moved to Vercel behind a gated build; GitHub Pages retired; supersession gap confirmed live rather than predicted. |
| [2026-09-01-baseline-ledger-v1-published](2026-09-01-baseline-ledger-v1-published.md) | `b465661` (baseline) · `25e12b8` (parallax) | v1 ledger built, gated, published on GitHub Pages; twin-scope fix landed and rows re-emitted clean; open item is connecting the Vercel git link before the canonical URL moves. |
