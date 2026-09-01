# Raw-byte hash pins pass on Windows and fail in CI, every time

ts: 2026-08-31T19:07:12Z
commit: 912f35a
session: https://claude.ai/code/session_01LCYDzazeLMEbppi5r2MX1Q
status: verified

fact: A content-hash gate that hashes raw file bytes is stricter than its own
parser and produces CI-only false positives. With `core.autocrlf=true` the
Windows working tree holds CRLF, git normalizes committed blobs to LF, and
Ubuntu CI hashes the LF bytes — so every pin recorded locally mismatches
remotely while all four gates pass locally. The ledger's parsers are
newline-insensitive, so the bytes the pipeline actually consumes are the
LF-normalized ones; hashing those (`sha256()` in `scripts/lib/ledger.mjs`)
removes the false positive without weakening the gate, and
`.gitattributes` (`* text=auto eol=lf`) keeps every checkout converged. The
emitting side matters too: Python's `write_text` emits CRLF on Windows unless
given `newline="\n"`.

basis: CI run 33428782242 (`ledger-gate`, push of 912f35a) failed with all four
bindings mismatching at once:
```
FAIL audits/commercial-fundamentals-api-2026-08-20.json: snapshot_hash does not match snapshots/audit-2026-08-20.json
FAIL verdicts/...-live-20260831T184617.488009Z.json: sha256 does not match SOURCE.md binding
FAIL verdicts/...-twin-20260831T184617.935133Z.json: sha256 does not match SOURCE.md binding
FAIL snapshots/audit-2026-08-20.json: sha256 does not match SOURCE.md binding
```
Diagnosis confirmed by comparing the committed blob against the working-tree
file: `git show HEAD:<row> | sha256sum` gave `744b2c47…` while
`sha256sum <row>` gave `1c6df1e0…`; after LF normalization the working-tree
hash equals the blob hash. Fix landed in run 33432063605 (success, 21s).

re-verify: cd ~/dev/baseline && gh run view 33428782242 --log-failed | head -6
