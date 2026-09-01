#!/usr/bin/env node
// Page generator — reads ledger rows, derives status, emits ./index.html.
// Every number in a row-backed sentence is interpolated from the row, never
// typed. Prose that is NOT row-backed carries a visible "reported, not on the
// ledger" badge. Usage: node scripts/build.mjs [--check]

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { loadLedger, groupCells, deriveStatus } from "./lib/ledger.mjs";
import { checkLedger } from "./check-ledger.mjs";

const ROOT = process.cwd();
const LEDGER = join(ROOT, "ledger");
const OUT = join(ROOT, "index.html");

const LANES = { 1: "local Parquet", 2: "Unity Catalog", 3: "Snowflake over Iceberg" };

// The two upstream repos this ledger reports on. Public; a reviewer can open
// them. Roles here are structural facts about which repo plays which part --
// the surface identifier and gate commit that back them are interpolated from
// the rows below, never typed.
const REPOS = {
  vantage: {
    name: "VANTAGE",
    repo: "hossainpazooki/pit-fundamentals-lakehouse",
    role: "builds the point-in-time surface under test",
  },
  parallax: {
    name: "PARALLAX",
    repo: "hossainpazooki/pit-revision-examiner",
    role: "runs the gate that produces every verdict row",
  },
};

const esc = (s) => String(s).replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n = (x) => Number(x).toLocaleString("en-US");
const day = (iso) => iso.slice(0, 10);

// --- gate the ledger first; a page must never outrun its rows -------------
const gateErrors = checkLedger(LEDGER);
if (gateErrors.length) {
  for (const e of gateErrors) console.error(`FAIL ${e}`);
  process.exit(1);
}
const { verdicts, audits } = loadLedger(LEDGER);
const groups = groupCells(verdicts);

// The MVP renders one gate surface; refuse silently widened scope.
if (groups.size !== 1 || audits.length !== 1) {
  console.error(`FAIL v1 renders exactly 1 gate surface and 1 audit ` +
    `(got ${groups.size} and ${audits.length}); widen build.mjs deliberately`);
  process.exit(1);
}
const [surfaceKey, cells] = [...groups.entries()][0];
const surface = surfaceKey.split(":")[0];
const { live, twin } = cells;
const audit = audits[0].row;

const statusByLane = Object.fromEntries(
  Object.keys(LANES).map((lane) =>
    [lane, deriveStatus(groups.get(`${surface}:lane${lane}`) ?? {})]),
);

// --- sentence forms (design §4, generated) --------------------------------
const liveSentence = live
  ? `On ${day(live.ran_at)}, the gate read ${n(live.rows)} as-of rows of ` +
    `<code>${esc(surface)}</code> and found ${live.result}.` +
    (twin ? ` The same check, run on a copy with one planted error, went ${twin.result}.` : "")
  : "";
const auditSentence =
  `As of ${day(audit.fetched_at)}, this vendor&#39;s fundamentals endpoints offered no way ` +
  `to ask what was known on a given day. Field that dates a period: ` +
  `<code>${esc(audit.field_quoted)}</code>. Source: machine audit over ` +
  `${n(audit.docs_searched)} documentation pages (artifact <code>${esc(audit.audit_artifact)}</code>).`;

const verdictRowsHtml = verdicts.map(({ row, rel }) => `
      <tr>
        <td><span class="pill ${row.result.toLowerCase()}">${row.result}</span></td>
        <td><code>${esc(row.surface)}</code></td>
        <td>${row.lane} · ${esc(LANES[row.lane])}</td>
        <td>${esc(row.cell)}</td>
        <td class="num">${n(row.rows)}</td>
        <td>${Object.entries(row.checks).map(([k, v]) =>
          `<code>${esc(k)}</code>:${v}`).join(" ")}</td>
        <td>${esc(day(row.ran_at))}</td>
        <td class="mono">${esc(row.parallax_sha.slice(0, 12))}${
          row.parallax_worktree === "dirty" ? " <span class='warn'>(dirty)</span>" : ""}</td>
        <td class="mono" title="${esc(row.content_hash_basis)}">${esc(row.content_hash.slice(7, 19))}…</td>
        <td><a href="ledger/${esc(rel)}">row</a> <span class="unsigned">hash-anchored, unsigned</span></td>
      </tr>`).join("");

