// Shared ledger semantics — the ONLY implementation of row validation and
// derived status. check-ledger.mjs (the CI gate) and build.mjs (the page
// generator) both import this, so a status can never be authored: it is
// recomputed from cells everywhere it appears.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export const GATE_RESULTS = ["GREEN", "RED", "UNEVALUABLE"];
export const AUDIT_RESULTS = [
  "NO_AS_OF_MODE",
  "NO_ACCEPTANCE_INSTANT",
  "AS_OF_MODE_PRESENT",
];
// Derived statuses (never authored). UNEVALUABLE is shared with the gate
// result enum; the literal scan below therefore bans only the other three.
export const DERIVED_ONLY_LITERALS = ["CLAIMABLE", "PARTIAL", "UNCLAIMED"];

const VERDICT_REQUIRED = [
  "kind", "surface", "lane", "cell", "result", "checks", "evaluated", "rows",
  "scope", "params", "parallax_sha", "parallax_worktree", "content_hash",
  "content_hash_basis", "ran_at", "runner",
];
const AUDIT_REQUIRED = [
  "kind", "surface", "vendor_alias", "docs_searched", "fetched_at",
  "audit_artifact", "snapshot_hash", "field_quoted", "controls", "results",
];

// Windows-safe, self-describing verdict filename:
// <surface>-lane<lane>-<cell>-<compact-utc-stamp>.json
const VERDICT_NAME = /^([a-z0-9][a-z0-9-]*)-lane([123])-(live|twin)-(\d{8}T\d{6}(?:\.\d+)?Z)\.json$/;

export function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

export function loadLedger(ledgerDir) {
  const load = (sub, kind) => {
    const dir = join(ledgerDir, sub);
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => {
      const rel = `${sub}/${f}`;
      let row;
      try {
        row = JSON.parse(readFileSync(join(dir, f), "utf8"));
      } catch (e) {
        throw new Error(`${rel}: malformed JSON (${e.message})`);
      }
      if (row.kind !== kind) {
        throw new Error(`${rel}: kind ${JSON.stringify(row.kind)} in ${sub}/`);
      }
      return { row, rel };
    });
  };
  return {
    verdicts: load("verdicts", "GATE_VERDICT"),
    audits: load("audits", "SURFACE_AUDIT"),
  };
}

function missing(row, required) {
  return required.filter((k) => !(k in row));
}

// A twin's red is credited only when it is exactly the plant: every check's
// actual violation count equals the declared expectation, no more, no fewer.
export function twinMatchesPlant(row) {
  const exp = row.planted?.expected_violations;
  if (!exp) return false;
  const names = new Set([...Object.keys(exp), ...Object.keys(row.checks)]);
  return [...names].every((n) => (exp[n] ?? 0) === (row.checks[n] ?? 0));
}

export function validateVerdict({ row, rel }) {
  const errs = [];
  const miss = missing(row, VERDICT_REQUIRED);
  if (miss.length) errs.push(`${rel}: missing fields: ${miss.join(", ")}`);
  if (!GATE_RESULTS.includes(row.result)) {
    errs.push(`${rel}: unknown result ${JSON.stringify(row.result)}`);
  }
  if (![1, 2, 3].includes(row.lane)) errs.push(`${rel}: lane must be 1|2|3`);
  if (!["live", "twin"].includes(row.cell)) errs.push(`${rel}: cell must be live|twin`);
  if (!["local", "ci"].includes(row.runner)) errs.push(`${rel}: runner must be local|ci`);

  const m = rel.split("/")[1].match(VERDICT_NAME);
  if (!m) {
    errs.push(`${rel}: filename not <surface>-lane<lane>-<cell>-<stamp>.json (windows-safe)`);
  } else if (m[1] !== row.surface || Number(m[2]) !== row.lane || m[3] !== row.cell) {
    errs.push(`${rel}: filename disagrees with row surface/lane/cell`);
  }

  if (row.cell === "twin") {
    if (!row.planted?.expected_violations) {
      errs.push(`${rel}: twin verdict must carry planted.expected_violations`);
    } else if (row.result === "RED" && !twinMatchesPlant(row)) {
      errs.push(
        `${rel}: twin RED does not match the plant ` +
        `(expected ${JSON.stringify(row.planted.expected_violations)}, ` +
        `got ${JSON.stringify(row.checks)}) — a red for the wrong reason credits nothing`,
      );
    }
  } else if (row.planted) {
    errs.push(`${rel}: live verdict must not carry a planted mutation`);
  }

  if (row.checks && row.evaluated && row.rows !== undefined) {
    if (row.rows !== row.evaluated.no_future_accepted) {
      errs.push(`${rel}: rows must equal evaluated.no_future_accepted`);
    }
  }
  if (row.evaluated && Object.values(row.evaluated).some((v) => v === 0) &&
      row.result !== "UNEVALUABLE") {
    errs.push(`${rel}: a check evaluated 0 rows but result is not UNEVALUABLE`);
  }
  return errs;
}

