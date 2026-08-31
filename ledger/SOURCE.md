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

1c6df1e0bd238f00c3ad2fdca2ec904e51b4a11ecf9187da6f8b927ba08d9005  verdicts/vantage-gold-local-parquet-lane1-live-20260831T184617.488009Z.json
b31f4c2b8aa329a1e93977cce1668b0143e2750f295c01f87d5570fa4b6a672d  verdicts/vantage-gold-local-parquet-lane1-twin-20260831T184617.935133Z.json
3e29613cc536ebfbeee903b05992b03560526b121a8e55f85dce305c6db7b9cd  audits/commercial-fundamentals-api-2026-08-20.json
c7b9835bb4e979428287da433e51602728db6e9a8933eee6d9fcf569daafe44f  snapshots/audit-2026-08-20.json

## Replay

```
# in the PARALLAX repo, at parallax_sha (or later):
.venv/Scripts/python.exe scripts/run_gate_local.py \
  --gold <path-to>/lake-backfill/gold --cik-mod 97 \
  --stage-twin <scratch> --emit-verdicts <out>
```
