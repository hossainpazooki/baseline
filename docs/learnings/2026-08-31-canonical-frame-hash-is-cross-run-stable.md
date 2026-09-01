# The canonical frame hash reproduces across independent gate runs

ts: 2026-08-31T20:15:06Z
commit: b4656610bc9b06ac97dc810658ff408ce2f2e505
session: https://claude.ai/code/session_01LCYDzazeLMEbppi5r2MX1Q
status: verified

fact: `canonical_frame_hash()` (sha256 over Arrow IPC of the gated frame,
sorted by natural key + restatement order + interval) is stable across
separate processes, hours apart, on the same underlying surface. Three
independent runs of `scripts/run_gate_local.py` on 2026-08-31 (18:46, 19:48,
20:15 UTC) each produced live `content_hash
sha256:3fcfb3c3c28a0c28f3dc3e454b89767461f34fa6431238f58633c4bad8a31b65`.
This is the strongest evidence the ledger holds and it is stronger than any
single run: two runs agreeing on a canonical hash corroborate the row's
440,661 / 280,324 / 440,661 numbers by construction, and it retires the
earlier hedge that a re-run "would" reproduce them. It also means the hash is
usable as a frame identity for replay — a holder of the VANTAGE gold surface
can confirm they have the exact frame the gate read. Caveat on scope: the hash
is deterministic *for a given polars version*, which the row records in
`content_hash_basis`; a polars upgrade is a legitimate reason for it to move.

basis: The controller's own independent run (not a subagent's report) at
2026-08-31T20:15:05Z emitted rows to a scratch directory; a field-by-field
comparison against the ledger rows printed:
```
live: content_hash IDENTICAL | differing fields: none
twin: content_hash IDENTICAL | differing fields: none
```
(fields compared: result, rows, scope, checks, evaluated, content_hash,
params). The 18:46 value was read from the first emitted row earlier the same
session.

re-verify: cd ~/dev/baseline && node -e "const fs=require('node:fs');const f=fs.readdirSync('ledger/verdicts').find(x=>x.includes('-live-'));console.log(JSON.parse(fs.readFileSync('ledger/verdicts/'+f,'utf8')).content_hash)"
