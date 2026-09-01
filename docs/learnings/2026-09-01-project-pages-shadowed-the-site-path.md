# Disabling project Pages un-shadowed the user site's page at the same path; "CDN cache" was the wrong explanation

ts: 2026-09-01T22:22:17Z
commit: 45a9a46 (baseline HEAD at re-capture; first observed ~21:20Z at 188644f)
session: https://claude.ai/code/session_01RkPY5mx5kwoowRP2ZcaDht
status: refuted-assumption

fact: A user-site repo (`hossainpazooki.github.io`) and a project repo
(`baseline`) can both claim the URL path `/baseline/` — and while the project
repo has Pages enabled, its site SHADOWS the user site's page there. Disabling
the project's Pages therefore does not take the URL down: the user site's own
page reappears at the same address. The 200 observed right after "retirement"
was initially explained as GitHub's CDN serving stale cache; that was wrong —
it was a different, live page (47KB essay, its own title and theme system)
from a different repo. The tell that falsifies the cache theory: the served
bytes did not match ANY version the project repo ever published. Corollary
that cost real confusion: enabling Pages on the project repo back in the
publish step had silently shadowed the user's existing essay page, and nothing
warned about it in either direction.

basis: Re-captured at ts above, tree clean at the named commit:
```
gh api repos/hossainpazooki/baseline/pages -> HTTP 404 (config deleted)
curl hossainpazooki.github.io/baseline/  -> 200, 47544 bytes,
  <title>BASELINE - the fixed separation underneath VANTAGE x PARALLAX
curl baseline-beryl.vercel.app/          -> 200, 40050 bytes,
  <title>BASELINE - the conformance ledger
```
Two different live pages at the two URLs, with the project repo's Pages config
gone. Original observation (byte counts 47069 vs 12563, same two titles) was
made ~21:20Z at baseline `188644f`, before the site repo gained its ledger
links; the 47544 re-capture includes those three links, which is consistent.

re-verify: sh -c 'gh api repos/hossainpazooki/baseline/pages >/dev/null 2>&1; echo "pages config gone: exit=$? (expect non-zero)"; curl -sS https://hossainpazooki.github.io/baseline/ | grep -o "<title>[^<]*"; curl -sS https://baseline-beryl.vercel.app/ | grep -o "<title>[^<]*"'