const auditRowHtml = audits.map(({ row, rel }) => `
      <tr>
        <td>${row.results.map((r) => `<span class="pill audit">${esc(r)}</span>`).join(" ")}</td>
        <td><code>${esc(row.surface)}</code> <span class="muted">(vendor de-named: ${esc(row.vendor_alias)})</span></td>
        <td class="num">${n(row.docs_searched)} pages</td>
        <td><code>${esc(row.field_quoted)}</code></td>
        <td>${esc(day(row.fetched_at))}</td>
        <td class="mono" title="sha256 of the committed audit artifact">${esc(row.snapshot_hash.slice(7, 19))}…</td>
        <td><a href="ledger/${esc(rel)}">row</a> <span class="unsigned">hash-anchored, unsigned</span></td>
      </tr>`).join("");

const statusBoard = Object.entries(statusByLane).map(([lane, st]) => `
      <tr>
        <td>${lane} · ${esc(LANES[lane])}</td>
        <td><span class="pill ${st.toLowerCase()}">${st}</span></td>
        <td class="muted">${{
          CLAIMABLE: "live cell GREEN and twin cell RED, red matching the planted error exactly",
          PARTIAL: "one of the two cells present — not green",
          UNCLAIMED: "no gate runs on this lane yet",
          UNEVALUABLE: "a cell refused: its evaluation domain could not be read",
        }[st]}</td>
      </tr>`).join("");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BASELINE — a conformance ledger</title>
