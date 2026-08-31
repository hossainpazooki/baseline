#!/usr/bin/env node
// Negative controls for check-ledger.mjs — one mutation per failure mode in
// the spec (§5/§6), each applied to a fresh copy of a known-good fixture
// ledger. A control that does NOT fail the check is itself a test failure,
// and each control must fail for its OWN reason (message pattern), not by
// tripping an unrelated leg.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { sha256 } from "./lib/ledger.mjs";
import { checkLedger } from "./check-ledger.mjs";

const LIVE = "verdicts/fixture-gold-lane1-live-20260101T000000Z.json";
const TWIN = "verdicts/fixture-gold-lane1-twin-20260101T000001Z.json";
const AUDIT = "audits/fixture-vendor-2026-01-01.json";
const SNAP = "snapshots/audit-fixture.json";

function verdictRow(cell, extra = {}) {
  return {
    kind: "GATE_VERDICT",
    surface: "fixture-gold",
    lane: 1,
    cell,
    result: cell === "twin" ? "RED" : "GREEN",
    checks: cell === "twin"
      ? { no_future_accepted: 1, as_of_monotonicity: 0, restatement_visibility: 1 }
      : { no_future_accepted: 0, as_of_monotonicity: 0, restatement_visibility: 0 },
    evaluated: { no_future_accepted: 8, as_of_monotonicity: 5, restatement_visibility: 8 },
    rows: 8,
    scope: "full surface",
    params: { d: "2024-06-01T00:00:00+00:00", d_earlier: "2023-12-01T00:00:00+00:00" },
    parallax_sha: "0".repeat(40),
    parallax_worktree: "clean",
    content_hash: "sha256:" + "a".repeat(64),
    content_hash_basis: "fixture",
    ran_at: cell === "twin" ? "2026-01-01T00:00:01Z" : "2026-01-01T00:00:00Z",
    runner: "local",
    ...(cell === "twin" ? {
      planted: {
        mutation: "plant_future_accepted",
        mutated_rows: 1,
        expected_violations: { no_future_accepted: 1, as_of_monotonicity: 0, restatement_visibility: 1 },
      },
    } : {}),
    ...extra,
  };
}

function rebind(dir) {
  const lines = [];
  for (const sub of ["verdicts", "audits", "snapshots"]) {
    const d = join(dir, sub);
    let files = [];
    try { files = readdirSync(d); } catch { /* pruned by a control */ }
    for (const f of files) {
      lines.push(`${sha256(readFileSync(join(d, f)))}  ${sub}/${f}`);
    }
  }
  writeFileSync(join(dir, "SOURCE.md"), `# fixture binding\n\n## sha256\n\n${lines.join("\n")}\n`);
}

function writeRow(dir, rel, row) {
  writeFileSync(join(dir, rel), JSON.stringify(row, null, 2) + "\n");
}

function goodLedger() {
  const dir = mkdtempSync(join(tmpdir(), "baseline-fixture-"));
  for (const sub of ["verdicts", "audits", "snapshots"]) mkdirSync(join(dir, sub));
  const snapBody = JSON.stringify({ vendor: "FIXTURE", findings: "none" }) + "\n";
  writeFileSync(join(dir, SNAP), snapBody);
  writeRow(dir, LIVE, verdictRow("live"));
  writeRow(dir, TWIN, verdictRow("twin"));
  writeRow(dir, AUDIT, {
    kind: "SURFACE_AUDIT",
    surface: "fixture-vendor",
    vendor_alias: "FIXTURE",
    docs_searched: 3,
    fetched_at: "2026-01-01T00:00:00+00:00",
    audit_artifact: "snapshots/audit-fixture.json",
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

// [name, mutate(dir), expected error pattern]
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
    const row = JSON.parse(readFileSync(join(d, LIVE), "utf8"));
    row.ran_at = "2026-01-02T00:00:00Z";
    writeRow(d, "verdicts/fixture-gold-lane1-live-20260102T000000Z.json", row);
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
];

let failures = 0;

// Positive control: the good fixture passes clean.
{
  const dir = goodLedger();
  const errs = checkLedger(dir);
  if (errs.length) {
    failures++;
    console.error(`FAIL good fixture should pass, got:\n  ${errs.join("\n  ")}`);
  } else {
    console.log("ok   good fixture passes");
  }
  rmSync(dir, { recursive: true, force: true });
}

// Positive control: a lone live cell is PARTIAL, not a failure (§5).
{
  const dir = goodLedger();
  unlinkSync(join(dir, TWIN));
  rebind(dir);
  const errs = checkLedger(dir);
  if (errs.length) {
    failures++;
    console.error(`FAIL lone live cell should pass (PARTIAL), got:\n  ${errs.join("\n  ")}`);
  } else {
    console.log("ok   lone live cell passes (renders PARTIAL)");
  }
  rmSync(dir, { recursive: true, force: true });
}

// Positive control: an UNEVALUABLE cell with a vacuous domain is a valid row.
{
  const dir = goodLedger();
  editRow(dir, LIVE, (r) => {
    r.result = "UNEVALUABLE";
    r.evaluated = { no_future_accepted: 0, as_of_monotonicity: 0, restatement_visibility: 0 };
    r.rows = 0;
    r.checks = { no_future_accepted: 0, as_of_monotonicity: 0, restatement_visibility: 0 };
  });
  const errs = checkLedger(dir);
  if (errs.length) {
    failures++;
    console.error(`FAIL unevaluable live cell should pass, got:\n  ${errs.join("\n  ")}`);
  } else {
    console.log("ok   unevaluable cell passes (renders UNEVALUABLE)");
  }
  rmSync(dir, { recursive: true, force: true });
}

for (const [name, mutate, pattern] of CONTROLS) {
  const dir = goodLedger();
  mutate(dir);
  const errs = checkLedger(dir);
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
  rmSync(dir, { recursive: true, force: true });
}

if (failures) {
  console.error(`\ntest-ledger: ${failures} failure(s)`);
  process.exit(1);
}
console.log(`\ntest-ledger: 3 positive + ${CONTROLS.length} negative controls, all held`);
