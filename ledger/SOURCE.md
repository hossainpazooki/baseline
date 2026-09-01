# Ledger source binding

Verdict rows were emitted by the PARALLAX gate (`scripts/run_gate_local.py
--emit-verdicts`) and hand-copied here; the audit snapshot is the committed
machine-audit artifact from PARALLAX study 002. This file binds every ledger
file to the sha256 recorded at copy time — `check-ledger.mjs` recomputes each
hash and fails the build on any mismatch or any unlisted/missing file. The
hand-copy seam is otherwise unverified.

- `parallax_sha`: `25e12b872eb554a7e877bc25fa908579dee7f87d`
- worktree at emission: **clean** — the verdict emitter, its LF-newline fix,
  and the twin-scope fix are all committed at this sha, so the emitter stamped
  both rows `clean`.
- copied: 2026-09-01

## sha256

Hashes are over **LF-normalized bytes** (CRLF → LF before hashing) — the
ledger's parsers are newline-insensitive and git re-encodes line endings per
platform, so raw-byte pins false-positive on checkout (caught in CI
2026-08-31; `.gitattributes` additionally forces LF in every working tree).

73069612316292b14319eb9730a1256c116d27107e842aca86068aeb91287bf7  verdicts/vantage-gold-local-parquet-lane1-live-20260901T174848.951466Z.json
b41c436b8ed7d3c439874a2611bc0f2bb902402b243e57882decb7195379d6b2  verdicts/vantage-gold-local-parquet-lane1-twin-20260901T174849.431640Z.json
ce10bac1d0793625d1c0948a867c10b189c4cfa556ed6ee0fc08ebc1b85815fb  audits/commercial-fundamentals-api-2026-08-20.json
f02d465124885cffa5e40b5e1a69c8a72aedc4e4e31848ab3e2e99c184cc60ff  snapshots/audit-2026-08-20.json

## Replay

```
# in the PARALLAX repo, at parallax_sha (or later):
.venv/Scripts/python.exe scripts/run_gate_local.py \
  --gold <path-to>/lake-backfill/gold --cik-mod 97 \
  --stage-twin <scratch> --emit-verdicts <out>
```

Replay requires access to the VANTAGE gold surface, which is not public; a
reader without it can still use `content_hash` to confirm that any frame they
do hold is byte-identical to the one the gate read.

**Cross-run corroboration.** Four independent gate runs on 2026-08-31 and
2026-09-01 — different working-tree states, different scratch directories,
different process invocations — all produced the identical live-cell
`content_hash`
`sha256:3fcfb3c3c28a0c28f3dc3e454b89767461f34fa6431238f58633c4bad8a31b65`.
That is the strongest evidence on this page: the canonical frame hash is
stable across runs, so a `content_hash` match is a real identity check on the
bytes the gate read and not an artifact of one execution. It says nothing
about whether the *surface* is correct — only that every run read the same
surface.
