# check-ledger refuses every foreign row on two BASELINE-specific rules; under DATUM they are invariants, not gaps

ts: 2026-09-06T16:59:42Z
commit: 775978f
session: https://claude.ai/code/session_01KD8VJDoLENhTTtiXvPE72K
status: verified

fact: `scripts/lib/ledger.mjs` carries two rules that no row from another gate can satisfy: `rows` must equal `evaluated.no_future_accepted` (a PARALLAX check name bound into the generic validator, line 114), and `groupCells` throws on a second `twin` for one surface and lane (line 177). Fed MERIDIAN's 18 rows at its `a087ab2`, renamed to the `<surface>-lane<lane>-<cell>-<stamp>.json` rule and hash-bound in a scratch `SOURCE.md`, `check-ledger.mjs` refused all 18 on the first rule and P4/P6/P7 on the second; every other rule (16/17-key schema, enums, union-of-keys plant match, evaluated-zero, LF-normalized binding) accepted them. `build.mjs` additionally exits 1 on any ledger with more than one gate surface or other than one audit (lines 51-56). The same day the operator ruled that BASELINE is not a catalog (DATUM v2, `~/dev/datum` `91be859`, "Scope: a discipline, not a catalog"), so these three refusals are BASELINE's own rules under a shared row schema and are not to be widened; the shared schema makes `rows` optional and leaves its binding to the repo.

basis: `node probe.mjs <scratch>` -> `===== all18: exit 1`, 18 lines `FAIL verdicts/meridian-lane1-p*-lane1-*.json: rows must equal evaluated.no_future_accepted`, then `FAIL verdicts/meridian-lane1-p4-lane1-twin-20260906T165328.354549Z.json: second twin cell for meridian-lane1-p4:lane1 (have verdicts/meridian-lane1-p4-lane1-twin-20260906T165328.321172Z.json)`; `===== p1only: exit 1` with only the two `rows must equal` lines. `sed -n '48,60p' scripts/build.mjs` -> `if (groups.size !== 1 || audits.length !== 1) { console.error(\`FAIL v1 renders exactly 1 gate surface and 1 audit ...\`); process.exit(1); }`. Probe artifacts live in the session scratchpad, not the repo.

re-verify: grep -n 'evaluated.no_future_accepted\|second ${row.cell} cell\|exactly 1 gate surface' scripts/lib/ledger.mjs scripts/build.mjs