export function validateAudit({ row, rel }, ledgerDir) {
  const errs = [];
  const miss = missing(row, AUDIT_REQUIRED);
  if (miss.length) errs.push(`${rel}: missing fields: ${miss.join(", ")}`);
  const results = Array.isArray(row.results) ? row.results : [];
  if (!results.length) errs.push(`${rel}: results must be a non-empty list`);
  for (const r of results) {
    if (!AUDIT_RESULTS.includes(r)) errs.push(`${rel}: unknown result ${JSON.stringify(r)}`);
  }
  if (row.audit_artifact) {
    const p = join(ledgerDir, row.audit_artifact);
    if (!existsSync(p)) {
      errs.push(`${rel}: audit_artifact ${row.audit_artifact} not committed`);
    } else if (`sha256:${sha256(readFileSync(p))}` !== row.snapshot_hash) {
      errs.push(`${rel}: snapshot_hash does not match ${row.audit_artifact}`);
    }
  }
  for (const c of ["live_fire", "positive", "negative"]) {
    if (row.controls?.[c] !== true) {
      errs.push(`${rel}: control ${c} not held — ABSENT without controls is not evidence`);
    }
  }
  return errs;
}

// Derived status per surface x lane. Never read from a file.
export function deriveStatus(cells) {
  const { live, twin } = cells;
  if (!live && !twin) return "UNCLAIMED";
  if ((live && live.result === "UNEVALUABLE") || (twin && twin.result === "UNEVALUABLE")) {
    return "UNEVALUABLE";
  }
  if (live && twin) {
    if (live.result === "GREEN" && twin.result === "RED" && twinMatchesPlant(twin)) {
      return "CLAIMABLE";
    }
    // live RED or twin GREEN is outside v1 ledger semantics: a real surface
    // failing, or a mutation the gate missed. Neither may render quietly.
    throw new Error(
      `cell pattern live=${live.result}/twin=${twin.result} needs a human — refusing to derive`,
    );
  }
  return "PARTIAL";
}

export function groupCells(verdicts) {
  const groups = new Map();
  for (const { row, rel } of verdicts) {
    const key = `${row.surface}:lane${row.lane}`;
    if (!groups.has(key)) groups.set(key, {});
    const g = groups.get(key);
    if (g[row.cell]) {
      throw new Error(`${rel}: second ${row.cell} cell for ${key} (have ${g[row.cell].rel})`);
    }
    g[row.cell] = { ...row, rel };
  }
  return groups;
}

// The three authored-status literals may not appear as a value anywhere in a
// ledger row — status is derived at build time or it is a lie.
export function findStatusLiterals(value, path = "$") {
  if (typeof value === "string") {
    return DERIVED_ONLY_LITERALS.includes(value) ? [`${path} = ${value}`] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => findStatusLiterals(v, `${path}[${i}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => findStatusLiterals(v, `${path}.${k}`));
  }
  return [];
}

// SOURCE.md binds every ledger file to a sha256 recorded at copy time — the
// hand-copy seam is otherwise unverified. Lines: "<64 hex>  <relative path>".
export function parseSourceBindings(sourceMd) {
  const bindings = new Map();
  for (const line of sourceMd.split(/\r?\n/)) {
    const m = line.match(/^([0-9a-f]{64})\s{2}(\S.*)$/);
    if (m) bindings.set(m[2].trim(), m[1]);
  }
  return bindings;
}
