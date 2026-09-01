# Learnings ledger

Pointers only. Each entry is one dated fact with its basis and a read-only
re-verification line. Entries are immutable: a wrong entry is superseded by a
new dated entry carrying a `kills:` reference, never edited in place.

| entry | status | one-line |
|---|---|---|
| [2026-08-31-raw-byte-hash-pins-fail-only-in-ci](2026-08-31-raw-byte-hash-pins-fail-only-in-ci.md) | verified | Hashing raw bytes instead of LF-normalized bytes makes a gate stricter than its parser: green locally, red in CI, every time. |
| [2026-08-31-gate-scope-is-invocation-scoped](2026-08-31-gate-scope-is-invocation-scoped.md) | refuted-assumption | Emitting gate output verbatim is not automatically honest — a field true of the run can be false as a published claim. |
| [2026-08-31-ledger-has-no-supersession](2026-08-31-ledger-has-no-supersession.md) | verified | Correcting a row deletes its predecessor's published URL; the ledger keeps no history of its own rows. |
| [2026-08-31-denaming-is-name-level-only](2026-08-31-denaming-is-name-level-only.md) | verified | A clean name sweep proves the name is absent, not that the vendor is unidentifiable; 48 doc paths fingerprint it. |
| [2026-08-31-canonical-frame-hash-is-cross-run-stable](2026-08-31-canonical-frame-hash-is-cross-run-stable.md) | verified | Three independent gate runs produced an identical content hash — corroboration stronger than any single run. |
| [2026-09-01-a-gate-that-fires-on-its-own-docs](2026-09-01-a-gate-that-fires-on-its-own-docs.md) | verified | A grep gate with its pattern committed beside the thing it forbids fires on its own docs -- and leaks the term it guards. |
| [2026-09-01-project-pages-shadowed-the-site-path](2026-09-01-project-pages-shadowed-the-site-path.md) | refuted-assumption | A project repo's Pages shadows the user site's page at the same path; disabling it un-shadows rather than 404s — the post-retirement 200 was a different live page, not CDN cache. |
