#!/usr/bin/env node
// Negative controls for check-ledger.mjs — one mutation per failure mode in
// the spec (§5/§6 and its amendments), each applied to a fresh copy of a
// known-good fixture ledger. A control that does NOT fail the check is itself
// a test failure, and each control must fail for its OWN reason (message
// pattern), not by tripping an unrelated leg. Positive controls pin what must
// still pass, and what a passing ledger derives and renders. CLI checks pin
// the exit codes of check-ledger.mjs and build.mjs.
//
// Generation zero (ledger/verdicts/) is frozen to the two committed rows, so
// every fixture ledger carries byte copies of those two rows, read from this
// repository's own ledger/. A control that changes generation zero is also
// refused by the freeze; it still has to name its own reason.

import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync,
  unlinkSync, existsSync, cpSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import process from "node:process";

// Namespace import: a function this suite expects but the library does not
// export reads as undefined and fails its own control by name, instead of
// failing the whole suite at module link time.
import * as lib from "./lib/ledger.mjs";
import { checkLedger } from "./check-ledger.mjs";

const { sha256, loadLedger, currentGeneration } = lib;

// CI and Vercel both invoke this file as `node scripts/test-ledger.mjs` from
// the repo root, so process.cwd() is the repo root: build-based controls copy
// the real generator from here, and fixtures copy the committed legacy rows.
const REPO = process.cwd();
const REPO_SCRIPTS = join(REPO, "scripts");
const REPO_LEDGER = join(REPO, "ledger");
const CHECK_LEDGER_CLI = join(REPO_SCRIPTS, "check-ledger.mjs");

const SURFACE = "vantage-gold-local-parquet";
const LIVE = `verdicts/${SURFACE}-lane1-live-20260901T174848.951466Z.json`;
const TWIN = `verdicts/${SURFACE}-lane1-twin-20260901T174849.431640Z.json`;
const AUDIT = "audits/fixture-vendor-2026-01-01.json";
const SNAP = "snapshots/audit-fixture.json";
const LEGACY_FREEZE = /^verdicts\/ is frozen: /;

const FUTURE = "plant_future_accepted";
const MONO = "plant_monotonicity_regression";
const FUTURE_CHECKS = { no_future_accepted: 1, as_of_monotonicity: 0, restatement_visibility: 1 };
const MONO_CHECKS = { no_future_accepted: 0, as_of_monotonicity: 1, restatement_visibility: 0 };
const ZERO_CHECKS = { no_future_accepted: 0, as_of_monotonicity: 0, restatement_visibility: 0 };

// A legacy row: the committed row of that cell, with `extra` laid over it.
function verdictRow(cell, extra = {}) {
  const base = JSON.parse(readFileSync(join(REPO_LEDGER, cell === "twin" ? TWIN : LIVE), "utf8"));
  return { ...base, ...extra };
}