<style>
  :root {
    --bg: #faf9f6; --ink: #1e222a; --muted: #6a7180; --line: #e2ddd3;
    --green: #1a7a4a; --green-bg: #e7f3ec; --red: #b3382e; --red-bg: #f9e9e7;
    --blue: #2b5f9e; --blue-bg: #e8eff8; --grey: #6a7180; --grey-bg: #eeece7;
    --amber: #8a6d1a; --card: #ffffff;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14161b; --ink: #e4e2dc; --muted: #98a0ad; --line: #2b2f38;
      --green: #4fbf85; --green-bg: #17301f; --red: #e0776d; --red-bg: #35201d;
      --blue: #7aabe0; --blue-bg: #1b2735; --grey: #98a0ad; --grey-bg: #23262d;
      --amber: #d3b158; --card: #1b1e25;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 16px/1.65 Georgia, "Times New Roman", serif;
  }
  main { max-width: 46rem; margin: 0 auto; padding: 3rem 1.25rem 5rem; }
  h1 { font-size: 2rem; margin: 0 0 .25rem; letter-spacing: .01em; }
  h2 { font-size: 1.25rem; margin: 2.75rem 0 .75rem; }
  .tagline { color: var(--muted); margin: 0 0 2rem; }
  p { margin: .75rem 0; }
  code, .mono { font: .85em/1.5 ui-monospace, Consolas, monospace; }
  .pill {
    display: inline-block; padding: .05rem .55rem; border-radius: 99px;
    font: 700 .72rem/1.6 ui-monospace, Consolas, monospace; letter-spacing: .04em;
  }
  .pill.green { color: var(--green); background: var(--green-bg); }
  .pill.red { color: var(--red); background: var(--red-bg); }
  .pill.claimable { color: var(--green); background: var(--green-bg); }
  .pill.audit { color: var(--blue); background: var(--blue-bg); }
  .pill.partial, .pill.unclaimed, .pill.unevaluable { color: var(--grey); background: var(--grey-bg); }
  .badge {
    display: inline-block; padding: .05rem .5rem; border: 1px solid var(--amber);
    color: var(--amber); border-radius: 4px; font: .7rem/1.6 ui-monospace, Consolas, monospace;
  }
  .unsigned { font: .68rem/1.4 ui-monospace, Consolas, monospace; color: var(--muted); }
  .warn { color: var(--amber); }
  .muted { color: var(--muted); }
  .tablewrap { overflow-x: auto; margin: 1rem 0; border: 1px solid var(--line); border-radius: 8px; background: var(--card); }
  table { border-collapse: collapse; width: 100%; font-size: .82rem; font-family: system-ui, sans-serif; }
  th, td { text-align: left; padding: .5rem .65rem; border-top: 1px solid var(--line); vertical-align: top; white-space: nowrap; }
  thead th { border-top: 0; font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .sentence { border-left: 3px solid var(--line); padding: .25rem 0 .25rem 1rem; margin: 1rem 0; }
  .sentence.gate { border-color: var(--green); }
  .sentence.vendor { border-color: var(--blue); }
  a { color: var(--blue); }
  footer { margin-top: 3.5rem; padding-top: 1rem; border-top: 1px solid var(--line); font-size: .82rem; color: var(--muted); }
</style>
</head>
<body>
<main>
  <h1>BASELINE</h1>
  <p class="tagline">A conformance ledger: dated rows stating what a point-in-time
  gate has shown about named read surfaces. It reports on surfaces; it serves no
  data. Nothing on this page claims more than the rows below.</p>

  <h2>The three pieces</h2>
  <p>Three repositories, one claim path. A reviewer can follow it end to end:
  the surface is built in one repo, interrogated by a gate in another, and only
  what the gate actually returned is published here.</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Piece</th><th>Role</th><th>Bound to these rows by</th></tr></thead>
    <tbody>
      <tr>
        <td><a href="https://github.com/${esc(REPOS.vantage.repo)}">${esc(REPOS.vantage.name)}</a></td>
        <td>${esc(REPOS.vantage.role)}</td>
        <td><code>surface</code> = <code>${esc(surface)}</code></td>
      </tr>
      <tr>
        <td><a href="https://github.com/${esc(REPOS.parallax.repo)}">${esc(REPOS.parallax.name)}</a></td>
        <td>${esc(REPOS.parallax.role)}</td>
        <td><code>parallax_sha</code> = <code class="mono">${esc(live ? live.parallax_sha.slice(0, 12) : "n/a")}</code></td>
      </tr>
      <tr>
        <td>BASELINE</td>
        <td>publishes the rows and refuses to outrun them</td>
        <td>this page, generated from <a href="ledger/SOURCE.md">ledger/</a></td>
      </tr>
    </tbody>
  </table></div>
  <p class="muted">Neither upstream repo is a dependency of this page: the rows
  are hand-copied across a hash-bound seam described in
  <a href="ledger/SOURCE.md">SOURCE.md</a>. Replaying a row needs the VANTAGE
  gold surface, which is not published; the <code>content_hash</code> on each
  row is what a reader without it can still check.</p>

  <h2>A value is not a fact until you store the viewpoint</h2>
  <p>In 1838 Friedrich Bessel published the first stellar parallax: 0.3136
  arcseconds for the star 61&nbsp;Cygni. The accepted value today is 0.286. The
  revision embarrassed nobody, because astronomy records <em>who measured what,
  when, from where</em> — the viewpoint is stored beside the value, so a better
  viewpoint replaces it without rewriting history. Financial fundamentals data
  routinely fails this standard: a restated revenue figure silently overwrites
  the number you actually knew at the time, and any backtest built on the feed
  quietly reads the future.</p>

  <h2>What the gate shows <span class="pill green">row-backed</span></h2>
  <p>The PARALLAX gate reads a fundamentals surface the way a consumer would,
  then re-derives what <em>should</em> be visible at a chosen instant from the
  acceptance evidence, and counts disagreements. A green gate is only credited
  when the same gate, pointed at a copy of the surface with one deliberately
  planted error, goes red — catching exactly the plant and nothing else.</p>
  <div class="sentence gate">${liveSentence}</div>

  <h2>What a feed without a viewpoint costs <span class="badge">reported, not on the ledger</span></h2>
  <p>Measured on a sample of 17,787 filer-quarters from the same surface:
  when revisions land, they are rare but violent — in 1.51% of cases the
  reported growth story <em>flips sign</em>. A quarter your feed shows as growth
  was, on the day you would have traded it, a decline. This measurement is
  reported from PARALLAX study&nbsp;001 and does not yet have a ledger row of
  its own; until it does, it carries this badge.</p>

  <h2>The vendor finding <span class="pill audit">SURFACE_AUDIT</span></h2>
  <p>A commercial market-data vendor timestamps trades to the nanosecond. Its
  fundamentals and filings endpoints — audited across its full stocks
  documentation corpus, with live-fire, positive, and negative controls on the
  audit method itself — expose no acceptance instant and no way to ask an
  as-of question at all.</p>
  <div class="sentence vendor">${auditSentence}</div>

  <h2>The three failures</h2>
  <p>Every fundamentals read surface handles the viewpoint problem in one of
  four ways. <strong>Zero baseline:</strong> restatements overwrite in place —
  the audited vendor&#39;s fundamentals feed above. <strong>Unknown
  baseline:</strong> history exists somewhere, but no as-of query can reach it,
  so you cannot prove what you knew. <strong>Flexing baseline:</strong> an
  as-of mode exists but its boundary moves — the gate&#39;s planted-error twin
  exists precisely to catch this class. <strong>Stored viewpoint:</strong>
  Bessel&#39;s standard, and the property the green row above certifies for one
  surface, one lane, one dated run.</p>

  <h2>Status by lane</h2>
  <p>Surface under test: <code>${esc(surface)}</code>. A lane is CLAIMABLE only
  when both cells exist: the live surface green <em>and</em> the planted-error
  twin red for exactly the planted reason. Status is recomputed from the rows
  at every build; it is never written down.</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Lane</th><th>Status</th><th>Meaning</th></tr></thead>
    <tbody>${statusBoard}
    </tbody>
  </table></div>

  <h2>The ledger</h2>
  <p>Gate verdicts — each resolves to a replayable run (commit, content hash):</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Result</th><th>Surface</th><th>Lane</th><th>Cell</th>
      <th>As-of rows</th><th>Violations by check</th><th>Ran</th>
      <th>Gate commit</th><th>Content hash</th><th>Provenance</th></tr></thead>
    <tbody>${verdictRowsHtml}
    </tbody>
  </table></div>
  <p>Surface audits — established by reading vendor documentation, visibly not
  gate runs, colored accordingly:</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Finding</th><th>Surface</th><th>Corpus</th><th>Dating field</th>
      <th>Fetched</th><th>Snapshot hash</th><th>Provenance</th></tr></thead>
    <tbody>${auditRowHtml}
    </tbody>
  </table></div>

  <footer>
    <p>Every row is hash-anchored and <em>unsigned</em> (row signing is a
    planned extension, not built). File-level bindings and the replay command
    live in <a href="ledger/SOURCE.md">ledger/SOURCE.md</a>. The ledger is
    validated by <code>check-ledger.mjs</code> — negative controls included —
    before this page is allowed to build.</p>
  </footer>
</main>
</body>
</html>
`;

if (process.argv.includes("--check")) {
  const committed = existsSync(OUT) ? readFileSync(OUT, "utf8") : null;
  if (committed !== html) {
    console.error("FAIL index.html is stale — rerun: node scripts/build.mjs");
    process.exit(1);
  }
  console.log("build --check: committed page matches the ledger");
} else {
  
  writeFileSync(OUT, html);
  console.log(`built ${OUT}`);
}
