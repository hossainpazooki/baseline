# A hand-run grep gate fired on its own documentation, which is how gates get silenced

ts: 2026-09-01T17:52:00Z
commit: (uncommitted at time of writing; baseline HEAD b4656610bc9b06ac97dc810658ff408ce2f2e505)
session: https://claude.ai/code/session_01RkPY5mx5kwoowRP2ZcaDht
status: verified

fact: The de-naming invariant was a hand-run `grep -rniE "<term>|<term>"` with
the denied terms written literally into the invariant's own text. The moment
that invariant was written down in `docs/handoff/` and `docs/learnings/`, the
sweep started failing on those two files -- the only "hits" in the tree were
the gate's own documentation quoting its own pattern. A gate whose pattern is
committed alongside the thing it forbids is guaranteed to fire on itself, and
a gate that is always red is a gate a human learns to skip. Note the second
defect this exposes: writing the terms into a committed doc was *itself* the
naming act the policy exists to prevent, so the "gate" was leaking the very
string it was built to keep out. Fix was to externalize the terms to a
gitignored `.denylist` and ship `scripts/denaming-sweep.sh`, which excludes
that file and treats a missing or empty list as UNEVALUABLE (exit 2), never as
clean -- otherwise deleting the list would silently turn every future run
green. This is the same shape as [[hash-what-the-pipeline-consumes]]: a gate
stricter than its own subject emits only false positives.

basis: Running the pre-fix invariant over the tree returned exactly two hits,
both self-referential:
```
docs/handoff/2026-09-01-baseline-ledger-v1-published.md:121:  `grep -rniE "..."` must return nothing.
docs/learnings/2026-08-31-denaming-is-name-level-only.md:8:fact: The vendor-name sweep (`grep -rniE "..."`) returning zero
```
After the fix, three controls were run against the new script and each failed
for its own distinct reason: missing list -> `UNEVALUABLE` exit 2; list with
only comments -> `UNEVALUABLE` exit 2; a planted term in a scratch file ->
`FAIL` exit 1 naming that file. Clean tree -> exit 0, `clean (2 terms, 0 hits)`.

re-verify: cd ~/dev/baseline && sh scripts/denaming-sweep.sh; echo "clean=$?"; mv .denylist .denylist.bak && sh scripts/denaming-sweep.sh; echo "unevaluable=$? (expect 2)"; mv .denylist.bak .denylist
