# The ledger cannot supersede a row, so correcting one breaks its published URL

ts: 2026-08-31T20:07:38Z
commit: b4656610bc9b06ac97dc810658ff408ce2f2e505
session: https://claude.ai/code/session_01LCYDzazeLMEbppi5r2MX1Q
status: verified

fact: `groupCells()` in `scripts/lib/ledger.mjs` throws on a second `live` (or
`twin`) cell for the same surface/lane, so a corrected gate run must *replace*
its predecessor — deleting the old file and, once published, its URL. For an
artifact whose pitch is dated, citable, replayable rows, this means the ledger
does not keep its own history the way it asks data vendors to keep theirs: a
row someone has cited 404s the moment a better run replaces it. That is the
zero-baseline failure the page itself argues against, in miniature. It was the
right call for the corrections made on 2026-08-31 (each predecessor was
provably worse and nothing had been cited yet), but a `superseded_by` pointer —
with the checker allowing at most one non-superseded cell per surface/lane —
should land before the row count grows. Concretely:
`.../ledger/verdicts/vantage-gold-local-parquet-lane1-live-20260831T184617.488009Z.json`
resolves on the live site today and will 404 on the next push.

basis: Calling `groupCells` with two live cells for one surface/lane printed:
```
throws: verdicts/b.json: second live cell for s:lane1 (have verdicts/a.json)
```
Raised as a recommendation by the whole-branch review and then reproduced
directly by the controller against the shipped module. Co-landed with the
de-naming finding in the same review delivery, hence the shared timestamp.

re-verify: cd ~/dev/baseline && node -e "import('./scripts/lib/ledger.mjs').then(({groupCells})=>{try{groupCells([{row:{surface:'s',lane:1,cell:'live'},rel:'verdicts/a.json'},{row:{surface:'s',lane:1,cell:'live'},rel:'verdicts/b.json'}]);console.log('NO THROW')}catch(e){console.log('throws: '+e.message)}})"
