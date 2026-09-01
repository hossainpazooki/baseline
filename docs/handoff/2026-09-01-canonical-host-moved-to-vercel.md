# Handoff — canonical host moved to Vercel, gate now runs at the hosting edge

2026-09-01. Supersedes the hosting sections of
[2026-09-01-baseline-ledger-v1-published](2026-09-01-baseline-ledger-v1-published.md),
which is left as written: it was accurate when committed and records how the
Pages phase ended. Newest commit this brief describes: **`8746530`** (baseline
`main`, CI green run 33559102867). PARALLAX unchanged at **`25e12b8`**.

## What changed

**BUILT — Vercel is canonical.** <https://baseline-beryl.vercel.app/>, project
`baseline` (`prj_mB2XNbHwqrXFMdM38Y0fDMsxtucD`), git-linked to `main`, deploying
on push. Two other aliases also resolve
(`baseline-hossainpazookis-projects.vercel.app` and the `-git-main-` one).
re-verify: `curl -sS -o /dev/null -w '%{http_code}\n' https://baseline-beryl.vercel.app/ && curl -sS -o /dev/null -w '%{http_code}\n' https://baseline-beryl.vercel.app/no-such-page-zzz.html`
(expect `200` then `404`; a `200` on the second line means the probe proves nothing)

**BUILT — the gate runs at the hosting edge.** `vercel.json`'s build command is
`test-ledger && check-ledger && build --check`. It *verifies* rather than
regenerates, which is what keeps "what is live is what is in git" true. Build
log for the first deploy shows all 21 controls plus both gates, from commit
`8746530`, in 436 ms. A ledger that contradicts the page cannot reach the URL.
re-verify: `cd ~/dev/baseline && sh -c "node scripts/test-ledger.mjs && node scripts/check-ledger.mjs && node scripts/build.mjs --check"; echo "exit=$?"`

**BUILT — page is host-agnostic.** `index.html` embeds no hostname, so moving
hosts required no page change and the live bytes are identical to the committed
file.
re-verify: `cd ~/dev/baseline && awk '/github.io|vercel.app/{n++} END{print n+0}' index.html` (expect `0`; counted with awk because `grep -c` exits 1 on a zero count and would read as a failure when the answer is right)

**RETIRED — GitHub Pages.** Deconfigured via the API on 2026-09-01; the Pages
config endpoint now 404s. GitHub's CDN kept answering `200` at the moment of
retirement and ages out on its own, so a `200` there shortly after is cache,
not a live site.
re-verify: `gh api repos/hossainpazooki/baseline/pages` (expect `404 Not Found`)

## Confirmed, not merely predicted

The supersession gap recorded in
`docs/learnings/2026-08-31-ledger-has-no-supersession.md` said the cited row URL
`.../lane1-live-20260831T184617.488009Z.json` "resolves on the live site today
and will 404 on the next push." It was probed at `200` before the push and
`404` after. The prediction held; the gap is real and still unfixed. A
`superseded_by` pointer remains the leading correctness item.

## Open / next, in rough value order

- **A `superseded_by` pointer**, with the checker allowing at most one
  non-superseded cell per surface/lane. Now demonstrated rather than argued.
- **A custom domain.** `baseline-beryl.vercel.app` carries a Vercel-assigned
  random word. `pazooki.com` is available to point at this if a stable,
  citable hostname matters — and for an artifact whose pitch is citable dated
  rows, it probably does.
- **A `MEASUREMENT` row kind** so the study-001 numbers (17,787 filer-quarters,
  1.51% sign flips) stop wearing the "reported, not on the ledger" badge. Still
  the strongest claim on the page and still not a row.
- **Lane 2**, blocked producer-side in VANTAGE: gold is a path-addressed Delta
  table on a UC volume, so there is no catalog-managed object to read through.
- **The sweep is not in CI**, by design — `.denylist` is gitignored, so it
  would be permanently UNEVALUABLE there. It is a local pre-commit gate only,
  which means it depends on a human running it. Worth revisiting if that
  proves unreliable.
