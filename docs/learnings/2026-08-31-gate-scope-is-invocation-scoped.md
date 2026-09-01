# A gate's scope string describes its invocation, not the surface it is published against

ts: 2026-08-31T20:06:05Z
commit: b4656610bc9b06ac97dc810658ff408ce2f2e505
session: https://claude.ai/code/session_01LCYDzazeLMEbppi5r2MX1Q
status: refuted-assumption

fact: Emitting a gate's own report verbatim into a published row is NOT
automatically honest. PARALLAX stages a `cik % 97` twin into its own directory
and then gates that directory with no `cik_mod`, so `gate/checks.py` correctly
reports `scope: "full surface"` — the staged directory *is* its whole
population. Published as a row about `surface: vantage-gold-local-parquet`,
that same true string becomes a full-surface claim, which this project's own
spec (`docs/specs/2026-08-29-baseline-ledger-design.md` §8) lists as not built.
The live cell in the same ledger simultaneously said `"cik % 97 == 0 sample"`
for the same 440,661 rows on the same surface. The refuted assumption was that
"never hand-edit gate output" is sufficient for honest rows; it is necessary
but not sufficient — a field can be true of the run and false as a claim, and
the fix belongs at the emission boundary (`verdict_row()`), never in
`gate/checks.py`, which was correct as written.

basis: `git show b465661:ledger/verdicts/vantage-gold-local-parquet-lane1-twin-20260831T184617.935133Z.json`
piped through a JSON reader printed:
`{"cell":"twin","scope":"full surface","rows":440661,"surface":"vantage-gold-local-parquet"}`
The defect is in committed history at this anchor, not only in a working tree.
Found by the whole-branch review, then independently confirmed by the
controller against both the committed blob and the working-tree rows.

re-verify: cd ~/dev/baseline && git show b4656610bc9b06ac97dc810658ff408ce2f2e505:ledger/verdicts/vantage-gold-local-parquet-lane1-twin-20260831T184617.935133Z.json | grep '"scope"'
