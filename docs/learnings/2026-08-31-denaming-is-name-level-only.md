# De-naming the audited vendor is name-level only; the corpus paths fingerprint it

ts: 2026-08-31T20:07:38Z
commit: b4656610bc9b06ac97dc810658ff408ce2f2e505
session: https://claude.ai/code/session_01LCYDzazeLMEbppi5r2MX1Q
status: verified

fact: The vendor-name sweep (`sh scripts/denaming-sweep.sh`) returning zero
hits proves the *name* is absent, not that the vendor is unidentifiable. The
committed audit artifact `ledger/snapshots/audit-2026-08-20.json` lists 48
relative documentation paths of the form
`/docs/rest/stocks/aggregates/custom-bars.md`, and that path structure
identifies the vendor to anyone familiar with their docs. The policy
(`vendor: "APERTURE"`, no name, no domain) is satisfied and the sweep is
genuinely clean — this is an accepted risk, not a gap in enforcement, and it
must not be mistaken for protection. Two things bound it: the repo was already
`PUBLIC` before GitHub Pages was enabled, so Pages created an address rather
than an exposure; and de-naming was a deliberate recorded decision (design
amendment 2), not an oversight. What changed on 2026-08-31 is that the repo
became something a person might actually browse, which is why this is worth
stating rather than assuming.

basis: Reading the committed artifact printed:
```
corpus entries: 48
first path: /docs/rest/stocks/aggregates/custom-bars.md
vendor field: APERTURE
```
The sweep over the whole tree at the same anchor returned zero matches for the
vendor's name and product name. Raised by the whole-branch review; artifact
contents confirmed directly by the controller. Co-landed with the supersession
finding in the same review delivery, hence the shared timestamp.

re-verify: cd ~/dev/baseline && node -e "const a=require('./ledger/snapshots/audit-2026-08-20.json');console.log('corpus:',a.corpus.length,'| first:',a.corpus[0].path,'| vendor:',a.vendor)"
