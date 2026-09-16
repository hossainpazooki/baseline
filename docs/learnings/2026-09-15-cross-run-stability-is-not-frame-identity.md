# Cross-run stability of the frame hash is not frame identity

ts: 2026-09-15T23:27:06Z
commit: 0b2e1840ae2d44c758ce6a13fa73011778681281
session: https://claude.ai/code/session_0148JJXwx8tEGbUMLYZ9SsTn
status: verified
narrows: 2026-08-31-canonical-frame-hash-is-cross-run-stable.md

fact: `canonical_frame_hash()` reproduces across runs that build the frame the
same way, and that entry stands. It does not follow that the hash identifies
the frame. Under the basis the two published lane-1 rows carry, the same values
serialize to different bytes depending on how the frame was assembled in
memory: a copy of the live frame written to parquet and read back the way the
gate reads it hashes
`sha256:b27eaac16b3e75d09d1f92a3d8482f3fb0e56724bce31257f8473aab44b33501`,
where the row records
`sha256:3fcfb3c3c28a0c28f3dc3e454b89767461f34fa6431238f58633c4bad8a31b65`, and
the twin behaves the same way (`bbe60bf9daf1...` read back against the row's
`01be4edf771b...`). So the sentence the 2026-08-31 entry drew from stability --
"a holder of the VANTAGE gold surface can confirm they have the exact frame the
gate read" -- holds only for a holder who rebuilds the frame by the same path,
from the Delta table, and fails for a holder who has the same values in another
arrangement. That entry's scope caveat, deterministic for a given polars
version, was too narrow: the serialization depends on the in-memory chunk and
buffer layout as well, not only on the library version.

Under a basis that pins one chunk and the oldest Arrow IPC compatibility level,
the frame and its read-back agree (`4179658b0025` both ways for the live
subset, `59fbe78cbe75` both ways for the twin) -- measured here, in the same
runs. That agreement is the reason the emitter is being moved to that form,
with a read-back check that writes no row on a mismatch; that emitter change is
upstream of this repository and this entry does not verify it. What this entry
records is the measurement, not the upstream build.

basis: this session's own runs against the gold surface, not a report of one. A
scratch script printing `canonical_frame_hash()` -- imported from the PARALLAX
gate, nothing patched, while that function still carried the published form --
for the live `cik % 97` subset, its staged parquet read back, the
`plant_future_accepted` twin in memory and the twin read back:

```
polars 1.43.2
live cik%97 from Delta          sha256:3fcfb3c3c28a0c28f3dc3e454b89767461f34fa6431238f58633c4bad8a31b65
live staged parquet read back   sha256:b27eaac16b3e75d09d1f92a3d8482f3fb0e56724bce31257f8473aab44b33501
twin future_accepted in memory  sha256:01be4edf771b9a2fc84f86c93b6c79a858f1c3f6621ce5073609a062be43ff47
twin staged parquet read back   sha256:bbe60bf9daf145f7505565b434a1dbd9098c108862610f5aa2e5033ba0ebea8c
```

and a second script comparing the published form (v1) with the pinned form
(v2 = `.rechunk().write_ipc(buf, compat_level=pl.CompatLevel.oldest())`), which
also records the chunk counts and a second independent Delta read:

```
live, collected from Delta         rows  935935 chunks  200  v1 sha256:3fcfb3c3c28a  v2 sha256:4179658b0025
live, staged parquet read back     rows  935935 chunks   12  v1 sha256:b27eaac16b3e  v2 sha256:4179658b0025
  values equal after canonical sort: True
  v1 mem == readback: False | v2 mem == readback: True
twin future_accepted, in memory    rows  935935 chunks  200  v1 sha256:01be4edf771b  v2 sha256:59fbe78cbe75
twin future_accepted, read back    rows  935935 chunks   12  v1 sha256:bbe60bf9daf1  v2 sha256:59fbe78cbe75
  v1 mem == readback: False | v2 mem == readback: True
live, second Delta read            rows  935935 chunks  200  v1 sha256:3fcfb3c3c28a  v2 sha256:4179658b0025
  v1 stable: True | v2 stable: True
shuffled rows + extra column       rows  935935 chunks   16  v1 sha256:731b1fc7de0b  v2 sha256:4179658b0025
  same v1 as live: False | same v2 as live: True | frame equal to live: False
```

Both published rows reproduced their recorded hashes exactly in those runs, so
the 2026-08-31 stability finding is corroborated again here; only the identity
reading of it is withdrawn.

re-verify: needs the VANTAGE gold surface and the PARALLAX venv, neither public;
from the PARALLAX repo root. The recipe spells the published serialization out
instead of calling the gate's hash function, because that function is exactly
what the emitter change replaces: called today it computes the pinned form and
prints `4179658b0025...` for both lines, which would look like a refutation of
the finding above rather than a re-run of it. Printed below are the live frame
and its staged read-back under the form the two published rows carry:

```
.venv/Scripts/python.exe -c "import hashlib, io, pathlib, polars as pl; from readers.protocol import GOLD_COLUMNS; from readers.local_parquet import LocalParquetReader; S = ['cik','tag','ddate','qtrs','uom','accepted','adsh','version','valid_from','valid_to']; h = lambda f: 'sha256:' + hashlib.sha256((lambda b: (f.select(GOLD_COLUMNS).sort(S).write_ipc(b), b.getvalue())[1])(io.BytesIO())).hexdigest(); df = LocalParquetReader(r'<path-to>/lake-backfill/gold').scan_gold().filter(pl.col('cik') % 97 == 0).collect(); print(h(df)); d = pathlib.Path(r'<scratch>'); d.mkdir(parents=True, exist_ok=True); df.write_parquet(d / 'part-000.parquet'); print(h(LocalParquetReader(d).scan_gold().collect()))"
```

which printed, in this session, after the gate's own function had already moved
to the pinned form:

```
sha256:3fcfb3c3c28a0c28f3dc3e454b89767461f34fa6431238f58633c4bad8a31b65
sha256:b27eaac16b3e75d09d1f92a3d8482f3fb0e56724bce31257f8473aab44b33501
```
