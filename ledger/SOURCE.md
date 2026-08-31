# Ledger source binding

Verdict rows were emitted by the PARALLAX gate (`scripts/run_gate_local.py
--emit-verdicts`) and hand-copied here; the audit snapshot is the committed
machine-audit artifact from PARALLAX study 002. This file binds every ledger
file to the sha256 recorded at copy time — `check-ledger.mjs` recomputes each
hash and fails the build on any mismatch or any unlisted/missing file. The
hand-copy seam is otherwise unverified.

- `parallax_sha`: `71d3c9dbbd5b37a654305c67857b8f910f08b5b2`
- worktree at emission: **dirty** (the verdict emitter itself was uncommitted
  when these rows were produced; replay from the commit that includes
  `gate/verdict.py` reproduces the same gate numbers — the emitter only
  serializes them)
- copied: 2026-08-31

## sha256

Hashes are over **LF-normalized bytes** (CRLF → LF before hashing) — the
ledger's parsers are newline-insensitive and git re-encodes line endings per
platform, so raw-byte pins false-positive on checkout (caught in CI
2026-08-31; `.gitattributes` additionally forces LF in every working tree).

744b2c47387e7d6eac3ba99bf80251a45fa51af9f1a21464cafe16566b54ca2f  verdicts/vantage-gold-local-parquet-lane1-live-20260831T184617.488009Z.json
9905bcb62515e666d913dd601b08c3b9cf520245d7d5868363d2245e12f3c8ef  verdicts/vantage-gold-local-parquet-lane1-twin-20260831T184617.935133Z.json
ce10bac1d0793625d1c0948a867c10b189c4cfa556ed6ee0fc08ebc1b85815fb  audits/commercial-fundamentals-api-2026-08-20.json
f02d465124885cffa5e40b5e1a69c8a72aedc4e4e31848ab3e2e99c184cc60ff  snapshots/audit-2026-08-20.json

## Replay

```
# in the PARALLAX repo, at parallax_sha (or later):
.venv/Scripts/python.exe scripts/run_gate_local.py \
  --gold <path-to>/lake-backfill/gold --cik-mod 97 \
  --stage-twin <scratch> --emit-verdicts <out>
```