// Rebinds SOURCE.md over every regular file under verdicts/, audits/,
// snapshots/, and runs/<generation>/ (recursively, so a fresh generation
// directory or the supersession pointer gets bound the same as anything
// else) — generic over what a control has actually written to disk. Files a
// control places anywhere else under the ledger stay unbound unless the
// control binds them itself.
function rebind(dir) {
  const lines = [];
  const walk = (relDir) => {
    const abs = join(dir, relDir);
    let entries = [];
    try { entries = readdirSync(abs, { withFileTypes: true }); } catch { /* pruned by a control */ }
    for (const e of entries) {
      const rel = `${relDir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else lines.push(`${sha256(readFileSync(join(dir, rel)))}  ${rel}`);
    }
  };
  for (const top of ["verdicts", "audits", "snapshots", "runs"]) walk(top);
  if (existsSync(join(dir, "supersession.json"))) {
    lines.push(`${sha256(readFileSync(join(dir, "supersession.json")))}  supersession.json`);
  }
  writeFileSync(join(dir, "SOURCE.md"), `# fixture binding\n\n## sha256\n\n${lines.join("\n")}\n`);
}

function bindExtra(dir, rel) {
  const src = readFileSync(join(dir, "SOURCE.md"), "utf8");
  writeFileSync(join(dir, "SOURCE.md"), `${src}${sha256(readFileSync(join(dir, rel)))}  ${rel}\n`);
}

function writeRow(dir, rel, row) {
  writeFileSync(join(dir, rel), JSON.stringify(row, null, 2) + "\n");
}

function writePointer(dir, map) {
  writeFileSync(join(dir, "supersession.json"), JSON.stringify({ superseded: map }, null, 2) + "\n");
}

function readPointer(dir) {
  return JSON.parse(readFileSync(join(dir, "supersession.json"), "utf8")).superseded;
}

// Text surgery for controls that need JSON a serializer cannot produce
// (duplicate keys). Throws when the needle is absent, so a fixture change
// cannot silently turn the control into a no-op.
function replaceOnce(text, needle, replacement) {
  const i = text.indexOf(needle);
  if (i < 0) throw new Error(`fixture text does not contain ${JSON.stringify(needle)}`);
  return text.slice(0, i) + replacement + text.slice(i + needle.length);
}

// Renames a row file, carrying every pointer entry that names it.
function moveRow(dir, from, to) {
  writeFileSync(join(dir, to), readFileSync(join(dir, from)));
  unlinkSync(join(dir, from));
  const map = existsSync(join(dir, "supersession.json")) ? readPointer(dir) : {};
  writePointer(dir, Object.fromEntries(Object.entries(map).map(
    ([k, v]) => [k === from ? to : k, v === from ? to : v])));
  rebind(dir);
}

// A shared-row copy of a legacy verdictRow(): schema added, parallax_sha /
// parallax_worktree renamed to gate_sha / gate_worktree, everything else
// (including `planted`) carried through unchanged.
const SHARED_SCHEMA = "datum/gate-verdict/1";
function sharedRow(cell, extra = {}) {
  const legacy = verdictRow(cell, extra);
  const { parallax_sha, parallax_worktree, ...rest } = legacy;
  return { schema: SHARED_SCHEMA, ...rest, gate_sha: parallax_sha, gate_worktree: parallax_worktree };
}

// Shared-row file names: a live is <surface>-lane<n>-live-<stamp>.json, a
// twin carries its mutation, <surface>-lane<n>-twin-<mutation>-<stamp>.json.
const liveRel = (gen, stamp, lane = 1) => `${gen}/${SURFACE}-lane${lane}-live-${stamp}.json`;
const twinRel = (gen, mutation, stamp, lane = 1) => `${gen}/${SURFACE}-lane${lane}-twin-${mutation}-${stamp}.json`;

// A refusal pattern anchored at one row path: the gate must refuse that row,
// by name, for `reason` (a RegExp), not some other row for the same reason.
const rowReason = (rel, reason) =>
  new RegExp(`^${rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: ${reason.source}`);

// A second twin with a distinct mutation that falsifies the one check the
// first twin's plant never moves (as_of_monotonicity).
const MONO_PLANT = {
  mutation: MONO,
  mutated_rows: 1,
  expected_violations: { ...MONO_CHECKS },
};
function monoTwin(extra = {}) {
  return sharedRow("twin", {
    ran_at: "2026-09-14T00:00:02Z",
    checks: { ...MONO_CHECKS },
    planted: { ...MONO_PLANT, expected_violations: { ...MONO_CHECKS } },
    ...extra,
  });
}

const UNEVALUABLE_FIELDS = {
  result: "UNEVALUABLE",
  unevaluable_reason: "fixture: the evaluation domain is empty",
  evaluated: { ...ZERO_CHECKS },
  checks: { ...ZERO_CHECKS },
  rows: 0,
};

// A generation directory, stamped after the committed legacy rows ran,
// holding a shared-row live+twin pair for the same cell that supersedes
// them — the shared base every supersession control mutates from.
const GEN = "runs/20260914T000000Z";
const LIVE2 = liveRel(GEN, "20260914T000000Z");
const TWIN2 = twinRel(GEN, FUTURE, "20260914T000001Z");
const TWIN2B = twinRel(GEN, MONO, "20260914T000002Z");

function goodSupersededLedger(gen = GEN) {
  const dir = goodLedger();
  const live2 = liveRel(gen, "20260914T000000Z");
  const twin2 = twinRel(gen, FUTURE, "20260914T000001Z");
  mkdirSync(join(dir, gen), { recursive: true });
  writeRow(dir, live2, sharedRow("live", { ran_at: "2026-09-14T00:00:00Z" }));
  writeRow(dir, twin2, sharedRow("twin", { ran_at: "2026-09-14T00:00:01Z" }));
  writePointer(dir, { [LIVE]: live2, [TWIN]: twin2 });
  rebind(dir);
  return dir;
}

// goodSupersededLedger() plus a second twin of a distinct mutation in the
// current generation: every live check is falsified by some twin.
function multiTwinLedger() {
  const dir = goodSupersededLedger();
  writeRow(dir, TWIN2B, monoTwin());
  rebind(dir);
  return dir;
}

// Three generations: legacy verdicts/ -> a retired shared-row generation
// GEN_A -> the current GEN (two twins). Options mutate the retired
// generation.
const GEN_A = "runs/20260910T000000Z";
const LIVE_A = liveRel(GEN_A, "20260910T000000Z");
const TWIN_A = twinRel(GEN_A, FUTURE, "20260910T000001Z");
function twoGenerationLedger({ retiredLive = {}, retiredTwin = {}, extra = [] } = {}) {
  const dir = goodLedger();
  mkdirSync(join(dir, GEN_A), { recursive: true });
  mkdirSync(join(dir, GEN), { recursive: true });
  writeRow(dir, LIVE_A, sharedRow("live", { ran_at: "2026-09-10T00:00:00Z", ...retiredLive }));
  writeRow(dir, TWIN_A, sharedRow("twin", { ran_at: "2026-09-10T00:00:01Z", ...retiredTwin }));
  writeRow(dir, LIVE2, sharedRow("live", { ran_at: "2026-09-14T00:00:00Z" }));
  writeRow(dir, TWIN2, sharedRow("twin", { ran_at: "2026-09-14T00:00:01Z" }));
  writeRow(dir, TWIN2B, monoTwin());
  const map = { [LIVE]: LIVE_A, [TWIN]: TWIN_A, [LIVE_A]: LIVE2, [TWIN_A]: TWIN2 };
  for (const { rel, row, successor } of extra) {
    writeRow(dir, rel, row);
    map[rel] = successor;
  }
  writePointer(dir, map);
  rebind(dir);
  return dir;
}

function goodLedger() {
  const dir = mkdtempSync(join(tmpdir(), "baseline-fixture-"));
  for (const sub of ["verdicts", "audits", "snapshots"]) mkdirSync(join(dir, sub));
  for (const rel of [LIVE, TWIN]) cpSync(join(REPO_LEDGER, rel), join(dir, rel));
  const snapBody = JSON.stringify({ vendor: "FIXTURE", findings: "none" }) + "\n";
  writeFileSync(join(dir, SNAP), snapBody);
  writeRow(dir, AUDIT, {
    kind: "SURFACE_AUDIT",
    surface: "fixture-vendor",
    vendor_alias: "FIXTURE",
    docs_searched: 3,
    fetched_at: "2026-01-01T00:00:00+00:00",
    audit_artifact: SNAP,
    snapshot_hash: "sha256:" + sha256(snapBody),
    field_quoted: "filing_date",
    controls: { live_fire: true, positive: true, negative: true },
    results: ["NO_AS_OF_MODE"],
  });
  rebind(dir);
  return dir;
}

function editRow(dir, rel, fn) {
  const row = JSON.parse(readFileSync(join(dir, rel), "utf8"));
  writeRow(dir, rel, fn(row) ?? row);
  rebind(dir);
}

// --- harness ---------------------------------------------------------------
const scratch = [];
const track = (d) => { scratch.push(d); return d; };

function runNode(args, cwd) {
  try {
    const out = execFileSync(process.execPath, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out, err: "" };
  } catch (e) {
    return { code: e.status ?? -1, out: String(e.stdout ?? ""), err: String(e.stderr ?? "") };
  }
}

// Runs build.mjs (the real, current generator) in a scratch root that has
// its own copy of scripts/ and the given ledger dir as ./ledger. Returns the
// exit code, output, and the emitted index.html (null when none was written).
function buildIn(ledgerDir, args = []) {
  const root = track(mkdtempSync(join(tmpdir(), "baseline-build-")));
  cpSync(REPO_SCRIPTS, join(root, "scripts"), { recursive: true });
  cpSync(ledgerDir, join(root, "ledger"), { recursive: true });
  const r = runNode(["scripts/build.mjs", ...args], root);
  const out = join(root, "index.html");
  return { ...r, html: existsSync(out) ? readFileSync(out, "utf8") : null };
}

// The slice of `html` from `from` up to the next `to` ("" when `from` is
// absent), so an assertion reads one section of the page, not the whole page.
const between = (html, from, to) => {
  const i = html.indexOf(from);
  if (i < 0) return "";
  const j = html.indexOf(to, i + from.length);
  return j < 0 ? html.slice(i) : html.slice(i, j);
};
const section = (html, marker) => between(html, marker, "</table>");
const historyOf = (html) => section(html, "superseded, history only");
const liveTableOf = (html) => section(html, "GATE_VERDICT &middot; gate output");
const statusBoardOf = (html) => section(html, "derived at build time, never authored");
// The one history-table row whose provenance link is `rel`.
function historyRowOf(html, rel) {
  const hist = historyOf(html);
  const i = hist.indexOf(`href="ledger/${rel}">row`);
  if (i < 0) return "";
  return hist.slice(hist.lastIndexOf("<tr>", i), hist.indexOf("</tr>", i));
}

function currentCells(dir, key = `${SURFACE}:lane1`) {
  const l = loadLedger(dir);
  return lib.groupCells(l.verdicts, l.superseded).get(key);
}
function creditOf(cells) {
  if (typeof lib.deriveCredit !== "function") throw new Error("lib/ledger.mjs exports no deriveCredit");
  return lib.deriveCredit(cells);
}
const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let failures = 0;
const counts = { positive: 0, negative: 0, cli: 0 };

// kind: "positive" | "cli"; fn returns a list of problems (empty = held).
function check(kind, name, fn) {
  counts[kind]++;
  let problems;
  try {
    problems = fn();
  } catch (e) {
    problems = [`threw: ${e.message}`];
  } finally {
    while (scratch.length) rmSync(scratch.pop(), { recursive: true, force: true });
  }
  if (problems.length) {
    failures++;
    console.error(`FAIL ${kind} "${name}":\n  ${problems.join("\n  ")}`);
  } else {
    console.log(`ok   ${kind} "${name}"`);
  }
}

function gatePasses(dir) {
  const errs = checkLedger(dir);
  return errs.length ? [`gate refused a ledger that must pass:`, ...errs] : [];
}

// A ledger whose generation zero was changed on purpose: the freeze must
// refuse it, and nothing else may. Used where the rule under test can only
// be reached by changing generation zero, which no real ledger can do.
function onlyFreezeRefuses(dir) {
  const errs = checkLedger(dir);
  const problems = [];
  if (!errs.some((e) => LEGACY_FREEZE.test(e))) problems.push("the legacy freeze did not refuse a changed generation zero");
  const other = errs.filter((e) => !LEGACY_FREEZE.test(e));
  if (other.length) problems.push("refusals other than the legacy freeze:", ...other);
  if (typeof lib.validateGenerations === "function") {
    const genErrs = lib.validateGenerations(loadLedger(dir));
    if (genErrs.length) problems.push("validateGenerations refused:", ...genErrs);
  }
  return problems;
}

// [name, mutate(dir), expected error pattern, base?]
const CONTROLS = [
  ["missing required field", (d) =>
    editRow(d, LIVE, (r) => { delete r.rows; }), /missing fields: rows/],
  ["malformed json", (d) => {
    writeFileSync(join(d, LIVE), "{ not json");
    rebind(d);
  }, /malformed JSON/],
  ["snapshot hash mismatch", (d) => {
    writeFileSync(join(d, SNAP), "tampered\n");
    rebind(d); // SOURCE agrees with the tamper; the audit row's pin must not
  }, /snapshot_hash does not match/],
  ["authored status literal", (d) =>
    editRow(d, LIVE, (r) => { r.derived = "CLAIMABLE"; }), /authored status literal/],
  ["unknown result value", (d) =>
    editRow(d, LIVE, (r) => { r.result = "GREENISH"; }), /unknown result/],
  ["twin red not matching plant", (d) =>
    editRow(d, TWIN, (r) => { r.checks.no_future_accepted = 2; }),
    /does not match the plant/],
  ["live carrying a plant", (d) =>
    editRow(d, LIVE, (r) => { r.planted = { expected_violations: {} }; }),
    /live verdict must not carry/],
  ["file unbound in SOURCE.md", (d) => {
    const src = readFileSync(join(d, "SOURCE.md"), "utf8");
    writeFileSync(join(d, "SOURCE.md"),
      src.split("\n").filter((l) => !l.includes("lane1-live")).join("\n"));
  }, /present but not bound/],
  ["binding without file", (d) => {
    unlinkSync(join(d, TWIN));
  }, /binds .* but the file is absent/],
  ["hash drift after copy", (d) => {
    const row = JSON.parse(readFileSync(join(d, LIVE), "utf8"));
    row.rows = 9; row.evaluated.no_future_accepted = 9;
    writeRow(d, LIVE, row); // deliberately NOT rebound
  }, /sha256 does not match SOURCE.md binding/],
  ["duplicate cell", (d) => {
    writeRow(d, `verdicts/${SURFACE}-lane1-live-20260901T174850Z.json`,
      verdictRow("live", { ran_at: "2026-09-01T17:48:50Z" }));
    rebind(d);
  }, /second live cell/],
  ["live red refuses derivation", (d) => {
    editRow(d, LIVE, (r) => {
      r.result = "RED";
      r.checks.no_future_accepted = 3;
    });
  }, /needs a human/],
  ["filename disagrees with row", (d) =>
    editRow(d, LIVE, (r) => { r.surface = "other-surface"; }),
    /filename disagrees|filename not/],
  ["vacuous check not unevaluable", (d) =>
    editRow(d, LIVE, (r) => { r.evaluated.as_of_monotonicity = 0; }),
    /evaluated 0 rows but result is not UNEVALUABLE/],
  ["rows disagrees with evaluated", (d) =>
    editRow(d, LIVE, (r) => { r.rows = 7; }), /rows must equal/],
  ["audit without held controls", (d) =>
    editRow(d, AUDIT, (r) => { r.controls.negative = false; }),
    /control negative not held/],
  ["empty ledger", (d) => {
    for (const sub of ["verdicts", "audits", "snapshots"]) {
      for (const f of readdirSync(join(d, sub))) unlinkSync(join(d, sub, f));
    }
    rebind(d);
  }, /no rows at all/],
  ["subdirectory in verdicts/", (d) => {
    mkdirSync(join(d, "verdicts", "old"));
    rebind(d);
  }, /not a regular file in a rows directory/],
  // Input hole (S1): the old loadLedger filtered `f.endsWith(".json")`
  // case-sensitively, so an uppercase-extension file was hash-bound and
  // passed SOURCE.md's disk scan (which is NOT extension-filtered) while
  // never being loaded as a row — invisible to every row-level check,
  // including a live cell that reports RED. Fixed loadLedger loads every
  // regular file regardless of extension case, so this now surfaces (here,
  // as a filename-shape failure) instead of silently passing.
  ["bound upper-case BAD.JSON live-RED row", (d) => {
    writeRow(d, "verdicts/BAD.JSON", verdictRow("live", {
      result: "RED",
      checks: { no_future_accepted: 3, as_of_monotonicity: 0, restatement_visibility: 0 },
    }));
    rebind(d);
  }, /verdicts\/BAD\.JSON: filename not/],
  // The known cost (S2/design amendment): a new generation must re-emit
  // every cell of every lane, not just the lane being changed. Lane 1 stays
  // unsuperseded in the legacy verdicts/ while lane 2 appears only in the
  // new generation directory — two directories both hold non-superseded
  // rows, which is refused outright rather than silently accepted.
  ["new generation adds a lane without re-emitting the old lane", (d) => {
    mkdirSync(join(d, GEN), { recursive: true });
    writeRow(d, liveRel(GEN, "20260914T000000Z", 2),
      sharedRow("live", { lane: 2, ran_at: "2026-09-14T00:00:00Z" }));
    writeRow(d, twinRel(GEN, FUTURE, "20260914T000001Z", 2),
      sharedRow("twin", { lane: 2, ran_at: "2026-09-14T00:00:01Z" }));
    rebind(d);
  }, /non-superseded rows span/],

  // --- the whole ledger root is listed, not just the rows directories ------
  // A row in a folder the loader never reads (ledger/verdicts-old/, or a
  // case variant such as ledger/Verdicts/ on a case-sensitive runner) must
  // not pass just because it is bound; nor may a loose unbound file.
  ["bound row in a folder outside the rows directories", (d) => {
    mkdirSync(join(d, "verdicts-old"));
    const rel = `verdicts-old/${SURFACE}-lane1-live-20260101T000009Z.json`;
    writeRow(d, rel, verdictRow("live", { result: "RED", checks: { ...FUTURE_CHECKS } }));
    rebind(d);
    bindExtra(d, rel);
  }, /verdicts-old: unexpected entry at the ledger root/],
  ["unbound loose file at the ledger root", (d) => {
    writeRow(d, "stray-live.json", verdictRow("live", { result: "RED", checks: { ...FUTURE_CHECKS } }));
    rebind(d);
  }, /stray-live\.json: present but not bound/],

  // --- ran_at is a strict ISO-8601 UTC instant -----------------------------
  ["impossible calendar date in ran_at", (d) =>
    editRow(d, LIVE, (r) => { r.ran_at = "2026-02-30T00:00:00Z"; }),
    /ran_at "2026-02-30T00:00:00Z" is not a strict ISO-8601 UTC instant/],

  // --- one twin per cell stays the rule of the frozen legacy generation ----
  ["second twin in the legacy generation stays refused", (d) => {
    writeRow(d, `verdicts/${SURFACE}-lane1-twin-20260901T174850Z.json`, verdictRow("twin", {
      ran_at: "2026-09-01T17:48:50Z",
      checks: { ...MONO_CHECKS },
      planted: { ...MONO_PLANT, expected_violations: { ...MONO_CHECKS } },
    }));
    rebind(d);
  }, /second twin cell/],
  ["legacy filename carrying a mutation segment", (d) =>
    moveRow(d, TWIN, `verdicts/${SURFACE}-lane1-twin-${FUTURE}-20260901T174849.431640Z.json`),
    /lane1-twin-plant_future_accepted-20260901T174849\.431640Z\.json: filename not/],

  // --- generation zero is frozen to the two committed rows ------------------
  // Rebinding SOURCE.md is not enough: the set of legacy files and each
  // file's hash are fixed in the library, so a legacy row cannot be added,
  // changed or removed and then judged under the legacy rules.
  ["legacy row added to generation zero", (d) => {
    writeRow(d, `verdicts/${SURFACE}-lane2-live-20260901T174850Z.json`,
      verdictRow("live", { lane: 2, ran_at: "2026-09-01T17:48:50Z" }));
    rebind(d);
  }, /verdicts\/ is frozen: verdicts\/vantage-gold-local-parquet-lane2-live-20260901T174850Z\.json is not one of the committed legacy rows/],
  ["committed legacy row changed and rebound", (d) =>
    editRow(d, LIVE, (r) => { r.scope = "edited after publication"; }),
    /verdicts\/ is frozen: verdicts\/vantage-gold-local-parquet-lane1-live-.* changed/],
  ["committed legacy row removed", (d) => {
    unlinkSync(join(d, TWIN));
    rebind(d);
  }, /verdicts\/ is frozen: committed legacy row verdicts\/vantage-gold-local-parquet-lane1-twin-.* is missing/],

  // --- the legacy needs-a-human refusals hold in the current generation ------
  // A lone live RED used to derive PARTIAL here; in the current generation
  // it now refuses, the same as in a shared-row generation.
  ["lone live RED in the current legacy generation", (d) => {
    unlinkSync(join(d, TWIN));
    editRow(d, LIVE, (r) => { r.result = "RED"; r.checks = { ...FUTURE_CHECKS }; });
  }, /live RED needs a human/],
  ["lone GREEN twin in the current legacy generation", (d) => {
    unlinkSync(join(d, LIVE));
    editRow(d, TWIN, (r) => { r.result = "GREEN"; r.checks = { ...ZERO_CHECKS }; });
  }, /twin GREEN needs a human/],
  // The refusals run before the UNEVALUABLE return: an UNEVALUABLE row in
  // the cell does not hide a GREEN twin.
  ["unevaluable live beside a GREEN twin in the current legacy generation", (d) => {
    editRow(d, LIVE, (r) => ({ ...r, result: "UNEVALUABLE", evaluated: { ...ZERO_CHECKS }, checks: { ...ZERO_CHECKS }, rows: 0 }));
    editRow(d, TWIN, (r) => { r.result = "GREEN"; r.checks = { ...ZERO_CHECKS }; });
  }, /twin GREEN needs a human/],
  ["legacy row with evaluated null refuses with a named reason", (d) =>
    editRow(d, LIVE, (r) => { r.evaluated = null; }), /evaluated must be a JSON object/],

  // --- snapshots/ and audits/ hold no verdict rows ----------------------------
  ["verdict row hidden in snapshots/", (d) => {
    writeRow(d, "snapshots/hidden-lane1-live.json", verdictRow("live", { result: "RED", checks: { ...FUTURE_CHECKS } }));
    rebind(d);
  }, /snapshots\/hidden-lane1-live\.json: holds a GATE_VERDICT row/],
  ["snapshot that no audit row names", (d) => {
    writeFileSync(join(d, "snapshots", "extra.json"), '{"note": 1}\n');
    rebind(d);
  }, /snapshots\/extra\.json: no audit row names it as its audit_artifact/],
  ["verdict row in audits/", (d) => {
    writeRow(d, "audits/hidden-lane1-live.json", verdictRow("live"));
    rebind(d);
  }, /audits\/hidden-lane1-live\.json: kind "GATE_VERDICT" in audits\//],
  ["audit artifact outside snapshots/", (d) =>
    editRow(d, AUDIT, (r) => {
      r.audit_artifact = LIVE;
      r.snapshot_hash = "sha256:" + sha256(readFileSync(join(d, LIVE)));
    }), /audit_artifact must name a file under snapshots\//],
];

// Negative controls that assume a supersession is already in place (the
// committed legacy pair superseded by a shared-row generation) — each
// mutates goodSupersededLedger() one way and must fail for its own reason.
const SUPERSESSION_CONTROLS = [
  ["pointer to an absent row", (d) => {
    const map = readPointer(d);
    map[LIVE] = `${GEN}/nope.json`;
    writePointer(d, map);
    rebind(d);
  }, /which is not a row/],
  ["pointer deleted while successors exist", (d) => {
    unlinkSync(join(d, "supersession.json"));
    rebind(d);
  }, /non-superseded rows span|second (live|twin) cell/],
  ["superseded row inside the current generation", (d) => {
    const live3 = liveRel(GEN, "20260914T000002Z");
    writeRow(d, live3, sharedRow("live", { ran_at: "2026-09-14T00:00:02Z" }));
    writePointer(d, { [LIVE]: live3, [LIVE2]: live3, [TWIN]: TWIN2 });
    rebind(d);
  }, /is superseded but sits in the current generation/],
  ["successor of a different cell", (d) => {
    writePointer(d, { [LIVE]: TWIN2, [TWIN]: LIVE2 });
    rebind(d);
  }, /not the same surface\/lane\/cell/],
  ["legacy key inside a shared-row generation", (d) => {
    editRow(d, LIVE2, (r) => { r.parallax_sha = "0".repeat(40); });
  }, /legacy key parallax_sha/],

  // --- shared-row generations hold rows of the closed v1 property set -------
  ["unknown top-level key in a shared row", (d) =>
    editRow(d, LIVE2, (r) => { r.extra_field = 1; }), /unknown top-level key "extra_field"/],
  ["case-variant legacy key in a shared row", (d) =>
    editRow(d, LIVE2, (r) => { r.PARALLAX_SHA = "0".repeat(40); }), /unknown top-level key "PARALLAX_SHA"/],
  // The wrong id is derived from the one schema identifier literal above.
  ["wrong schema id in a shared row", (d) =>
    editRow(d, LIVE2, (r) => { r.schema = SHARED_SCHEMA.replace(/1$/, "2"); }), /schema "[^"]*\/2" is not /],
  ["non-40-hex gate_sha in a shared row", (d) =>
    editRow(d, LIVE2, (r) => { r.gate_sha = "zz"; }), /gate_sha must be a 40-hex commit sha/],
  ["gate_worktree outside clean or dirty in a shared row", (d) =>
    editRow(d, LIVE2, (r) => { r.gate_worktree = "unknown"; }), /gate_worktree must be clean\|dirty/],
  ["shared row missing schema", (d) =>
    editRow(d, LIVE2, (r) => { delete r.schema; }), /missing fields: schema/],
  ["shared row missing gate_sha", (d) =>
    editRow(d, LIVE2, (r) => { delete r.gate_sha; }), /missing fields: gate_sha/],
  ["shared row missing gate_worktree", (d) =>
    editRow(d, LIVE2, (r) => { delete r.gate_worktree; }), /missing fields: gate_worktree/],
  ["stray unevaluable_reason on a GREEN shared row", (d) =>
    editRow(d, LIVE2, (r) => { r.unevaluable_reason = "stray"; }),
    /unevaluable_reason present but result is not UNEVALUABLE/],
  ["UNEVALUABLE shared row without a reason", (d) =>
    editRow(d, LIVE2, (r) => {
      r.result = "UNEVALUABLE";
      r.evaluated = { ...ZERO_CHECKS };
      r.checks = { ...ZERO_CHECKS };
      r.rows = 0;
    }), /UNEVALUABLE row missing unevaluable_reason/],
  ["shared twin without a mutation name", (d) =>
    editRow(d, TWIN2, (r) => { delete r.planted.mutation; }),
    /planted\.mutation must be a non-empty string/],
  ["planted.mutation outside [a-z0-9_]+", (d) =>
    editRow(d, TWIN2, (r) => { r.planted.mutation = "plant-future-accepted"; }),
    /planted\.mutation "plant-future-accepted" must match \[a-z0-9_\]\+/],
  ["planted.mutated_rows missing", (d) =>
    editRow(d, TWIN2, (r) => { delete r.planted.mutated_rows; }),
    /planted\.mutated_rows must be a non-negative integer/],
  ["surface outside the shared row pattern", (d) =>
    editRow(d, LIVE2, (r) => { r.surface = "Vantage-gold-local-parquet"; }),
    /surface must match \[a-z0-9\]\[a-z0-9-\]\*/],

  // --- shared-row row rules, the same ones the conformance pack applies ------
  ["shared live with empty checks", (d) =>
    editRow(d, LIVE2, (r) => { r.checks = {}; r.evaluated = {}; }),
    /-live-20260914T000000Z\.json: checks must have at least one check/],
  // Vacuous CLAIMABLE: with no check keys there is nothing to credit, so
  // check-by-check crediting would pass trivially. Both halves are refused.
  ["vacuous CLAIMABLE, live GREEN with checks {} (live half)", (d) => {
    editRow(d, LIVE2, (r) => { r.checks = {}; r.evaluated = { no_future_accepted: r.rows }; });
    editRow(d, TWIN2, (r) => { r.checks = {}; r.planted.expected_violations = {}; });
  }, /-live-20260914T000000Z\.json: checks must have at least one check/],
  ["vacuous CLAIMABLE, twin RED with checks {} and an empty plant (twin half)", (d) => {
    editRow(d, LIVE2, (r) => { r.checks = {}; r.evaluated = { no_future_accepted: r.rows }; });
    editRow(d, TWIN2, (r) => { r.checks = {}; r.planted.expected_violations = {}; });
  }, /-twin-plant_future_accepted-20260914T000001Z\.json: checks must have at least one check/],
  ["evaluated keys differ from checks keys", (d) =>
    editRow(d, LIVE2, (r) => { delete r.evaluated.restatement_visibility; }),
    /evaluated keys must equal checks keys/],
  ["live GREEN with violations", (d) =>
    editRow(d, LIVE2, (r) => { r.checks = { no_future_accepted: 7, as_of_monotonicity: 7, restatement_visibility: 7 }; }),
    /live with violations must be RED/],
  ["twin RED with no violations", (d) =>
    editRow(d, TWIN2, (r) => { r.checks = { ...ZERO_CHECKS }; r.planted.expected_violations = { ...ZERO_CHECKS }; }),
    /twin with no violations must not be RED/],
  ["twin plants an empty set", (d) =>
    editRow(d, TWIN2, (r) => { r.planted.expected_violations = {}; }),
    /planted\.expected_violations plants an empty set/],
  ["twin plant expecting zero violations on every check", (d) =>
    editRow(d, TWIN2, (r) => ({ ...r, ...UNEVALUABLE_FIELDS, planted: { ...r.planted, expected_violations: { ...ZERO_CHECKS } } })),
    /planted\.expected_violations plants an empty set/],
  ["unknown key inside planted", (d) =>
    editRow(d, TWIN2, (r) => { r.planted.note = "x"; }), /planted: unknown key "note"/],
  ["negative violation count", (d) =>
    editRow(d, LIVE2, (r) => { r.checks.no_future_accepted = -1; }),
    /checks\.no_future_accepted must be a non-negative integer/],
  ["fractional evaluated count", (d) =>
    editRow(d, LIVE2, (r) => { r.evaluated.as_of_monotonicity = 1.5; }),
    /evaluated\.as_of_monotonicity must be a non-negative integer/],
  ["whole-word status literal inside a string", (d) =>
    editRow(d, LIVE2, (r) => { r.scope = "lane is PARTIAL today"; }), /authored status literal/],
  ["status literal as an object key", (d) =>
    editRow(d, LIVE2, (r) => { r.params.CLAIMABLE = 1; }), /authored status literal/],
  ["content_hash without its prefix", (d) =>
    editRow(d, LIVE2, (r) => { r.content_hash = "a".repeat(64); }), /content_hash must be sha256:<64 hex>/],
  ["params not an object", (d) =>
    editRow(d, LIVE2, (r) => { r.params = "x"; }), /params must be a JSON object/],
  ["scope not a string", (d) =>
    editRow(d, LIVE2, (r) => { r.scope = 3; }), /scope must be a string/],
  ["rows not a non-negative integer", (d) =>
    editRow(d, LIVE2, (r) => { r.rows = -1; r.evaluated.no_future_accepted = -1; }),
    /rows must be a non-negative integer/],
  ["metrics not an object", (d) =>
    editRow(d, LIVE2, (r) => { r.metrics = 3; }), /metrics must be a JSON object/],

  // --- the rows binding cannot be bypassed by a null or non-object field -----
  ["shared live with evaluated null", (d) =>
    editRow(d, LIVE2, (r) => { r.evaluated = null; }), /evaluated must be a JSON object/],
  ["shared live with evaluated null names the unbound rows", (d) =>
    editRow(d, LIVE2, (r) => { r.evaluated = null; }), /rows cannot be bound: evaluated is not a JSON object/],
  ["shared live with checks null", (d) =>
    editRow(d, LIVE2, (r) => { r.checks = null; }), /checks must be a JSON object/],
  ["shared live with evaluated an array", (d) =>
    editRow(d, LIVE2, (r) => { r.evaluated = []; }), /evaluated must be a JSON object/],
  ["shared twin with planted null", (d) =>
    editRow(d, TWIN2, (r) => { r.planted = null; }), /twin verdict must carry planted/],
  ["shared live with planted null", (d) =>
    editRow(d, LIVE2, (r) => { r.planted = null; }), /live verdict must not carry/],

  // --- a row file is unambiguous JSON ----------------------------------------
  // JSON.parse keeps the last of two equal keys and says nothing, so a row
  // could carry "result": "RED" and "result": "GREEN" and read as GREEN.
  ["duplicate top-level key in a shared row", (d) => {
    const text = readFileSync(join(d, LIVE2), "utf8");
    writeFileSync(join(d, LIVE2), replaceOnce(text, '"result": "GREEN"', '"result": "RED",\n  "result": "GREEN"'));
    rebind(d);
  }, /duplicate key "result"/],
  ["duplicate nested key in a shared row", (d) => {
    const text = readFileSync(join(d, LIVE2), "utf8");
    writeFileSync(join(d, LIVE2), replaceOnce(text, '"as_of_monotonicity": 0', '"as_of_monotonicity": 5,\n    "as_of_monotonicity": 0'));
    rebind(d);
  }, /duplicate key "as_of_monotonicity"/],
  ["duplicate key in the pointer file", (d) => {
    const text = readFileSync(join(d, "supersession.json"), "utf8");
    writeFileSync(join(d, "supersession.json"), replaceOnce(text, '"superseded": {', '"superseded": {},\n  "superseded": {'));
    rebind(d);
  }, /supersession\.json: duplicate key "superseded"/],

  // --- shared-row file names carry the twin's mutation ------------------------
  ["shared twin filename without a mutation segment", (d) =>
    moveRow(d, TWIN2, `${GEN}/${SURFACE}-lane1-twin-20260914T000001Z.json`),
    /filename not <surface>-lane<lane>-live-<stamp>\.json or <surface>-lane<lane>-twin-<mutation>-<stamp>\.json/],
  ["shared twin filename mutation disagrees with planted.mutation", (d) =>
    moveRow(d, TWIN2, twinRel(GEN, "plant_other", "20260914T000001Z")),
    /filename mutation "plant_other" disagrees with planted\.mutation "plant_future_accepted"/],
  ["shared live filename carrying a mutation segment", (d) =>
    moveRow(d, LIVE2, `${GEN}/${SURFACE}-lane1-live-plant_x-20260914T000000Z.json`),
    /lane1-live-plant_x-20260914T000000Z\.json: filename not/],

  // --- a successor replaces the same twin --------------------------------------
  ["successor twin carries a different planted.mutation", (d) => {
    writeRow(d, TWIN2B, monoTwin());
    writePointer(d, { [LIVE]: LIVE2, [TWIN]: TWIN2B });
    rebind(d);
  }, /carries planted\.mutation "plant_future_accepted" but its successor .* carries "plant_monotonicity_regression"/],
  ["successor twin mutation differs only by case", (d) =>
    editRow(d, TWIN2, (r) => { r.planted.mutation = "Plant_Future_Accepted"; }),
    /supersession\.json: .* differ only by case or whitespace/],

  // --- needs-a-human refusals in the current shared-row generation -----------
  ["GREEN twin in the current shared generation", (d) =>
    editRow(d, TWIN2, (r) => { r.result = "GREEN"; r.checks = { ...ZERO_CHECKS }; }),
    /twin GREEN needs a human/],
  ["live RED in the current shared generation", (d) =>
    editRow(d, LIVE2, (r) => { r.result = "RED"; r.checks = { ...FUTURE_CHECKS }; }),
    /live RED needs a human/],
  ["twin RED for the wrong reason in the current shared generation", (d) =>
    editRow(d, TWIN2, (r) => { r.checks.no_future_accepted = 2; }),
    /twin RED does not match the plant/],
  // A planted check the gate computed but the plant does not list is a
  // mismatch, not an implied zero.
  ["twin plant omitting a check the gate computed, in the current shared generation", (d) =>
    editRow(d, TWIN2, (r) => { delete r.planted.expected_violations.as_of_monotonicity; }),
    /twin RED does not match the plant/],
  // The refusals run before the UNEVALUABLE return.
  ["unevaluable live beside a GREEN twin in the current shared generation", (d) => {
    editRow(d, LIVE2, (r) => ({ ...r, ...UNEVALUABLE_FIELDS }));
    editRow(d, TWIN2, (r) => { r.result = "GREEN"; r.checks = { ...ZERO_CHECKS }; });
  }, /twin GREEN needs a human/],
  ["unevaluable twin beside a live RED in the current shared generation", (d) => {
    editRow(d, LIVE2, (r) => { r.result = "RED"; r.checks = { ...FUTURE_CHECKS }; });
    editRow(d, TWIN2, (r) => ({ ...r, ...UNEVALUABLE_FIELDS }));
  }, /live RED needs a human/],

  // --- ran_at ordering is parsed, never compared as strings -----------------
  // String order says .9Z is later than .951466Z ('Z' sorts after '5'); the
  // instants say the successor is older. (Expectation change: this control
  // used to rewrite the legacy row's ran_at too; generation zero is frozen,
  // so the successor is moved to just before the committed row instead.)
  ["successor older than the row it replaces (fraction precision)", (d) =>
    editRow(d, LIVE2, (r) => { r.ran_at = "2026-09-01T17:48:48.9Z"; }),
    /successor .* does not postdate/],
  ["successor ran_at with a timezone offset", (d) =>
    editRow(d, LIVE2, (r) => { r.ran_at = "2026-09-14T00:00:00+05:00"; }),
    /ran_at "2026-09-14T00:00:00\+05:00" is not a strict ISO-8601 UTC instant/],
  ["malformed ran_at stamp", (d) =>
    editRow(d, LIVE2, (r) => { r.ran_at = "9"; }),
    /ran_at "9" is not a strict ISO-8601 UTC instant/],
  // Coverage pin: a cycle also breaks the ordering rules above, so this
  // control asserts the cycle is named in its own words, not just refused.
  ["cycle through the pointer graph", (d) => {
    writePointer(d, { [LIVE]: LIVE2, [LIVE2]: LIVE, [TWIN]: TWIN2 });
    rebind(d);
  }, /cycle through/],
  ["successor in an earlier generation", (d) => {
    mkdirSync(join(d, GEN_A), { recursive: true });
    writeRow(d, LIVE_A, sharedRow("live", { ran_at: "2026-09-20T00:00:00Z" }));
    writePointer(d, { [LIVE]: LIVE2, [TWIN]: TWIN2, [LIVE2]: LIVE_A });
    rebind(d);
  }, /is not in a later generation than/],

  // --- the pointer file's own shape -----------------------------------------
  ["null pointer file", (d) => {
    writeFileSync(join(d, "supersession.json"), "null\n");
    rebind(d);
  }, /supersession\.json: must be a JSON object/],
  ["pointer file with an unknown key", (d) => {
    writeFileSync(join(d, "supersession.json"),
      JSON.stringify({ superseded: readPointer(d), note: "x" }, null, 2) + "\n");
    rebind(d);
  }, /supersession\.json: unknown key "note"/],
  ["pointer value that is not a row path", (d) => {
    const map = readPointer(d);
    map[LIVE] = 7;
    writePointer(d, map);
    rebind(d);
  }, /supersession\.json: .* must map a row path to a row path/],

  // --- generation directories -----------------------------------------------
  ["generation directory name not a UTC stamp", () => {}, /runs\/not-a-stamp: generation directory name is not a UTC stamp/,
    () => goodSupersededLedger("runs/not-a-stamp")],
  ["generation stamps disagree with ran_at order", (d) => {
    const gen = "runs/20260910T000000Z";
    const l3 = liveRel(gen, "20260920T000000Z");
    const t3 = twinRel(gen, FUTURE, "20260920T000001Z");
    mkdirSync(join(d, gen), { recursive: true });
    writeRow(d, l3, sharedRow("live", { ran_at: "2026-09-20T00:00:00Z" }));
    writeRow(d, t3, sharedRow("twin", { ran_at: "2026-09-20T00:00:01Z" }));
    writePointer(d, { [LIVE]: LIVE2, [TWIN]: TWIN2, [LIVE2]: l3, [TWIN2]: t3 });
    rebind(d);
  }, /generation stamps and ran_at disagree/],
  ["generation stamp later than its earliest row", () => {},
    /runs\/20260914T000000\.5Z: generation stamp is later than its earliest row/,
    () => goodSupersededLedger("runs/20260914T000000.5Z")],
  ["generation stamp not after the earlier generation's rows", () => {},
    /runs\/19990101T000000Z: generation stamp does not postdate/,
    () => goodSupersededLedger("runs/19990101T000000Z")],
  ["empty generation directory", (d) => {
    mkdirSync(join(d, "runs", "20260915T000000Z"));
  }, /runs\/20260915T000000Z: generation directory holds no rows/],
  ["two generation directories naming the same instant", (d) => {
    mkdirSync(join(d, "runs", "20260914T000000.000Z"));
  }, /name the same instant/],
];

// Multi-twin cells and the structural cell rules of retired generations,
// each on its own base. Structural rules hold in every generation; the
// needs-a-human refusals do not (see the history positives below).
const GENERATION_CONTROLS = [
  ["duplicate twin mutation in the current shared generation", (d) =>
    editRow(d, TWIN2B, (r) => {
      r.checks = { ...FUTURE_CHECKS };
      r.planted = { mutation: FUTURE, mutated_rows: 1, expected_violations: { ...FUTURE_CHECKS } };
    }), /duplicate twin mutation "plant_future_accepted"/, multiTwinLedger],
  ["twin mutations differing only by case in one generation", (d) =>
    editRow(d, TWIN2B, (r) => {
      r.checks = { ...FUTURE_CHECKS };
      r.planted = { mutation: "Plant_Future_Accepted", mutated_rows: 1, expected_violations: { ...FUTURE_CHECKS } };
    }), /twin mutations "Plant_Future_Accepted" and "plant_future_accepted" differ only by case or whitespace/, multiTwinLedger],
  ["twin mutations equal after trimming count as duplicates", (d) =>
    editRow(d, TWIN2B, (r) => {
      r.checks = { ...FUTURE_CHECKS };
      r.planted = { mutation: " plant_future_accepted ", mutated_rows: 1, expected_violations: { ...FUTURE_CHECKS } };
    }), /duplicate twin mutation " plant_future_accepted "/, multiTwinLedger],
  ["superseded legacy generation with a second twin stays refused", (d) => {
    const rel = `verdicts/${SURFACE}-lane1-twin-20260901T174850Z.json`;
    writeRow(d, rel, verdictRow("twin", { ran_at: "2026-09-01T17:48:50Z" }));
    writePointer(d, { ...readPointer(d), [rel]: TWIN2 });
    rebind(d);
  }, /second twin cell/, multiTwinLedger],
  ["superseded shared generation with a duplicate twin mutation stays refused", () => {},
    /duplicate twin mutation/,
    () => twoGenerationLedger({ extra: [{
      rel: twinRel(GEN_A, FUTURE, "20260910T000002Z"),
      row: sharedRow("twin", { ran_at: "2026-09-10T00:00:02Z" }),
      successor: TWIN2,
    }] })],
  ["superseded shared generation with a second live stays refused", () => {},
    /second live cell/,
    () => twoGenerationLedger({ extra: [{
      rel: liveRel(GEN_A, "20260910T000002Z"),
      row: sharedRow("live", { ran_at: "2026-09-10T00:00:02Z" }),
      successor: LIVE2,
    }] })],

  // Row validity holds for superseded rows too: one control per shared-row
  // row rule, each on a row of the retired generation, each refused by that
  // row's name. Skipping validateVerdict for superseded rows must fail these.
  ["superseded shared generation with a twin RED over zero checks stays refused", () => {},
    rowReason(TWIN_A, /twin with no violations must not be RED/),
    () => twoGenerationLedger({ retiredTwin: { checks: { ...ZERO_CHECKS } } })],
  ["superseded shared generation with a live GREEN carrying violations stays refused", () => {},
    rowReason(LIVE_A, /live with violations must be RED/),
    () => twoGenerationLedger({ retiredLive: { checks: { ...FUTURE_CHECKS } } })],
  ["superseded shared generation with rows not equal to evaluated stays refused", () => {},
    rowReason(LIVE_A, /rows must equal evaluated\.no_future_accepted/),
    () => twoGenerationLedger({ retiredLive: { rows: 7 } })],
  ["superseded shared generation with an UNEVALUABLE row without a reason stays refused", () => {},
    rowReason(LIVE_A, /UNEVALUABLE row missing unevaluable_reason/),
    () => twoGenerationLedger({ retiredLive: { result: "UNEVALUABLE", evaluated: { ...ZERO_CHECKS }, checks: { ...ZERO_CHECKS }, rows: 0 } })],

  // Every file stays bound, superseded or not: SOURCE.md must bind a
  // superseded row, and at its current bytes.
  ["superseded row missing from SOURCE.md stays refused", (d) => {
    const lines = readFileSync(join(d, "SOURCE.md"), "utf8").split("\n");
    const kept = lines.filter((l) => !l.endsWith(`  ${LIVE_A}`));
    if (kept.length !== lines.length - 1) throw new Error(`fixture SOURCE.md does not bind ${LIVE_A} exactly once`);
    writeFileSync(join(d, "SOURCE.md"), kept.join("\n"));
  }, rowReason(LIVE_A, /present but not bound in SOURCE\.md/), () => twoGenerationLedger()],
  ["superseded row whose bytes drift from its SOURCE.md hash stays refused", (d) => {
    const row = JSON.parse(readFileSync(join(d, LIVE_A), "utf8"));
    row.scope = "edited after publication";
    writeRow(d, LIVE_A, row); // deliberately NOT rebound
  }, rowReason(LIVE_A, /sha256 does not match SOURCE\.md binding/), () => twoGenerationLedger()],
];

// --- positive controls ------------------------------------------------------

check("positive", "good fixture passes", () => gatePasses(track(goodLedger())));

// The freeze is pinned to exactly the committed rows: the repository's own
// ledger passes the gate.
check("positive", "the committed ledger passes the gate", () => gatePasses(REPO_LEDGER));

// A lone live cell is PARTIAL, not a failure (§5). Expectation change: this
// used to delete the legacy twin; generation zero is frozen, so the lone live
// is a lane-2 live in the current shared generation.
check("positive", "lone live cell in the current shared generation passes (renders PARTIAL)", () => {
  const dir = track(goodSupersededLedger());
  writeRow(dir, liveRel(GEN, "20260914T000003Z", 2), sharedRow("live", { lane: 2, ran_at: "2026-09-14T00:00:03Z" }));
  rebind(dir);
  const problems = gatePasses(dir);
  if (problems.length) return problems;
  const c = creditOf(currentCells(dir, `${SURFACE}:lane2`));
  return c.status === "PARTIAL" ? [] : [`expected PARTIAL, got ${JSON.stringify(c)}`];
});

// An UNEVALUABLE cell with a vacuous domain is a valid row. Expectation
// change: moved from the frozen legacy generation to a lane-2 live in the
// current shared generation.
check("positive", "unevaluable cell in the current shared generation passes (renders UNEVALUABLE)", () => {
  const dir = track(goodSupersededLedger());
  writeRow(dir, liveRel(GEN, "20260914T000003Z", 2),
    sharedRow("live", { lane: 2, ran_at: "2026-09-14T00:00:03Z", ...UNEVALUABLE_FIELDS }));
  rebind(dir);
  const problems = gatePasses(dir);
  if (problems.length) return problems;
  const c = creditOf(currentCells(dir, `${SURFACE}:lane2`));
  return c.status === "UNEVALUABLE" ? [] : [`expected UNEVALUABLE, got ${JSON.stringify(c)}`];
});

// Regression pin, 2026-08-31 CI incident: a checkout that re-encodes a bound
// file's line endings to CRLF must still pass — the pins (SOURCE.md and the
// legacy freeze alike) are over LF-normalized bytes.
check("positive", "CRLF re-encoded file still passes (LF-normalized hashing)", () => {
  const dir = track(goodLedger());
  const crlf = readFileSync(join(dir, LIVE), "utf8").replaceAll("\n", "\r\n");
  writeFileSync(join(dir, LIVE), crlf); // deliberately NOT rebound
  return gatePasses(dir);
});

// A present-but-empty supersession pointer, hash-bound in SOURCE.md like any
// other ledger file, changes nothing (S2).
check("positive", "zero superseded, pointer bound and empty, still passes", () => {
  const dir = track(goodLedger());
  writePointer(dir, {});
  rebind(dir);
  return gatePasses(dir);
});

// currentGeneration() derives "verdicts" when runs/ does not exist at all —
// the legacy directory is generation zero.
check("positive", "current-generation derives 'verdicts' with no runs/ present", () => {
  const gen = currentGeneration(loadLedger(track(goodLedger())));
  return gen === "verdicts" ? [] : [`expected 'verdicts', got ${JSON.stringify(gen)}`];
});

// check-ledger.mjs --current-generation prints the same thing over the CLI,
// end to end (not just the underlying function).
check("positive", "check-ledger --current-generation CLI prints the derived directory", () => {
  const dir = track(goodLedger());
  const r = runNode([CHECK_LEDGER_CLI, dir, "--current-generation"]);
  return r.code === 0 && r.out.trim() === "verdicts"
    ? [] : [`expected exit 0 'verdicts', got exit ${r.code} ${JSON.stringify(r.out.trim())} ${r.err}`];
});

// The frozen legacy generation keeps its published derivation: live GREEN
// and twin RED as planted derive CLAIMABLE, with no check-by-check crediting
// (the committed twin never moves as_of_monotonicity).
check("positive", "legacy generation keeps its published derivation (CLAIMABLE, no per-check crediting)", () => {
  const dir = track(goodLedger());
  const problems = gatePasses(dir);
  const c = creditOf(currentCells(dir));
  if (c.status !== "CLAIMABLE" || !sameList(c.unfalsified, [])) {
    problems.push(`expected CLAIMABLE with no unfalsified checks, got ${JSON.stringify(c)}`);
  }
  return problems;
});

// Expectation change (check-by-check crediting): this control previously
// required the lane to stay CLAIMABLE after a single-twin shared-row
// generation replaced the legacy pair. Under check-by-check crediting that
// generation's one twin never sets as_of_monotonicity nonzero, so it now
// derives PARTIAL and names the check; the history-table and URL assertions
// are unchanged. The CLAIMABLE-after-swap path is held by the two-twin
// control below.
check("positive", "generation swap: one history table, both legacy URLs linked, single-twin shared generation derives PARTIAL naming the unfalsified check", () => {
  const dir = track(goodSupersededLedger());
  const problems = gatePasses(dir);
  if (problems.length) return problems;
  const c = creditOf(currentCells(dir));
  if (c.status !== "PARTIAL" || !sameList(c.unfalsified, ["as_of_monotonicity"])) {
    problems.push(`expected PARTIAL unfalsified [as_of_monotonicity], got ${JSON.stringify(c)}`);
  }
  const b = buildIn(dir);
  if (b.code !== 0) return [...problems, `build.mjs exit ${b.code}: ${b.err}`];
  const hist = historyOf(b.html);
  const board = statusBoardOf(b.html);
  const histTables = (b.html.match(/superseded, history only/g) ?? []).length;
  if (histTables !== 1) problems.push(`history tables=${histTables}`);
  if (!hist.includes(`ledger/${LIVE}`) || !hist.includes(`ledger/${TWIN}`)) problems.push("legacy row URLs not linked from the history table");
  if (!/pill partial">PARTIAL/.test(board)) problems.push("status board does not render lane 1 PARTIAL");
  if (/pill claimable">CLAIMABLE/.test(board)) problems.push("status board still renders CLAIMABLE");
  if (!board.includes("<code>as_of_monotonicity</code>")) problems.push("status board does not name the unfalsified check");
  return problems;
});

// The plant may list its checks in a different key order than the gate's
// checks; the page still reads an exact match.
check("positive", "a plant listed in a different key order than its checks renders as an exact match", () => {
  const dir = track(goodSupersededLedger());
  editRow(dir, TWIN2, (r) => {
    r.planted.expected_violations = Object.fromEntries(Object.entries(r.planted.expected_violations).reverse());
  });
  const problems = gatePasses(dir);
  if (problems.length) return problems;
  const b = buildIn(dir);
  if (b.code !== 0) return [`build.mjs exit ${b.code}: ${b.err}`];
  if (b.html.includes("NOT an exact match")) problems.push("the plant sentence renders NOT an exact match");
  if (!b.html.includes("an exact match, which is the only thing that credits")) problems.push("the plant sentence does not render the exact match");
  return problems;
});

// A cell may hold several twins with distinct mutations; together they
// falsify every live check, so the lane derives CLAIMABLE and the page
// renders every twin in every place a twin appears: the figure, the checks
// table, the plant sentences, the run anatomy, card 02 and card 03.
check("positive", "two twins with distinct mutations in a shared generation derive CLAIMABLE and every twin renders everywhere", () => {
  const dir = track(multiTwinLedger());
  const problems = gatePasses(dir);
  if (problems.length) return problems;
  const c = creditOf(currentCells(dir));
  if (c.status !== "CLAIMABLE" || !sameList(c.unfalsified, [])) {
    problems.push(`expected CLAIMABLE with no unfalsified checks, got ${JSON.stringify(c)}`);
  }
  const b = buildIn(dir);
  if (b.code !== 0) return [...problems, `build.mjs exit ${b.code}: ${b.err}`];
  const html = b.html;
  const liveTable = liveTableOf(html);
  if (!/pill claimable">CLAIMABLE/.test(statusBoardOf(html))) problems.push("status board does not render CLAIMABLE");
  if (!liveTable.includes(`ledger/${TWIN2}`) || !liveTable.includes(`ledger/${TWIN2B}`)) problems.push("both twin rows are not linked from the verdict table");
  const places = {
    figure: between(html, '<figure class="optic', "</figure>"),
    "plant sentences": between(html, "The plants, one per twin", "Each red credits only"),
    "run anatomy header": between(html, "the run, field by field", "</thead>"),
    "card 02": between(html, 'fl-name">flexing baseline', "</article>"),
  };
  for (const [place, text] of Object.entries(places)) {
    if (!text) { problems.push(`${place}: section not rendered`); continue; }
    for (const m of [FUTURE, MONO]) if (!text.includes(m)) problems.push(`${place}: mutation ${m} not rendered`);
  }
  const anatomyTwinCols = (places["run anatomy header"].match(/<th>twin · /g) ?? []).length;
  if (anatomyTwinCols !== 2) problems.push(`run anatomy twin columns=${anatomyTwinCols}, expected 2`);
  const twinCols = (html.match(/Twin violations \(expected\)/g) ?? []).length;
  if (twinCols !== 2) problems.push(`checks table twin columns=${twinCols}, expected 2`);
  if (!between(html, 'fl-name">stored viewpoint', "</article>").includes("2 twins red")) problems.push("card 03 does not count both twins");
  const hist = historyOf(html);
  if (!hist.includes(`ledger/${LIVE}`) || !hist.includes(`ledger/${TWIN}`)) problems.push("legacy row URLs not linked from the history table");
  return problems;
});

// A GREEN live whose group has an UNEVALUABLE row derives UNEVALUABLE, and
// per-check crediting does not apply to it.
check("positive", "unevaluable live in a shared generation derives UNEVALUABLE with no per-check crediting", () => {
  const dir = track(multiTwinLedger());
  editRow(dir, LIVE2, (r) => ({ ...r, ...UNEVALUABLE_FIELDS }));
  const problems = gatePasses(dir);
  if (problems.length) return problems;
  const c = creditOf(currentCells(dir));
  return c.status === "UNEVALUABLE" && sameList(c.unfalsified, [])
    ? [] : [`expected UNEVALUABLE with no unfalsified checks, got ${JSON.stringify(c)}`];
});

// A chain through a retired shared-row generation passes, and the current
// generation is the newest one.
check("positive", "chain through a retired shared generation passes", () => {
  const dir = track(twoGenerationLedger());
  const problems = gatePasses(dir);
  const r = runNode([CHECK_LEDGER_CLI, dir, "--current-generation"]);
  if (r.code !== 0 || r.out.trim() !== GEN) problems.push(`--current-generation: exit ${r.code} ${JSON.stringify(r.out.trim())} ${r.err}`);
  return problems;
});

// Each generation satisfies the cell rules on its own, but a needs-a-human
// result refuses the ledger only in the current generation. In a superseded
// generation the row stays as history: the page shows its result and links
// its successor, and the ledger is accepted. (Expectation change: each of
// these three was a negative control requiring the ledger to be refused.)
function historyPositive(retired, rel, successor, pill) {
  const dir = track(twoGenerationLedger(retired));
  const problems = gatePasses(dir);
  if (problems.length) return problems;
  const b = buildIn(dir);
  if (b.code !== 0) return [`build.mjs exit ${b.code}: ${b.err}`];
  const row = historyRowOf(b.html, rel);
  if (!row) return [`history does not render ${rel}`];
  if (!row.includes(pill)) problems.push(`history row for ${rel} does not render ${pill}`);
  if (!row.includes(`href="ledger/${successor}">successor`)) problems.push(`history row for ${rel} does not link its successor ${successor}`);
  return problems;
}
check("positive", "superseded shared generation with a live RED renders as history with its result and successor link", () =>
  historyPositive({ retiredLive: { result: "RED", checks: { ...FUTURE_CHECKS } } }, LIVE_A, LIVE2, 'pill red">RED'));
check("positive", "superseded shared generation with a GREEN twin renders as history with its result and successor link", () =>
  historyPositive({ retiredTwin: { result: "GREEN", checks: { ...ZERO_CHECKS } } }, TWIN_A, TWIN2, 'pill green">GREEN'));
check("positive", "superseded shared generation with a twin RED for the wrong reason renders as history with its result and successor link", () =>
  historyPositive({ retiredTwin: { checks: { no_future_accepted: 2, as_of_monotonicity: 0, restatement_visibility: 1 } } }, TWIN_A, TWIN2, 'pill red">RED'));

// A superseded row stays only as history: its provenance link is absent from
// the main gate-output table and present in the history table, and every
// current row the other way round. The retired generation holds a live RED,
// the row that must never sit beside the current results.
check("positive", "superseded rows render in the history table only, never in the main gate-output table", () => {
  const dir = track(twoGenerationLedger({ retiredLive: { result: "RED", checks: { ...FUTURE_CHECKS } } }));
  const problems = gatePasses(dir);
  if (problems.length) return problems;
  const b = buildIn(dir);
  if (b.code !== 0) return [`build.mjs exit ${b.code}: ${b.err}`];
  const main = liveTableOf(b.html);
  const hist = historyOf(b.html);
  if (!main) return ["the main gate-output table is not rendered"];
  if (!hist) return ["the history table is not rendered"];
  const link = (rel) => `href="ledger/${rel}">row`;
  for (const rel of [LIVE, TWIN, LIVE_A, TWIN_A]) {
    if (main.includes(link(rel))) problems.push(`superseded ${rel} is listed in the main gate-output table`);
    if (!hist.includes(link(rel))) problems.push(`superseded ${rel} is missing from the history table`);
  }
  for (const rel of [LIVE2, TWIN2, TWIN2B]) {
    if (!main.includes(link(rel))) problems.push(`current ${rel} is missing from the main gate-output table`);
    if (hist.includes(link(rel))) problems.push(`current ${rel} is listed in the history table`);
  }
  return problems;
});

// The legacy generation obeys the same split. Generation zero is frozen, so
// a needs-a-human row there can only be reached by changing it on purpose;
// these pin that the needs-a-human refusals do not fire once it is
// superseded, and that the freeze is the only thing that refuses.
// (Expectation change: the first was a negative control requiring the
// needs-a-human refusal; the other two built the page, which the freeze now
// forbids for a changed generation zero.)
check("positive", "superseded legacy generation with a live RED: only the legacy freeze refuses", () => {
  const dir = track(multiTwinLedger());
  editRow(dir, LIVE, (r) => { r.result = "RED"; r.checks.no_future_accepted = 3; });
  return onlyFreezeRefuses(dir);
});
check("positive", "superseded legacy lone RED live: only the legacy freeze refuses", () => {
  const dir = track(multiTwinLedger());
  unlinkSync(join(dir, TWIN));
  editRow(dir, LIVE, (r) => { r.result = "RED"; r.checks = { ...FUTURE_CHECKS }; });
  writePointer(dir, { [LIVE]: LIVE2 });
  rebind(dir);
  return onlyFreezeRefuses(dir);
});
check("positive", "superseded legacy lone GREEN twin: only the legacy freeze refuses", () => {
  const dir = track(multiTwinLedger());
  unlinkSync(join(dir, LIVE));
  editRow(dir, TWIN, (r) => { r.result = "GREEN"; r.checks = { ...ZERO_CHECKS }; });
  writePointer(dir, { [TWIN]: TWIN2 });
  rebind(dir);
  return onlyFreezeRefuses(dir);
});

// The derivation itself refuses a needs-a-human row before it returns
// UNEVALUABLE, in both dialects (build.mjs derives through the same code).
check("positive", "credit derivation refuses a needs-a-human row before it returns UNEVALUABLE, in both dialects", () => {
  const problems = [];
  const planted = { mutation: FUTURE, mutated_rows: 1, expected_violations: { ...FUTURE_CHECKS } };
  const cases = [
    [{ live: { cell: "live", result: "UNEVALUABLE", checks: { ...ZERO_CHECKS }, rel: "live-unevaluable" },
      twins: [{ cell: "twin", result: "GREEN", checks: { ...ZERO_CHECKS }, planted, rel: "twin-green" }] },
    /twin GREEN needs a human/],
    [{ live: { cell: "live", result: "RED", checks: { ...FUTURE_CHECKS }, rel: "live-red" },
      twins: [{ cell: "twin", result: "UNEVALUABLE", checks: { ...ZERO_CHECKS }, planted, rel: "twin-unevaluable" }] },
    /live RED needs a human/],
  ];
  for (const dialect of ["legacy", "shared"]) {
    for (const [cells, pattern] of cases) {
      try {
        const c = creditOf({ ...cells, dialect });
        problems.push(`${dialect}: derived ${JSON.stringify(c)} instead of refusing`);
      } catch (e) {
        if (!pattern.test(e.message)) problems.push(`${dialect}: refused for the wrong reason: ${e.message}`);
      }
    }
  }
  return problems;
});

// --- CLI checks ---------------------------------------------------------------

// A ledger whose non-superseded rows span two directories has no derivable
// current generation — exit 2, never a guess (S4).
check("cli", "current-generation is null / CLI exits 2 when live rows span two directories", () => {
  const dir = track(goodLedger());
  mkdirSync(join(dir, GEN), { recursive: true });
  writeRow(dir, liveRel(GEN, "20260914T000000Z", 2), sharedRow("live", { lane: 2, ran_at: "2026-09-14T00:00:00Z" }));
  writeRow(dir, twinRel(GEN, FUTURE, "20260914T000001Z", 2), sharedRow("twin", { lane: 2, ran_at: "2026-09-14T00:00:01Z" }));
  rebind(dir);
  const fnGen = currentGeneration(loadLedger(dir));
  const r = runNode([CHECK_LEDGER_CLI, dir, "--current-generation"]);
  return fnGen === null && r.code === 2 ? [] : [`expected null/exit 2, got fnGen=${JSON.stringify(fnGen)} exit=${r.code}: ${r.err}`];
});

check("cli", "--current-generation exits 2 when the gate refuses the ledger", () => {
  const dir = track(goodSupersededLedger());
  const map = readPointer(dir);
  map[LIVE] = `${GEN}/nope.json`;
  writePointer(dir, map);
  rebind(dir);
  const gate = runNode([CHECK_LEDGER_CLI, dir]);
  const r = runNode([CHECK_LEDGER_CLI, dir, "--current-generation"]);
  const problems = [];
  if (gate.code !== 1) problems.push(`plain gate expected exit 1, got ${gate.code}`);
  if (r.code !== 2) problems.push(`--current-generation expected exit 2, got ${r.code} ${JSON.stringify(r.out.trim())}`);
  return problems;
});

for (const [name, args] of [
  ["check-ledger refuses an unknown flag", (d) => [d, "--bogus"]],
  ["check-ledger refuses an extra positional", (d) => [d, d]],
  ["check-ledger --current-generation refuses an unknown flag", (d) => [d, "--current-generation", "--bogus"]],
]) {
  check("cli", name, () => {
    const dir = track(goodLedger());
    const r = runNode([CHECK_LEDGER_CLI, ...args(dir)]);
    return r.code === 2 ? [] : [`expected exit 2, got ${r.code} ${JSON.stringify(r.out.trim())}`];
  });
}

for (const [name, args] of [
  ["build.mjs refuses an unknown flag", ["--bogus"]],
  ["build.mjs refuses an extra positional", ["extra"]],
]) {
  check("cli", name, () => {
    const b = buildIn(track(goodLedger()), args);
    const problems = [];
    if (b.code !== 2) problems.push(`expected exit 2, got ${b.code}`);
    if (b.html !== null) problems.push("an index.html was written anyway");
    return problems;
  });
}

// --- negative controls --------------------------------------------------------

function runControls(list, makeBase) {
  for (const [name, mutate, pattern, base] of list) {
    counts.negative++;
    let dir = null;
    let errs;
    try {
      dir = (base ?? makeBase)();
      mutate(dir);
      errs = checkLedger(dir);
    } catch (e) {
      errs = null;
      failures++;
      console.error(`FAIL control "${name}" threw: ${e.message}`);
    }
    if (dir) rmSync(dir, { recursive: true, force: true });
    if (errs === null) continue;
    if (!errs.length) {
      failures++;
      console.error(`FAIL control "${name}" did not fail the check — the control is dead`);
    } else if (!errs.some((e) => pattern.test(e))) {
      failures++;
      console.error(
        `FAIL control "${name}" failed for the wrong reason:\n  ${errs.join("\n  ")}`);
    } else {
      console.log(`ok   control "${name}" fails as required`);
    }
  }
}

runControls(CONTROLS, goodLedger);
runControls(SUPERSESSION_CONTROLS, goodSupersededLedger);
runControls(GENERATION_CONTROLS, goodLedger);

if (failures) {
  console.error(`\ntest-ledger: ${failures} failure(s)`);
  process.exit(1);
}
console.log(
  `\ntest-ledger: ${counts.positive} positive + ${counts.negative} negative controls + ` +
  `${counts.cli} CLI checks, all held`,
);
