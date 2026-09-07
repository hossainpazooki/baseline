# The site page that figures 00-02 were locked to copy no longer carries those figures

ts: 2026-09-07T03:51:04Z
commit: 775978f
session: https://claude.ai/code/session_01KD8VJDoLENhTTtiXvPE72K
status: verified

fact: The portal brief (`docs/handoff/2026-09-01-reviewer-portal-on-vercel.md`) locks "Figures 00-02 stay verbatim copies of the site's variants" because the visual kinship with the site essay was the point. The site's `/baseline` page was rewritten as a one-screen concept page at site `000150c` (2026-09-01 18:38, twenty minutes after the brief's anchor `45a9a46`) and at that commit carries exactly one `<svg>`, the animated `B = cited` loop, and zero `g-*` glyph classes; the three broken-baseline variants exist now only in this repo's `scripts/build.mjs` `FIGS` and in the site's git history. The lock still holds as written, but its stated reason has no live referent: there is nothing on the site for the figures to stay in sync with. Surfaced for the operator; not acted on.

basis: `git -C ~/dev/site rev-parse --short HEAD` -> `000150c`; `grep -c '<svg' ~/dev/site/baseline/index.html` -> `1`; `grep -c 'class="g-' ~/dev/site/baseline/index.html` -> `0`; `grep -c 'const FIGS' scripts/build.mjs` -> `1`. Site clone was 15 commits behind origin at capture, none of them touching `baseline/` (`git -C ~/dev/site diff --stat main..origin/main -- baseline/` -> empty).

re-verify: grep -c 'class="g-' ~/dev/site/baseline/index.html
