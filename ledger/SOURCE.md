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
e3e3a3b22955c157dd3cb0efcb81dbb608505c68b48d61ea5523b5671d75cb38  supersession.json

## Replay

```
# in the PARALLAX repo, at parallax_sha (or later):
.venv/Scripts/python.exe scripts/run_gate_local.py \
  --gold <path-to>/lake-backfill/gold --cik-mod 97 \
  --stage-twin <scratch> --emit-verdicts <out>
```

Replay requires access to the VANTAGE gold surface, which is not public.
`content_hash` identifies the values of the gold columns, in the row order and
under the serialization the row's basis names; it is not a hash of a file.
Under the basis rows carry from the 2026-09-15 emitter change on, two frames
with the same values in a different row order, or with extra columns, hash
the same; under the basis the two rows below carry, they do not (see the
correction).

*Correction, 2026-09-15.* This paragraph read, until today: "Replay requires
access to the VANTAGE gold surface, which is not public; a reader without it
can still use `content_hash` to confirm that any frame they do hold is
byte-identical to the one the gate read." Under the basis these two rows carry,
a copy of the live frame written to parquet and read back hashes
`sha256:b27eaac16b3e75d09d1f92a3d8482f3fb0e56724bce31257f8473aab44b33501` and
not the row's
`sha256:3fcfb3c3c28a0c28f3dc3e454b89767461f34fa6431238f58633c4bad8a31b65`,
because that serialization depended on how the frame was built in memory and
not only on its values. For the same reason the row-order and extra-column
equivalence stated above is a property of the new basis and not of these two
rows: under the old basis the same values re-ordered with an extra column
hashed `sha256:731b1fc7de0b...` rather than reproducing the live hash. Rows
emitted after the 2026-09-15 emitter change carry the new basis, under which
the read-back of a staged copy reproduces the hash and the emitter writes no
row when it does not.

*Twin row disclosure, 2026-09-15.* The twin row's basis reads "of the gated
frame". The frame that gate read is the staged twin parquet, which read back
hashes
`sha256:bbe60bf9daf145f7505565b434a1dbd9098c108862610f5aa2e5033ba0ebea8c`,
while the row records
`sha256:01be4edf771b9a2fc84f86c93b6c79a858f1c3f6621ce5073609a062be43ff47`, the
hash of the same values before they were written. The row is frozen as
published: the discrepancy is recorded here rather than edited into the row.

**Cross-run corroboration.** Four independent gate runs on 2026-08-31 and
2026-09-01 — different working-tree states, different scratch directories,
different process invocations — all produced the identical live-cell
`content_hash`
`sha256:3fcfb3c3c28a0c28f3dc3e454b89767461f34fa6431238f58633c4bad8a31b65`.
That is the strongest evidence on this page: the hash is stable across runs
that repeat the same read, so it is not an artifact of one execution. It says
nothing about whether the *surface* is correct — only that every run read the
same surface.

*Scope, 2026-09-15.* Those four runs corroborate stability across runs that
build the frame the same way, from the Delta table; they say nothing about a
frame built another way. Until 2026-09-15 the paragraph above also said "a
`content_hash` match is a real identity check on the bytes the gate read";
that clause is removed: the bytes hashed are a serialization of the frame as
it sat in memory, and a staged parquet copy of
the same values, read back, hashes
`sha256:b27eaac16b3e75d09d1f92a3d8482f3fb0e56724bce31257f8473aab44b33501` under
the same basis. What the four runs corroborate is that a run repeating the same
read reproduces the same hash. Rows emitted under the new basis carry a
different hash, and their corroboration starts with their first run.
