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
    role: "builds the point-in-time store of SEC fundamentals under test",
  },
  parallax: {
    name: "PARALLAX",
    repo: "hossainpazooki/pit-revision-examiner",
    role: "runs the gate that produced every verdict row below",
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
const SITE = "https://hossainpazooki.github.io";
const vio = (r) => Object.values(r.checks).reduce((a, b) => a + b, 0);

// Check semantics: what each named check asserts, verifiable against the gate
// source at the parallax_sha every row carries. A check the page cannot
// describe renders a dash, never a guess.
const CHECK_DOCS = {
  no_future_accepted:
    "no row visible at the viewpoint d carries acceptance evidence stamped after d — the direct lookahead check",
  as_of_monotonicity:
    "moving the viewpoint forward (d_earlier → d) never loses a key and never regresses accepted knowledge",
  restatement_visibility:
    "restatements of one key stay separately visible: no duplicate collapse, no validity interval contradicting its acceptance evidence",
};

// Compact violations vector in stable check order, e.g. {1, 0, 1}.
const fmtChecks = (o) =>
  "{" + Object.keys(live ? live.checks : o).map((k) => o[k]).join(", ") + "}";

// One value or two: renders a single spanning cell only when the cells agree,
// so a divergence between live and twin can never be hidden by layout.
const pairTd = (a, b, cls = "") => a === b
  ? `<td class="${cls}" colspan="2">${a}</td>`
  : `<td class="${cls}">${a}</td><td class="${cls}">${b}</td>`;

const liveSentence = live
  ? `On ${day(live.ran_at)}, the gate read ${n(live.rows)} as-of rows of ` +
    `<code>${esc(surface)}</code> — scope <code>${esc(live.scope)}</code>, ` +
    `viewpoint d&nbsp;=&nbsp;${day(live.params.d)} — and found ${live.result} ` +
    `on all ${Object.keys(live.checks).length} checks.` +
    (twin ? ` The same run against a copy with one planted error went ${twin.result}.` : "")
  : "";
const auditSentence =
  `As of ${day(audit.fetched_at)}, this vendor&#39;s fundamentals endpoints offered no way ` +
  `to ask what was known on a given day. Field that dates a period: ` +
  `<code>${esc(audit.field_quoted)}</code>. Source: machine audit over ` +
  `${n(audit.docs_searched)} documentation pages (artifact <code>${esc(audit.audit_artifact)}</code>).`;

// --- the claim-path diagram ------------------------------------------------
// Deliberately borrows the parallax construction from the essay: a measurement
// needs two viewpoints across a known baseline, and a lane needs two cells over
// the same surface. Every figure in it is read from the rows, never typed.
const diagram = (live && twin) ? `
  <figure class="optic reveal">
    <svg viewBox="0 0 900 330" role="img" width="100%"
         aria-label="The claim path. A gold baseline carries two observation points over one surface: the live cell reading the real surface, and the twin cell reading a copy with one planted error. Both are read by the same gate. The lane is creditable only if the live cell is green and the twin's red matches the plant exactly.">
      <line class="ln-base" x1="150" y1="250" x2="750" y2="250"/>
      <line class="ln-tick" x1="150" y1="243" x2="150" y2="257"/>
      <line class="ln-tick" x1="750" y1="243" x2="750" y2="257"/>
      <text class="t-tag" x="450" y="274" text-anchor="middle">one surface · ${esc(surface)}</text>

      <line class="ln-sight" x1="150" y1="250" x2="450" y2="120"/>
      <line class="ln-sight" x1="750" y1="250" x2="450" y2="120"/>

      <circle class="nd" cx="150" cy="250" r="7"/>
      <circle class="nd" cx="750" cy="250" r="7"/>
      <text class="t-name" x="150" y="228" text-anchor="middle">live cell</text>
      <text class="t-sub"  x="150" y="300" text-anchor="middle">${esc(live.scope)}</text>
      <text class="t-sub"  x="150" y="316" text-anchor="middle">${n(live.rows)} as-of rows</text>
      <text class="t-name bl" x="750" y="228" text-anchor="middle">twin cell</text>
      <text class="t-sub"  x="750" y="300" text-anchor="middle">a copy, one planted error</text>
      <text class="t-sub"  x="750" y="316" text-anchor="middle">${esc(twin.planted.mutation)}</text>

      <rect class="plate" x="342" y="72" width="216" height="58" rx="8"/>
      <text class="t-name au" x="450" y="96" text-anchor="middle">PARALLAX gate</text>
      <text class="t-sub" x="450" y="116" text-anchor="middle">${Object.keys(live.checks).length} checks · one run</text>
      <text class="t-sub" x="450" y="150" text-anchor="middle">viewpoint d = ${day(live.params.d)}</text>

      <text class="t-mark ok"  x="286" y="176" text-anchor="middle">${esc(live.result)} · ${vio(live)} violations</text>
      <text class="t-mark bad" x="614" y="176" text-anchor="middle">${esc(twin.result)} · ${vio(twin)} violations</text>
    </svg>
    <figcaption>A shift is a measurement only across a known baseline; a green gate
    is a claim only against a twin that went red for the planted reason and nothing
    else. One viewpoint proves nothing in either instrument.</figcaption>
  </figure>` : "";

// --- the checks, the plant, and the run anatomy ---------------------------
const checksTable = (live && twin) ? `
  <div class="panel reveal"><table>
    <caption>the checks · semantics from the gate source at ${esc(live.parallax_sha.slice(0, 12))}</caption>
    <thead><tr><th>Check</th><th>What it asserts</th><th>Evaluated</th>
      <th>Live violations</th><th>Twin violations (expected)</th></tr></thead>
    <tbody>${Object.keys(live.checks).map((k) => `
      <tr>
        <td class="k">${esc(k)}</td>
        <td>${CHECK_DOCS[k] ? esc(CHECK_DOCS[k]) : '<span class="muted">&mdash;</span>'}</td>
        <td class="num">${n(live.evaluated[k])}</td>
        <td class="k"><span class="${live.checks[k] === 0 ? "okv" : "badv"}">${live.checks[k]}</span></td>
        <td class="k"><span class="${twin.checks[k] === twin.planted.expected_violations[k] ? "okv" : "badv"}">${twin.checks[k]} = ${twin.planted.expected_violations[k]} expected</span></td>
      </tr>`).join("")}
    </tbody>
  </table></div>` : "";

const plantMatch = twin
  && JSON.stringify(twin.checks) === JSON.stringify(twin.planted.expected_violations);
const plantSentence = twin ? `The plant: <code>${esc(twin.planted.mutation)}</code> mutated ` +
  `${n(twin.planted.mutated_rows)} row out of ${n(twin.rows)}. Expected violations ` +
  `<code>${fmtChecks(twin.planted.expected_violations)}</code>; the gate returned ` +
  `<code>${fmtChecks(twin.checks)}</code> — ` +
  (plantMatch
    ? `an exact match, which is the only thing that credits the green above. A red for any other reason credits nothing.`
    : `<span class="badv">NOT an exact match — this page should not have built.</span>`) : "";

const anatomy = (live && twin) ? `
  <div class="panel reveal"><table>
    <caption>the run, field by field · every value read from the two rows</caption>
    <thead><tr><th>Field</th><th>live cell</th><th>twin cell</th></tr></thead>
    <tbody>
      <tr><td class="k">scope</td>${pairTd(esc(live.scope), esc(twin.scope))}</tr>
      <tr><td class="k">viewpoint d</td>${pairTd(esc(live.params.d), esc(twin.params.d), "k")}</tr>
      <tr><td class="k">earlier viewpoint d_earlier</td>${pairTd(esc(live.params.d_earlier), esc(twin.params.d_earlier), "k")}</tr>
      <tr><td class="k">ran_at</td>${pairTd(esc(live.ran_at), esc(twin.ran_at), "k")}</tr>
      <tr><td class="k">gate commit</td>${pairTd(
        esc(live.parallax_sha) + " · worktree " + esc(live.parallax_worktree),
        esc(twin.parallax_sha) + " · worktree " + esc(twin.parallax_worktree), "k")}</tr>
      <tr><td class="k">runner</td>${pairTd(esc(live.runner), esc(twin.runner), "k")}</tr>
      <tr><td class="k">content_hash</td>${pairTd(esc(live.content_hash), esc(twin.content_hash), "k hash")}</tr>
      <tr><td class="k">hash basis</td>${pairTd(esc(live.content_hash_basis), esc(twin.content_hash_basis))}</tr>
    </tbody>
  </table></div>` : "";

// --- the four baselines, drawn ---------------------------------------------
// Figures 00-02 are the essay's broken-baseline variants, verbatim; figure 03
// is 01 with the dashed red "B = ?" replaced by a solid gold "B = cited" --
// the whole argument as a one-glyph diff. The "on this ledger" half of each
// card is bound to a row or to a checker rule held by a named control.
const FIGS = {
  zero: `<svg viewBox="0 0 220 112" aria-hidden="true">
      <line class="g-bg" x1="30" y1="20" x2="190" y2="20"/>
      <line class="g-tick" x1="30" y1="15" x2="30" y2="25"/>
      <line class="g-tick" x1="190" y1="15" x2="190" y2="25"/>
      <line class="g-sight" x1="110" y1="92" x2="110" y2="20"/>
      <path class="g-obj" d="M110 48 l7 9 -7 9 -7 -9 z"/>
      <circle class="g-nd" cx="110" cy="92" r="5.5"/>
    </svg>`,
  unknown: `<svg viewBox="0 0 220 112" aria-hidden="true">
      <line class="g-bg" x1="30" y1="20" x2="190" y2="20"/>
      <line class="g-tick" x1="30" y1="15" x2="30" y2="25"/>
      <line class="g-tick" x1="190" y1="15" x2="190" y2="25"/>
      <line class="g-sight" x1="55" y1="92" x2="165" y2="20"/>
      <line class="g-sight" x1="165" y1="92" x2="55" y2="20"/>
      <circle class="g-pp" cx="165" cy="20" r="2.8"/>
      <circle class="g-pp" cx="55" cy="20" r="2.8"/>
      <line class="g-shift" x1="55" y1="9" x2="165" y2="9"/>
      <line class="g-shift" x1="55" y1="5" x2="55" y2="13"/>
      <line class="g-shift" x1="165" y1="5" x2="165" y2="13"/>
      <path class="g-obj" d="M110 48 l7 9 -7 9 -7 -9 z"/>
      <circle class="g-nd" cx="55" cy="92" r="5.5"/>
      <circle class="g-nd" cx="165" cy="92" r="5.5"/>
      <line class="g-base bad" x1="63" y1="92" x2="157" y2="92"/>
      <text class="g-bad-txt" x="110" y="108" text-anchor="middle">B = ?</text>
    </svg>`,
  flex: `<svg viewBox="0 0 220 112" aria-hidden="true">
      <line class="g-bg" x1="30" y1="20" x2="190" y2="20"/>
      <line class="g-tick" x1="30" y1="15" x2="30" y2="25"/>
      <line class="g-tick" x1="190" y1="15" x2="190" y2="25"/>
      <line class="g-sight" x1="55" y1="86" x2="185" y2="20"/>
      <line class="g-sight" x1="165" y1="96" x2="74" y2="20"/>
      <path class="g-obj" d="M110 48 l7 9 -7 9 -7 -9 z"/>
      <path class="g-ghost" d="M124 50 l7 9 -7 9 -7 -9 z"/>
      <circle class="g-nd" cx="55" cy="86" r="5.5"/>
      <circle class="g-nd" cx="165" cy="96" r="5.5"/>
      <path class="g-base flex" fill="none" d="M62 88 Q 88 78 110 88 T 158 94"/>
    </svg>`,
  held: `<svg viewBox="0 0 220 112" aria-hidden="true">
      <line class="g-bg" x1="30" y1="20" x2="190" y2="20"/>
      <line class="g-tick" x1="30" y1="15" x2="30" y2="25"/>
      <line class="g-tick" x1="190" y1="15" x2="190" y2="25"/>
      <line class="g-sight" x1="55" y1="92" x2="165" y2="20"/>
      <line class="g-sight" x1="165" y1="92" x2="55" y2="20"/>
      <circle class="g-pp" cx="165" cy="20" r="2.8"/>
      <circle class="g-pp" cx="55" cy="20" r="2.8"/>
      <line class="g-shift" x1="55" y1="9" x2="165" y2="9"/>
      <line class="g-shift" x1="55" y1="5" x2="55" y2="13"/>
      <line class="g-shift" x1="165" y1="5" x2="165" y2="13"/>
      <path class="g-obj" d="M110 48 l7 9 -7 9 -7 -9 z"/>
      <circle class="g-nd" cx="55" cy="92" r="5.5"/>
      <circle class="g-nd" cx="165" cy="92" r="5.5"/>
      <line class="g-base" x1="63" y1="92" x2="157" y2="92"/>
      <text class="g-au" x="110" y="108" text-anchor="middle">B = cited</text>
    </svg>`,
};

const failCards = `
  <div class="fails">
    <article class="fail reveal">
      <div class="fl-head"><span class="fl-num">00</span><span class="fl-name">zero baseline</span></div>
      <div class="fl-fig">${FIGS.zero}</div>
      <div class="fl-half"><span class="fl-cap">in the instrument</span>
        <p>One viewpoint. Nothing shifts; a near star and the far background are
        indistinguishable. There is no measurement to get wrong.</p></div>
      <div class="fl-half"><span class="fl-cap sys">on this ledger</span>
        <p><code>${esc(audit.surface)}</code> (${esc(audit.vendor_alias)}):
        ${audit.results.map((r) => `<span class="pill audit">${esc(r)}</span>`).join(" ")}
        across ${n(audit.docs_searched)} documentation pages. The only date on a
        fundamentals record is <code>${esc(audit.field_quoted)}</code> &mdash; restatements
        overwrite in place, so lookahead has nowhere to show up and
        <b>quietly becomes the dataset</b>.</p></div>
    </article>
    <article class="fail reveal">
      <div class="fl-head"><span class="fl-num">01</span><span class="fl-name">unknown baseline</span></div>
      <div class="fl-fig">${FIGS.unknown}</div>
      <div class="fl-half"><span class="fl-cap">in the instrument</span>
        <p>The shift is right there on the plate, but with no citable separation it
        never becomes a distance &mdash; <b>a number with no meaning</b>.</p></div>
      <div class="fl-half"><span class="fl-cap sys">on this ledger</span>
        <p>A green that has <b>never been shown able to go red</b> cites nothing, so
        the checker refuses it: a live cell arriving without its twin derives
        <span class="pill partial">PARTIAL</span>, never
        <span class="pill claimable">CLAIMABLE</span> &mdash; a rule held by its own
        named control in <code>test-ledger.mjs</code>.</p></div>
    </article>
    <article class="fail reveal">
      <div class="fl-head"><span class="fl-num">02</span><span class="fl-name">flexing baseline</span></div>
      <div class="fl-fig">${FIGS.flex}</div>
      <div class="fl-half"><span class="fl-cap">in the instrument</span>
        <p>The separation moves between the two observations and the instrument
        manufactures shift &mdash; <b>false parallax</b>, indistinguishable from signal on
        a single pair of plates.</p></div>
      <div class="fl-half"><span class="fl-cap sys">on this ledger</span>
        <p>The twin exists to catch exactly this: <code>${esc(twin.planted.mutation)}</code>
        moved the boundary by ${n(twin.planted.mutated_rows)} row and the gate went
        <span class="pill red">${esc(twin.result)}</span> with violations
        <code>${fmtChecks(twin.checks)}</code> &mdash; the plant, the whole plant, and
        nothing but the plant.</p></div>
    </article>
    <article class="fail reveal">
      <div class="fl-head"><span class="fl-num ok">03</span><span class="fl-name">stored viewpoint</span></div>
      <div class="fl-fig">${FIGS.held}</div>
      <div class="fl-half"><span class="fl-cap">in the instrument</span>
        <p>Bessel&#39;s standard: the separation is surveyed and cited beside the
        value, so a better viewpoint later <b>replaces without rewriting</b>.</p></div>
      <div class="fl-half"><span class="fl-cap sys">on this ledger</span>
        <p>Lane ${live.lane} derives
        <span class="pill ${statusByLane[live.lane].toLowerCase()}">${esc(statusByLane[live.lane])}</span>
        today: live <span class="pill green">${esc(live.result)}</span> over
        ${n(live.rows)} as-of rows at d&nbsp;=&nbsp;${day(live.params.d)}, twin red for
        the planted reason. One surface, one lane, one dated run &mdash; <b>and no more
        than that</b>.</p></div>
    </article>
  </div>`;

const verdictRowsHtml = verdicts.map(({ row, rel }) => `
      <tr>
        <td><span class="pill ${row.result.toLowerCase()}">${row.result}</span></td>
        <td class="k">${esc(row.surface)}</td>
        <td>${row.lane} · ${esc(LANES[row.lane])}</td>
        <td>${esc(row.cell)}</td>
        <td>${esc(row.scope)}</td>
        <td class="num">${n(row.rows)}</td>
        <td class="k">${Object.entries(row.checks).map(([k, v]) =>
          `${esc(k)}:${v}`).join("  ")}</td>
        <td>${esc(day(row.ran_at))}</td>
        <td class="k">${esc(row.parallax_sha.slice(0, 12))}${
          row.parallax_worktree === "dirty" ? " <span class='warn'>(dirty)</span>" : ""}</td>
        <td class="k" title="${esc(row.content_hash_basis)}">${esc(row.content_hash.slice(7, 19))}…</td>
        <td><a href="ledger/${esc(rel)}">row</a> <span class="unsigned">unsigned</span></td>
      </tr>`).join("");

const auditRowHtml = audits.map(({ row, rel }) => `
      <tr>
        <td>${row.results.map((r) => `<span class="pill audit">${esc(r)}</span>`).join(" ")}</td>
        <td class="k">${esc(row.surface)} <span class="muted">(${esc(row.vendor_alias)})</span></td>
        <td class="num">${n(row.docs_searched)}</td>
        <td class="k">${esc(row.field_quoted)}</td>
        <td>${esc(day(row.fetched_at))}</td>
        <td class="k" title="sha256 of the committed audit artifact">${esc(row.snapshot_hash.slice(7, 19))}…</td>
        <td><a href="ledger/${esc(rel)}">row</a> <span class="unsigned">unsigned</span></td>
      </tr>`).join("");

const statusBoard = Object.entries(statusByLane).map(([lane, st]) => `
      <tr>
        <td class="k">${lane} · ${esc(LANES[lane])}</td>
        <td><span class="pill ${st.toLowerCase()}">${st}</span></td>
        <td class="muted">${{
          CLAIMABLE: "live cell GREEN and twin cell RED, red matching the planted error exactly",
          PARTIAL: "one of the two cells present — not green",
          UNCLAIMED: "no gate runs on this lane yet",
          UNEVALUABLE: "a cell refused: its evaluation domain could not be read",
        }[st]}</td>
      </tr>`).join("");

const html = `<!doctype html>
<html lang="en" data-theme="ink">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#0A1424" id="metatheme" />
<link rel="icon" href="${SITE}/favicon.ico" sizes="any" />
<title>BASELINE — the conformance ledger</title>
<meta name="description" content="Dated, machine-checked rows stating what a point-in-time gate has shown about named read surfaces. The evidence layer under VANTAGE and PARALLAX: nothing on this page may claim more than the rows." />
<script>(function(){var t='ink';try{var s=localStorage.getItem('hp-theme');t=s==='paper'?'paper':'ink'}catch(e){}var d=document.documentElement;d.dataset.theme=t;d.classList.add('js');})();</script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@600&display=swap" rel="stylesheet" />
<style>
  :root{
    color-scheme:light;
    --bg:#F6F4EE; --bg-2:#EFECE2; --panel:#FCFBF7; --panel-2:#F1EEE5;
    --line:#D8D3C4; --line-soft:#E5E1D4;
    --text:#1E232C; --text-2:#454D5C; --muted:#6C7484;
    --gold:#B07C1E; --gold-text:#7E5A10; --gold-hover:#B07C1E;
    --gold-border:rgba(176,124,30,.35); --gold-wash:rgba(176,124,30,.08);
    --ok:#1E7A4D; --ok-border:#AACFBB; --ok-wash:rgba(30,122,77,.07);
    --block:#AE4529; --block-border:#DFB1A1; --block-wash:rgba(174,69,41,.06);
    --blue:#2D5FA3; --blue-border:#B9C9E1; --blue-wash:rgba(45,95,163,.07);
    --plate:#EDE9DC; --nd-fill:#FCFBF7;
    --header-bg:rgba(246,244,238,.8);
    --shadow:0 1px 2px rgba(30,35,44,.04),0 16px 44px -24px rgba(30,35,44,.22);
    --maxw:1080px;
    --sans:"IBM Plex Sans",system-ui,-apple-system,sans-serif;
    --mono:"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,monospace;
    --display:"Space Grotesk","IBM Plex Sans",system-ui,sans-serif;
  }
  :root[data-theme="ink"]{
    color-scheme:dark;
    --bg:#0A1424; --bg-2:#0D1930; --panel:#101E38; --panel-2:#142440;
    --line:#1D3050; --line-soft:#172942;
    --text:#E9EEF8; --text-2:#B8C5DB; --muted:#7F92B0;
    --gold:#E0A436; --gold-text:#E0A436; --gold-hover:#f3c269;
    --gold-border:#7a5d22; --gold-wash:rgba(224,164,54,.08);
    --ok:#5BB98C; --ok-border:#2c5a44; --ok-wash:rgba(91,185,140,.06);
    --block:#D4654A; --block-border:#6a3327; --block-wash:rgba(212,101,74,.06);
    --blue:#6CA7E8; --blue-border:#2c4a6a; --blue-wash:rgba(108,167,232,.07);
    --plate:#142440; --nd-fill:#0A1424;
    --header-bg:rgba(10,20,36,.8);
    --shadow:0 1px 2px rgba(0,0,0,.3),0 16px 44px -24px rgba(0,0,0,.7);
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{
    margin:0;background:var(--bg);color:var(--text);
    font-family:var(--sans);line-height:1.65;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
    transition:background-color .25s ease,color .25s ease;
  }
  a{color:var(--gold-text);text-decoration:none}
  a:hover{color:var(--gold-hover);text-decoration:underline}
  .wrap{max-width:var(--maxw);margin:0 auto;padding:0 28px}
  code{font-family:var(--mono);font-size:.9em}
  p code,td code,li code{
    background:var(--gold-wash);border:1px solid var(--gold-border);
    border-radius:4px;padding:.05em .35em;color:var(--text);
  }
  .eyebrow{
    font-family:var(--mono);font-size:12px;font-weight:500;
    letter-spacing:.18em;text-transform:uppercase;color:var(--muted);
    display:inline-flex;align-items:center;gap:.6em;
  }

  header{
    position:sticky;top:0;z-index:50;background:var(--header-bg);
    backdrop-filter:blur(10px);border-bottom:1px solid var(--line-soft);
  }
  .nav{display:flex;align-items:center;justify-content:space-between;height:60px}
  .brand{
    font-family:var(--mono);font-weight:600;font-size:15px;letter-spacing:.04em;
    color:var(--text);display:inline-flex;align-items:center;gap:.5em;
    white-space:nowrap;flex:none;
  }
  .brand:hover{text-decoration:none}
  .brand .dot{color:var(--gold-text)}
  .brand .up{color:var(--muted);font-weight:400;font-size:12px;margin-right:2px}
  .nav-links{display:flex;gap:22px;align-items:center}
  .nav-links a{
    font-family:var(--mono);font-size:13px;color:var(--muted);
    letter-spacing:.02em;transition:color .18s ease;white-space:nowrap;
  }
  .nav-links a:hover{color:var(--text);text-decoration:none}
  .nav-links a.ext{color:var(--gold-text)}
  .nav-links a.ext:hover{color:var(--gold-hover)}
  @media(max-width:820px){.nav-links a.hideable{display:none}}
  @media(max-width:560px){.nav-links{gap:12px}.nav-links a.ext{display:none}}
  .theme-sw{
    display:inline-flex;flex:none;border:1px solid var(--line);
    border-radius:999px;overflow:hidden;margin-left:4px;
  }
  .theme-sw button{
    font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.1em;
    text-transform:uppercase;color:var(--muted);background:transparent;border:0;
    padding:6px 12px;cursor:pointer;transition:color .18s ease,background .18s ease;
  }
  .theme-sw button+button{border-left:1px solid var(--line)}
  .theme-sw button[aria-pressed="true"]{color:var(--gold-text);background:var(--gold-wash)}

  .intro{padding:76px 0 8px}
  .intro h1{
    font-family:var(--display);font-size:clamp(34px,5.2vw,52px);
    line-height:1.08;letter-spacing:-.01em;margin:.35em 0 .3em;font-weight:600;
  }
  .intro h1 .dim{color:var(--muted)}
  .lede{font-size:18px;color:var(--text-2);max-width:64ch;margin:0}
  .intro-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:36px;align-items:center}
  @media(max-width:760px){.intro-grid{grid-template-columns:1fr}}
  .hero-fig{margin:0}
  .hero-fig svg{display:block;width:100%;height:auto;max-width:340px;margin:0 auto}
  .g-txt{font-family:var(--mono);font-size:10.5px;fill:var(--muted)}
  .lede b{color:var(--text);font-weight:600}
  h2{
    font-family:var(--display);font-size:26px;font-weight:600;
    letter-spacing:-.005em;margin:64px 0 .5em;
  }
  p{color:var(--text-2);max-width:70ch}
  .muted{color:var(--muted)}
  .warn{color:var(--gold-text)}

  .pill{
    display:inline-block;font-family:var(--mono);font-size:10.5px;font-weight:600;
    letter-spacing:.1em;text-transform:uppercase;border-radius:999px;
    padding:3px 10px;border:1px solid transparent;white-space:nowrap;
  }
  .pill.green,.pill.claimable{color:var(--ok);background:var(--ok-wash);border-color:var(--ok-border)}
  .pill.red{color:var(--block);background:var(--block-wash);border-color:var(--block-border)}
  .pill.audit{color:var(--blue);background:var(--blue-wash);border-color:var(--blue-border)}
  .pill.partial,.pill.unclaimed,.pill.unevaluable{color:var(--muted);background:var(--panel-2);border-color:var(--line)}
  .badge{
    display:inline-block;font-family:var(--mono);font-size:10.5px;font-weight:600;
    letter-spacing:.08em;text-transform:uppercase;color:var(--gold-text);
    border:1px dashed var(--gold-border);background:var(--gold-wash);
    border-radius:4px;padding:3px 9px;vertical-align:middle;
  }
  .unsigned{font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:.06em}
  .okv{color:var(--ok);font-weight:600}
  details.rundetail{
    border:1px solid var(--line);border-radius:10px;background:var(--bg-2);
    margin:18px 0;padding:0 18px;
  }
  details.rundetail summary{
    cursor:pointer;font-family:var(--mono);font-size:11.5px;font-weight:600;
    letter-spacing:.1em;text-transform:uppercase;color:var(--muted);
    padding:13px 0;user-select:none;
  }
  details.rundetail summary:hover{color:var(--gold-text)}
  details.rundetail[open] summary{color:var(--gold-text);border-bottom:1px dashed var(--line)}
  details.rundetail > p{margin:12px 2px}
  details.rundetail > .panel{margin:14px 0}
  details.rundetail > *:last-child{margin-bottom:16px}
  .fails{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:8px}
  @media(max-width:760px){.fails{grid-template-columns:1fr}}
  .fail{
    border:1px solid var(--line);border-radius:10px;background:var(--panel);
    box-shadow:var(--shadow);overflow:hidden;display:flex;flex-direction:column;
  }
  .fail .fl-head{
    padding:13px 20px;border-bottom:1px solid var(--line);background:var(--panel-2);
    display:flex;align-items:baseline;gap:10px;
  }
  .fail .fl-num{font-family:var(--mono);font-size:11px;font-weight:600;color:var(--block)}
  .fail .fl-num.ok{color:var(--ok)}
  .fail .fl-name{font-family:var(--mono);font-size:13px;font-weight:600;color:var(--text);letter-spacing:.02em}
  .fl-fig{padding:14px 18px 2px}
  .fl-fig svg{display:block;width:100%;height:auto;max-width:280px;margin:0 auto}
  .fail .fl-half{padding:15px 20px}
  .fail .fl-half + .fl-half{border-top:1px dashed var(--line)}
  .fail .fl-cap{
    font-family:var(--mono);font-size:10px;font-weight:600;
    letter-spacing:.14em;text-transform:uppercase;color:var(--muted);
  }
  .fail .fl-cap.sys{color:var(--blue)}
  .fail p{margin-top:7px;font-size:13px;color:var(--text-2);line-height:1.6;max-width:none}
  .fail p b{color:var(--text);font-weight:600}
  .g-sight{stroke:var(--blue);stroke-width:1.3;opacity:.75}
  .g-bg{stroke:var(--line);stroke-width:1}
  .g-tick{stroke:var(--muted);stroke-width:1}
  .g-shift{stroke:var(--text);stroke-width:1.3}
  .g-base{stroke:var(--gold);stroke-width:2.4}
  .g-base.bad{stroke:var(--block);stroke-dasharray:4 4}
  .g-base.flex{stroke:var(--block)}
  .g-obj{fill:var(--gold)}
  .g-ghost{fill:none;stroke:var(--block);stroke-width:1.2;opacity:.7}
  .g-nd{fill:var(--nd-fill);stroke:var(--blue);stroke-width:1.4}
  .g-pp{fill:var(--blue)}
  .g-bad-txt{font-family:var(--mono);font-size:11px;font-weight:600;fill:var(--block)}
  .g-au{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.06em;fill:var(--gold-text)}
  .badv{color:var(--block);font-weight:600}
  td.hash{white-space:normal;word-break:break-all;max-width:34ch}

  .sentence{
    border-left:2px solid var(--gold-border);background:var(--panel);
    padding:14px 20px;margin:20px 0;border-radius:0 8px 8px 0;
    color:var(--text);font-size:15.5px;max-width:74ch;
  }
  .sentence.vendor{border-left-color:var(--blue-border)}

  .panel{
    background:var(--panel);border:1px solid var(--line);border-radius:10px;
    box-shadow:var(--shadow);overflow-x:auto;margin:18px 0;
  }
  table{border-collapse:collapse;width:100%;min-width:680px;font-size:13.5px}
  caption{
    caption-side:top;text-align:left;font-family:var(--mono);font-size:11px;
    letter-spacing:.12em;text-transform:uppercase;color:var(--muted);
    padding:12px 18px;border-bottom:1px solid var(--line);background:var(--panel-2);
  }
  th,td{padding:11px 18px;text-align:left;border-bottom:1px solid var(--line-soft);vertical-align:top}
  th{
    font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.08em;
    text-transform:uppercase;color:var(--muted);white-space:nowrap;
  }
  td{color:var(--text-2)}
  td.k{font-family:var(--mono);font-size:12px;color:var(--text);white-space:nowrap}
  td.num{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums;color:var(--text)}
  tr:last-child td{border-bottom:0}

  .optic{margin:34px 0 8px;padding:0}
  .optic svg{display:block;width:100%;height:auto;max-width:900px;margin:0 auto}
  .optic .ln-base{stroke:var(--gold);stroke-width:2.5}
  .optic .ln-tick{stroke:var(--gold);stroke-width:2}
  .optic .ln-sight{stroke:var(--line);stroke-width:1.4;stroke-dasharray:5 5}
  .optic .nd{fill:var(--nd-fill);stroke:var(--gold);stroke-width:2.5}
  .optic .plate{fill:var(--plate);stroke:var(--line);stroke-width:1.5}
  .optic text{font-family:var(--mono);font-size:12.5px;fill:var(--text-2)}
  .optic .t-tag{font-size:11px;fill:var(--gold-text);letter-spacing:.1em}
  .optic .t-name{font-size:14px;font-weight:600;fill:var(--text)}
  .optic .t-name.au{fill:var(--gold-text)}
  .optic .t-sub{font-size:11.5px;fill:var(--muted)}
  .optic .t-mark{font-size:12px;font-weight:600}
  .optic .t-mark.ok{fill:var(--ok)}
  .optic .t-mark.bad{fill:var(--block)}
  .optic figcaption{
    font-size:13.5px;color:var(--muted);max-width:70ch;margin:14px auto 0;
    text-align:center;
  }

  footer{border-top:1px solid var(--line);margin-top:72px;padding:38px 0 60px}
  .foot{
    display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;
    font-family:var(--mono);font-size:12.5px;color:var(--muted);
  }
  footer p{font-family:var(--sans);font-size:13.5px;max-width:66ch;margin:0 0 14px}

  .reveal{opacity:0;transform:translateY(14px);transition:opacity .55s ease,transform .55s ease}
  .reveal.in{opacity:1;transform:none}
  @media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}}
</style>
<noscript><style>.reveal{opacity:1;transform:none}.theme-sw{display:none}</style></noscript>
</head>
<body>

<header>
  <div class="wrap nav">
    <a class="brand" href="${SITE}/"><span class="up">hp /</span>baseline<span class="dot">.</span></a>
    <nav class="nav-links">
      <a href="#claim" class="hideable">claim path</a>
      <a href="#failures" class="hideable">baselines</a>
      <a href="#status" class="hideable">status</a>
      <a href="#ledger" class="hideable">ledger</a>
      <a href="${SITE}/intent/" class="hideable">/intent</a>
      <a href="${SITE}/rigor/" class="hideable">/rigor</a>
      <a href="https://github.com/${REPOS.vantage.repo}" class="ext" target="_blank" rel="noopener">VANTAGE&nbsp;&#8599;</a>
      <a href="https://github.com/${REPOS.parallax.repo}" class="ext" target="_blank" rel="noopener">PARALLAX&nbsp;&#8599;</a>
      <div class="theme-sw" role="group" aria-label="Theme">
        <button type="button" data-set="ink" aria-pressed="true">ink</button>
        <button type="button" data-set="paper" aria-pressed="false">paper</button>
      </div>
    </nav>
  </div>
</header>

<main class="wrap">
  <section class="intro">
    <span class="eyebrow">conformance ledger &middot; the evidence layer of vantage &times; parallax</span>
    <h1>What did you know, and when?<br><span class="dim">Dated, machine-checked proof that one store of SEC fundamentals can answer.</span></h1>
    <div class="intro-grid">
      <p class="lede">Company fundamentals get restated: the revenue a data feed shows you
      today is often not the number anyone could have known at the time, and a backtest
      built on such a feed quietly reads the future. This page is a <b>public test
      record</b> for one alternative &mdash; dated rows showing a specific store of SEC
      fundamentals answering <em>&ldquo;what was known on day&nbsp;D?&rdquo;</em> correctly,
      checked by a gate that was also run against a deliberately corrupted copy to prove
      it can catch a lie. Every number is read out of a row you can open; any claim the
      rows don&#39;t back wears a badge. It publishes test results, not the data itself.</p>
      <figure class="hero-fig" aria-label="A parallax construction. Two observers on a solid gold baseline read the same filer-quarter: one as of day D, one today. Their sight lines cross at the fact and project it to two different positions on a background line; the bracket between the projections is the restatement. The baseline is labeled B = cited.">
        <svg viewBox="0 0 340 210" aria-hidden="true">
          <line class="g-bg" x1="40" y1="28" x2="300" y2="28"/>
          <line class="g-tick" x1="40" y1="22" x2="40" y2="34"/>
          <line class="g-tick" x1="300" y1="22" x2="300" y2="34"/>
          <circle class="g-pp" cx="115" cy="28" r="2.8"/>
          <circle class="g-pp" cx="225" cy="28" r="2.8"/>
          <line class="g-shift" x1="115" y1="14" x2="225" y2="14"/>
          <line class="g-shift" x1="115" y1="10" x2="115" y2="18"/>
          <line class="g-shift" x1="225" y1="10" x2="225" y2="18"/>
          <text class="g-txt" x="170" y="8" text-anchor="middle">the restatement</text>
          <line class="g-sight" x1="85" y1="168" x2="225" y2="28"/>
          <line class="g-sight" x1="255" y1="168" x2="115" y2="28"/>
          <path class="g-obj" d="M170 80 l8 10 -8 10 -8 -10 z"/>
          <text class="g-txt" x="170" y="118" text-anchor="middle">same filer-quarter</text>
          <circle class="g-nd" cx="85" cy="168" r="6"/>
          <circle class="g-nd" cx="255" cy="168" r="6"/>
          <line class="g-base" x1="94" y1="168" x2="246" y2="168"/>
          <text class="g-au" x="170" y="158" text-anchor="middle">B = cited</text>
          <text class="g-txt" x="85" y="192" text-anchor="middle">read as-of day D</text>
          <text class="g-txt" x="255" y="192" text-anchor="middle">read today</text>
        </svg>
      </figure>
    </div>
  </section>

  <h2 id="pieces">The three pieces</h2>
  <p>Three public repositories share the work, and a reviewer can follow the whole
  chain. <b>VANTAGE</b> builds a point-in-time store of SEC fundamentals &mdash; every
  value keeps the date it became knowable, so the store can be read &ldquo;as of&rdquo;
  any day. <b>PARALLAX</b> is the test harness that interrogates that store: does an
  as-of read leak anything from the future, lose history, or hide a restatement?
  <b>BASELINE</b> &mdash; this page &mdash; publishes only what those tests returned,
  each claim tied to a row below by a field you can check yourself.</p>
  <div class="panel reveal"><table>
    <caption>how each piece is bound to these rows</caption>
    <thead><tr><th>Piece</th><th>Role</th><th>Bound by</th></tr></thead>
    <tbody>
      <tr>
        <td class="k"><a href="https://github.com/${esc(REPOS.vantage.repo)}">${esc(REPOS.vantage.name)}</a></td>
        <td>${esc(REPOS.vantage.role)}</td>
        <td class="k">surface = ${esc(surface)}</td>
      </tr>
      <tr>
        <td class="k"><a href="https://github.com/${esc(REPOS.parallax.repo)}">${esc(REPOS.parallax.name)}</a></td>
        <td>${esc(REPOS.parallax.role)}</td>
        <td class="k">parallax_sha = ${esc(live ? live.parallax_sha.slice(0, 12) : "n/a")}</td>
      </tr>
      <tr>
        <td class="k">BASELINE</td>
        <td>publishes the rows and refuses to outrun them</td>
        <td class="k"><a href="ledger/SOURCE.md">ledger/SOURCE.md</a></td>
      </tr>
    </tbody>
  </table></div>
  <p class="muted">Neither upstream repo is a dependency of this page: the rows are
  hand-copied across a hash-bound seam described in
  <a href="ledger/SOURCE.md">SOURCE.md</a>. Replaying a row needs the VANTAGE gold
  surface, which is not published; the <code>content_hash</code> on each row is what a
  reader without it can still check.</p>

  <h2 id="claim">The claim path <span class="pill green">row-backed</span></h2>
  <p>The gate reads a fundamentals surface the way a consumer would, re-derives what
  <em>should</em> be visible at a chosen instant from the acceptance evidence, and counts
  disagreements. A green gate is credited only when the same gate, pointed at a copy of
  the surface carrying one deliberately planted error, goes red &mdash; catching exactly
  the plant and nothing else.</p>
${diagram}
  <div class="sentence">${liveSentence}</div>
  <details class="rundetail reveal">
    <summary>open the run &mdash; the checks, the plant, and every field of the two rows</summary>
${checksTable}
    <p>${plantSentence}</p>
${anatomy}
  </details>

  <h2 id="failures">How baselines fail &mdash; and the one that holds</h2>
  <p>Every fundamentals read surface handles the viewpoint problem in one of four
  ways. Three of them lose the claim &mdash; each in a different place &mdash; and each
  broken variant below is pinned to what this ledger actually holds against it.</p>
${failCards}

  <h2>What a feed without a viewpoint costs <span class="badge">reported, not on the ledger</span></h2>
  <p>Measured on a sample of 17,787 filer-quarters from the same surface: when revisions
  land, they are rare but violent &mdash; in 1.51% of cases the reported growth story
  <em>flips sign</em>. A quarter your feed shows as growth was, on the day you would have
  traded it, a decline. This measurement is reported from PARALLAX study&nbsp;001 and does
  not yet have a ledger row of its own; until it does, it carries this badge.</p>

  <h2 id="status">Status by lane</h2>
  <p>Surface under test: <code>${esc(surface)}</code>. A lane is CLAIMABLE only when both
  cells exist: the live surface green <em>and</em> the planted-error twin red for exactly
  the planted reason. Status is recomputed from the rows at every build; it is never
  written down.</p>
  <div class="panel reveal"><table>
    <caption>derived at build time, never authored</caption>
    <thead><tr><th>Lane</th><th>Status</th><th>Meaning</th></tr></thead>
    <tbody>${statusBoard}
    </tbody>
  </table></div>

  <h2 id="ledger">The ledger</h2>
  <p>Gate verdicts &mdash; each resolves to a replayable run (commit, content hash):</p>
  <div class="panel reveal"><table>
    <caption>GATE_VERDICT &middot; gate output, never hand-edited</caption>
    <thead><tr><th>Result</th><th>Surface</th><th>Lane</th><th>Cell</th><th>Scope</th>
      <th>As-of rows</th><th>Violations by check</th><th>Ran</th>
      <th>Gate commit</th><th>Content hash</th><th>Provenance</th></tr></thead>
    <tbody>${verdictRowsHtml}
    </tbody>
  </table></div>
  <p>Surface audits &mdash; established by reading vendor documentation, visibly not gate
  runs, coloured accordingly:</p>
  <div class="panel reveal"><table>
    <caption>SURFACE_AUDIT &middot; hand-authored from vendor documentation</caption>
    <thead><tr><th>Finding</th><th>Surface</th><th>Corpus pages</th><th>Dating field</th>
      <th>Fetched</th><th>Snapshot hash</th><th>Provenance</th></tr></thead>
    <tbody>${auditRowHtml}
    </tbody>
  </table></div>
  <details class="rundetail reveal">
    <summary>open the audit &mdash; the row&#39;s sentence, its notes verbatim, method controls, corpus</summary>
    <div class="sentence vendor">${auditSentence}</div>
    <div class="sentence vendor">${esc(audit.notes)} <span class="muted">&mdash; the row&#39;s own notes field, verbatim.</span></div>
    <p class="muted">Method controls held on the audit itself: ${["live_fire", "positive", "negative"].map((c) =>
      `<code>${c}</code>&nbsp;${audit.controls[c] ? "&#10003;" : '<span class="badv">&#10007;</span>'}`).join(" · ")}.
    Corpus: ${esc(audit.doc_scope)}.</p>
  </details>
</main>

<footer>
  <div class="wrap">
    <p>Every row is hash-anchored and <em>unsigned</em> &mdash; row signing is a planned
    extension, not built. File-level bindings and the replay command live in
    <a href="ledger/SOURCE.md">ledger/SOURCE.md</a>. The ledger is validated by
    <code>check-ledger.mjs</code>, itself held by positive and negative controls, before
    this page is allowed to build &mdash; and again by the host before it is allowed to
    deploy.</p>
    <div class="foot">
      <span>BASELINE &middot; the evidence layer</span>
      <span><a href="https://github.com/hossainpazooki/baseline">source</a></span>
    </div>
  </div>
</footer>

<script>
(function(){
  var revealed = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    revealed.forEach(function(el){ el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold:.15 });
    revealed.forEach(function(el){ io.observe(el); });
  }
  var META_COLORS = { paper:'#F6F4EE', ink:'#0A1424' };
  var meta = document.getElementById('metatheme');
  var swBtns = document.querySelectorAll('.theme-sw button');
  function applyTheme(t){
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('hp-theme', t); } catch(e){}
    if (meta) meta.setAttribute('content', META_COLORS[t] || META_COLORS.paper);
    swBtns.forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.set === t)); });
  }
  swBtns.forEach(function(b){
    b.addEventListener('click', function(){ applyTheme(b.dataset.set); });
  });
  applyTheme(document.documentElement.dataset.theme === 'paper' ? 'paper' : 'ink');
})();
</script>
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
