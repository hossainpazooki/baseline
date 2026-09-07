# "pazooki.com is available" means owned and in use, not purchasable

ts: 2026-09-07T03:51:13Z
commit: 775978f
session: https://claude.ai/code/session_01KD8VJDoLENhTTtiXvPE72K
status: refuted-assumption

fact: The portal brief's custom-domain item says "`pazooki.com` is available", which reads as purchasable. The domain resolves to `199.34.228.100` and carries Google Workspace MX records, so it is registered to the operator and serving mail and a site today. The custom-domain step for the ledger is therefore not a purchase: it is a subdomain (for example `baseline.pazooki.com`) added to the Vercel project plus one DNS record at the operator's registrar, which only the operator can do. Nothing in this repo changes for it; `index.html` embeds no hostname.

basis: `nslookup -type=A pazooki.com` -> `Name: pazooki.com` / `Address: 199.34.228.100`; `nslookup -type=MX pazooki.com` -> five `mail exchanger` lines including `aspmx.l.google.com`, `alt1.aspmx.l.google.com`, `alt2.aspmx.l.google.com`; `grep -n "pazooki.com" docs/handoff/2026-09-01-reviewer-portal-on-vercel.md` -> line 119 "`pazooki.com` is available".

re-verify: nslookup -type=A pazooki.com
