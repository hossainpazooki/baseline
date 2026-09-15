// Shared ledger semantics — the ONLY implementation of row validation and
// derived status. check-ledger.mjs (the CI gate) and build.mjs (the page
// generator) both import this, so a status can never be authored: it is
// recomputed from cells everywhere it appears.
//
// Two row dialects live side by side, one per generation directory:
//   - legacy: ledger/verdicts/ (generation zero). Frozen: its file set and
//     every file's hash are fixed below (FROZEN_LEGACY), its row shape
//     (parallax_sha / parallax_worktree) and its one-twin-per-cell rule never
//     change, and it derives CLAIMABLE without check-by-check crediting.
//   - shared row: ledger/runs/<UTC stamp>/. The shared GATE_VERDICT row
//     schema v1 (closed property set; schema / gate_sha / gate_worktree), the
//     row rules the conformance pack applies to it, several twins per cell
//     with distinct mutations, and status credited check by check (see
//     creditShared).
//
// Every generation, current or superseded, must satisfy the structural rules
// on its own: valid rows, one live per cell, distinct twin mutations, the
// rows binding and bound files. The needs-a-human results (a live RED, a
// GREEN twin, a twin RED for the wrong reason) refuse the ledger only when
// the row sits in the current generation; in a superseded generation the
// row is history, rendered with its result and a link to its successor.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
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
// Any of them as a whole word, in any string of a row, keys included.
const STATUS_WORD = new RegExp(`\\b(?:${DERIVED_ONLY_LITERALS.join("|")})\\b`);

const VERDICT_REQUIRED = [
  "kind", "surface", "lane", "cell", "result", "checks", "evaluated", "rows",
  "scope", "params", "parallax_sha", "parallax_worktree", "content_hash",
  "content_hash_basis", "ran_at", "runner",
];

// The shared row schema, version 1: its identifier, and its closed set of
// top-level properties. This ledger also requires `rows` (optional in the
// shared schema), bound to evaluated.no_future_accepted below.
export const SHARED_SCHEMA_ID = "datum/gate-verdict/1";
const SHARED_PROPERTIES = new Set([
  "schema", "kind", "surface", "lane", "cell", "result", "unevaluable_reason",
  "checks", "evaluated", "planted", "scope", "params", "content_hash",
  "content_hash_basis", "gate_sha", "gate_worktree", "ran_at", "runner",
  "rows", "metrics",
]);
const PLANTED_PROPERTIES = new Set(["mutation", "mutated_rows", "expected_violations"]);
const LEGACY_IDENTITY_KEYS = ["parallax_sha", "parallax_worktree"];
const SHARED_REQUIRED = VERDICT_REQUIRED
  .filter((k) => !LEGACY_IDENTITY_KEYS.includes(k))
  .concat(["schema", "gate_sha", "gate_worktree"]);

// The pointer file's own name, exported so check-ledger.mjs and build.mjs
// never hand-type it twice.
export const SUPERSESSION = "supersession.json";
const AUDIT_REQUIRED = [
  "kind", "surface", "vendor_alias", "docs_searched", "fetched_at",
  "audit_artifact", "snapshot_hash", "field_quoted", "controls", "results",
];

// Generation zero, frozen: exactly these two files, each at this sha256
// (LF-normalized, the same hash SOURCE.md records). Rebinding SOURCE.md
// cannot add, change or remove a legacy row; new rows go into a generation
// directory under ledger/runs/.
export const FROZEN_LEGACY = new Map([
  ["verdicts/vantage-gold-local-parquet-lane1-live-20260901T174848.951466Z.json",
    "73069612316292b14319eb9730a1256c116d27107e842aca86068aeb91287bf7"],
  ["verdicts/vantage-gold-local-parquet-lane1-twin-20260901T174849.431640Z.json",
    "b41c436b8ed7d3c439874a2611bc0f2bb902402b243e57882decb7195379d6b2"],
]);

// Everything the ledger root may hold. Any other entry is refused, so a row
// cannot sit in a folder the loader never reads (ledger/verdicts-old/, or a
// case variant such as ledger/Verdicts/ on a case-sensitive runner).
// snapshots/ is not a rows directory: it may hold only files an audit row
// names as its audit_artifact, and never a verdict row (validateSnapshots).
const ROOT_DIRS = ["verdicts", "audits", "snapshots", "runs"];
const ROOT_FILES = ["SOURCE.md", SUPERSESSION];

// Windows-safe, self-describing verdict filenames (compact UTC stamp).
// Legacy: <surface>-lane<lane>-<cell>-<stamp>.json.
// Shared row: <surface>-lane<lane>-live-<stamp>.json and
// <surface>-lane<lane>-twin-<mutation>-<stamp>.json, the mutation segment
// equal to planted.mutation.
const LEGACY_NAME = /^([a-z0-9][a-z0-9-]*)-lane([123])-(live|twin)-(\d{8}T\d{6}(?:\.\d+)?Z)\.json$/;
const SHARED_NAME = /^([a-z0-9][a-z0-9-]*)-lane([123])-(?:(live)|(twin)-([a-z0-9_]+))-(\d{8}T\d{6}(?:\.\d+)?Z)\.json$/;
const MUTATION = /^[a-z0-9_]+$/;

// Hashes are over LF-normalized bytes — the ledger's files are text, its
// parsers are newline-insensitive, and git/autocrlf re-encodes line endings
// per platform. Hashing raw disk bytes made the gate stricter than its own
// parser and produced CI-only false positives (caught 2026-08-31); hash what
// the pipeline consumes, not the checkout's byte representation.
export function sha256(buf) {
  const canonical = Buffer.from(buf).toString("latin1").replaceAll("\r\n", "\n");
  return createHash("sha256").update(Buffer.from(canonical, "latin1")).digest("hex");
}

// --- instants -------------------------------------------------------------
// ran_at is a strict ISO-8601 UTC instant, YYYY-MM-DDTHH:MM:SS[.fraction]Z,
// on a real calendar date; a generation directory name is the same instant
// compacted (YYYYMMDDTHHMMSS[.fraction]Z). Instants are compared as parsed
// values, never as strings: string order puts "...48.9Z" after
// "...48.951466Z" because 'Z' sorts after '5'.
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/;
const COMPACT_INSTANT = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.(\d+))?Z$/;

function instantFrom(m) {
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  if (!days || d < 1 || d > days || h > 23 || mi > 59 || s > 59) return null;
  return { whole: m.slice(1, 7).join(""), frac: (m[7] ?? "").replace(/0+$/, "") };
}
export const parseInstant = (s) => (typeof s === "string" ? instantFrom(s.match(INSTANT)) : null);
export const parseStamp = (s) => (typeof s === "string" ? instantFrom(s.match(COMPACT_INSTANT)) : null);
export function compareInstants(a, b) {
  if (a.whole !== b.whole) return a.whole < b.whole ? -1 : 1;
  const len = Math.max(a.frac.length, b.frac.length);
  const fa = a.frac.padEnd(len, "0");
  const fb = b.frac.padEnd(len, "0");
  return fa === fb ? 0 : fa < fb ? -1 : 1;
}

// --- loading --------------------------------------------------------------
const isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

// Duplicate object keys, at any depth, in JSON text that already parses.
// JSON.parse keeps the last of two equal keys and says nothing, so a row
// carrying "result": "RED" and then "result": "GREEN" would read as GREEN.
// Keys compare after unescaping. Returns the duplicated keys, in order found.
export function duplicateJsonKeys(text) {
  const dups = [];
  const stack = []; // an object frame {keys, wantKey}, or null for an array
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const top = stack.length ? stack[stack.length - 1] : null;
    if (ch === "{") stack.push({ keys: new Set(), wantKey: true });
    else if (ch === "[") stack.push(null);
    else if (ch === "}" || ch === "]") stack.pop();
    else if (ch === "," && top) top.wantKey = true;
    else if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      if (top && top.wantKey) {
        let key;
        try { key = JSON.parse(text.slice(i, j + 1)); } catch { key = text.slice(i + 1, j); }
        if (top.keys.has(key)) dups.push(key);
        else top.keys.add(key);
        top.wantKey = false;
      }
      i = j;
    }
  }
  return dups;
}

// A ledger JSON file parses, and parses to one unambiguous document.
function parseLedgerJson(text, label) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    throw new Error(`${label}: malformed JSON (${e.message})`);
  }
  const dups = duplicateJsonKeys(text);
  if (dups.length) {
    throw new Error(
      `${label}: duplicate key ${dups.map((k) => JSON.stringify(k)).join(", ")} ` +
      `(JSON.parse silently keeps the last; a ledger file must be unambiguous JSON)`,
    );
  }
  return doc;
}

// Every regular file in a rows directory is a row, regardless of the case of
// its extension (a filter like `.endsWith(".json")` let a `BAD.JSON` sit on
// disk, hash-bound and unvalidated, invisible to every check below — an
// input hole, not a feature). Any non-regular entry (subdirectory, symlink,
// junction) refuses the ledger outright.
function filesIn(dir, label) {
  if (!existsSync(dir)) return [];
  if (!statSync(dir).isDirectory()) throw new Error(`${label}: must be a directory`);
  return readdirSync(dir, { withFileTypes: true })
    .map((e) => {
      if (!e.isFile()) {
        throw new Error(`${label}/${e.name}: not a regular file in a rows directory`);
      }
      return e.name;
    })
    .sort();
}

// The pointer file: exactly {"superseded": {"<old row path>": "<successor
// row path>", ...}}. Absent is the same as present-and-empty — nothing has
// been superseded. Any other shape is refused with a named reason.
function readPointer(ledgerDir) {
  const spPath = join(ledgerDir, SUPERSESSION);
  if (!existsSync(spPath)) return new Map();
  const doc = parseLedgerJson(readFileSync(spPath, "utf8"), SUPERSESSION);
  const shape = `{"superseded": {"<row path>": "<successor row path>"}}`;
  if (!isPlainObject(doc)) {
    throw new Error(`${SUPERSESSION}: must be a JSON object ${shape} (got ${JSON.stringify(doc)})`);
  }
  for (const k of Object.keys(doc)) {
    if (k !== "superseded") throw new Error(`${SUPERSESSION}: unknown key ${JSON.stringify(k)} (only "superseded" belongs there)`);
  }
  if (!isPlainObject(doc.superseded)) {
    throw new Error(`${SUPERSESSION}: must be a JSON object ${shape} ("superseded" is ${JSON.stringify(doc.superseded)})`);
  }
  for (const [k, v] of Object.entries(doc.superseded)) {
    if (typeof v !== "string" || v.length === 0) {
      throw new Error(`${SUPERSESSION}: entry ${JSON.stringify(k)} = ${JSON.stringify(v)} must map a row path to a row path`);
    }
  }
  return new Map(Object.entries(doc.superseded));
}

export function loadLedger(ledgerDir) {
  const readRow = (rel, kind) => {
    const row = parseLedgerJson(readFileSync(join(ledgerDir, rel), "utf8"), rel);
    if (!isPlainObject(row)) throw new Error(`${rel}: a row must be a JSON object`);
    if (row.kind !== kind) {
      throw new Error(`${rel}: kind ${JSON.stringify(row.kind)} in ${rel.split("/")[0]}/`);
    }
    return { row, rel };
  };

  const verdictFiles = filesIn(join(ledgerDir, "verdicts"), "verdicts")
    .map((f) => `verdicts/${f}`);

  // ledger/runs/ may hold only generation directories; each generation
  // directory holds only regular shared-row files (checked by filesIn, same
  // as any other rows directory). Names and order are checked by
  // validateGenerations.
  const runsDir = join(ledgerDir, "runs");
  if (existsSync(runsDir) && !statSync(runsDir).isDirectory()) throw new Error("runs: must be a directory");
  const runs = existsSync(runsDir)
    ? readdirSync(runsDir, { withFileTypes: true })
        .map((e) => {
          if (!e.isDirectory()) {
            throw new Error(`runs/${e.name}: runs/ may hold only generation directories`);
          }
          return e.name;
        })
        .sort()
    : [];
  const runFiles = runs.flatMap((g) =>
    filesIn(join(runsDir, g), `runs/${g}`).map((f) => `runs/${g}/${f}`));

  const auditFiles = filesIn(join(ledgerDir, "audits"), "audits")
    .map((f) => `audits/${f}`);

  return {
    verdicts: [...verdictFiles, ...runFiles].map((rel) => readRow(rel, "GATE_VERDICT")),
    audits: auditFiles.map((rel) => readRow(rel, "SURFACE_AUDIT")),
    superseded: readPointer(ledgerDir),
    // The legacy flat directory counts as generation zero; shared-row
    // generations follow it. validateGenerations orders them by stamp.
    generations: ["verdicts", ...runs.map((g) => `runs/${g}`)],
  };
}

// Every file under the ledger root that SOURCE.md must bind (all of them but
// SOURCE.md itself), plus a refusal for every root entry outside the known
// set. Unexpected directories are walked too, so their files also surface
// as unbound rather than hiding behind the root refusal.
export function ledgerTree(ledgerDir) {
  const files = [];
  const errors = [];
  const walk = (relDir) => {
    for (const e of readdirSync(join(ledgerDir, relDir), { withFileTypes: true })) {
      const rel = `${relDir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (e.isFile()) files.push(rel);
      else errors.push(`${rel}: not a regular file or directory under the ledger`);
    }
  };
  for (const e of readdirSync(ledgerDir, { withFileTypes: true })) {
    const known = e.isDirectory() ? ROOT_DIRS.includes(e.name) : e.isFile() && ROOT_FILES.includes(e.name);
    if (!known) {
      errors.push(
        `${e.name}: unexpected entry at the ledger root (only ${ROOT_DIRS.map((d) => `${d}/`).join(", ")}, ` +
        `${ROOT_FILES.join(" and ")} belong there)`,
      );
    }
    if (e.isDirectory()) walk(e.name);
    else if (e.isFile() && e.name !== "SOURCE.md") files.push(e.name);
  }
  return { files: files.sort(), errors };
}

// Generation zero holds exactly the committed legacy rows, byte for byte
// (LF-normalized). `files` is ledgerTree's file list.
export function validateLegacyFrozen(ledgerDir, files) {
  const errs = [];
  const legacy = files.filter((f) => f.startsWith("verdicts/"));
  for (const rel of legacy) {
    const want = FROZEN_LEGACY.get(rel);
    if (!want) {
      errs.push(`verdicts/ is frozen: ${rel} is not one of the committed legacy rows (new rows go in runs/<generation>/)`);
      continue;
    }
    const got = sha256(readFileSync(join(ledgerDir, rel)));
    if (got !== want) errs.push(`verdicts/ is frozen: ${rel} changed (sha256 ${got}, committed ${want})`);
  }
  for (const rel of FROZEN_LEGACY.keys()) {
    if (!legacy.includes(rel)) errs.push(`verdicts/ is frozen: committed legacy row ${rel} is missing`);
  }
  return errs;
}

// snapshots/ holds audit artifacts only: every file there is named by some
// audit row's audit_artifact, and none is a verdict row (a bound verdict row
// there would be served at a ledger URL while no rule ever read it).
// audits/ needs no rule of its own here: loadLedger refuses any row in it
// whose kind is not SURFACE_AUDIT.
const looksLikeVerdict = (doc) => isPlainObject(doc) && (
  (typeof doc.kind === "string" && doc.kind.trim().toUpperCase() === "GATE_VERDICT") ||
  ("cell" in doc && "result" in doc && "checks" in doc));

export function validateSnapshots(ledgerDir, files, audits) {
  const errs = [];
  const named = new Set(audits.map(({ row }) => row.audit_artifact));
  for (const rel of files.filter((f) => f.startsWith("snapshots/"))) {
    if (!named.has(rel)) {
      errs.push(`${rel}: no audit row names it as its audit_artifact (snapshots/ holds only audit artifacts)`);
    }
    let doc = null;
    try { doc = JSON.parse(readFileSync(join(ledgerDir, rel), "utf8")); } catch { /* not JSON, so not a row */ }
    if (looksLikeVerdict(doc)) {
      errs.push(`${rel}: holds a GATE_VERDICT row; verdict rows belong only in verdicts/ or runs/<generation>/`);
    }
  }
  return errs;
}

// --- rows -------------------------------------------------------------------
export const generationOf = (rel) => rel.split("/").slice(0, -1).join("/");
export const dialectOf = (generation) => (generation.startsWith("runs/") ? "shared" : "legacy");

function missing(row, required) {
  return required.filter((k) => !(k in row));
}

const isCount = (v) => Number.isInteger(v) && v >= 0;

// A check-name -> count object (checks, evaluated, planted.expected_violations).
// Returns whether `value` is an object at all, pushing named reasons.
function countsObject(rel, name, value, errs) {
  if (!isPlainObject(value)) {
    errs.push(`${rel}: ${name} must be a JSON object of check name to count (got ${JSON.stringify(value)})`);
    return false;
  }
  for (const [k, v] of Object.entries(value)) {
    if (!isCount(v)) errs.push(`${rel}: ${name}.${k} must be a non-negative integer (got ${JSON.stringify(v)})`);
  }
  return true;
}

// A twin's red is credited only when it is exactly the plant: over the union
// of the planted and the computed check names, every count equals its
// expectation, a planted check never computed and a computed check never
// planted both being mismatches. A plant over no checks matches nothing.
export function twinMatchesPlant(row) {
  const exp = row?.planted?.expected_violations;
  const checks = row?.checks;
  if (!isPlainObject(exp) || !isPlainObject(checks)) return false;
  const names = new Set([...Object.keys(exp), ...Object.keys(checks)]);
  return names.size > 0 && [...names].every((n) => exp[n] === checks[n]);
}

export function validateVerdict({ row, rel }) {
  const errs = [];
  const shared = dialectOf(generationOf(rel)) === "shared";
  const miss = missing(row, shared ? SHARED_REQUIRED : VERDICT_REQUIRED);
  if (miss.length) errs.push(`${rel}: missing fields: ${miss.join(", ")}`);
  const checksOk = "checks" in row && countsObject(rel, "checks", row.checks, errs);
  const evaluatedOk = "evaluated" in row && countsObject(rel, "evaluated", row.evaluated, errs);

  if (shared) {
    for (const k of Object.keys(row)) {
      if (LEGACY_IDENTITY_KEYS.includes(k)) {
        errs.push(`${rel}: legacy key ${k} in a shared-row generation`);
      } else if (!SHARED_PROPERTIES.has(k)) {
        errs.push(`${rel}: unknown top-level key ${JSON.stringify(k)} outside the shared row schema`);
      }
    }
    if ("schema" in row && row.schema !== SHARED_SCHEMA_ID) {
      errs.push(`${rel}: schema ${JSON.stringify(row.schema)} is not ${SHARED_SCHEMA_ID}`);
    }
    if ("gate_sha" in row && !(typeof row.gate_sha === "string" && /^[0-9a-f]{40}$/.test(row.gate_sha))) {
      errs.push(`${rel}: gate_sha must be a 40-hex commit sha (got ${JSON.stringify(row.gate_sha)})`);
    }
    if ("gate_worktree" in row && !["clean", "dirty"].includes(row.gate_worktree)) {
      errs.push(`${rel}: gate_worktree must be clean|dirty (got ${JSON.stringify(row.gate_worktree)})`);
    }
    const hasReason = typeof row.unevaluable_reason === "string" && row.unevaluable_reason.length > 0;
    if (row.result === "UNEVALUABLE" && !hasReason) {
      errs.push(`${rel}: UNEVALUABLE row missing unevaluable_reason`);
    }
    if (row.result !== "UNEVALUABLE" && "unevaluable_reason" in row) {
      errs.push(`${rel}: unevaluable_reason present but result is not UNEVALUABLE`);
    }
    if ("surface" in row && !(typeof row.surface === "string" && /^[a-z0-9][a-z0-9-]*$/.test(row.surface))) {
      errs.push(`${rel}: surface must match [a-z0-9][a-z0-9-]* (got ${JSON.stringify(row.surface)})`);
    }
    for (const k of ["scope", "content_hash_basis"]) {
      if (k in row && typeof row[k] !== "string") errs.push(`${rel}: ${k} must be a string (got ${JSON.stringify(row[k])})`);
    }
    for (const k of ["params", "metrics"]) {
      if (k in row && !isPlainObject(row[k])) errs.push(`${rel}: ${k} must be a JSON object (got ${JSON.stringify(row[k])})`);
    }
    if ("content_hash" in row && !(typeof row.content_hash === "string" && /^sha256:[0-9a-f]{64}$/.test(row.content_hash))) {
      errs.push(`${rel}: content_hash must be sha256:<64 hex> (got ${JSON.stringify(row.content_hash)})`);
    }

    // Cross-field row rules, the same the conformance pack applies.
    if (checksOk && Object.keys(row.checks).length === 0) {
      errs.push(`${rel}: checks must have at least one check (a row that examined nothing is not a gate that passed)`);
    }
    if (checksOk && evaluatedOk) {
      const a = Object.keys(row.checks).sort();
      const b = Object.keys(row.evaluated).sort();
      if (a.length !== b.length || a.some((k, i) => k !== b[i])) {
        errs.push(`${rel}: evaluated keys must equal checks keys (checks [${a.join(", ")}], evaluated [${b.join(", ")}])`);
      }
    }
    if (checksOk && row.cell === "live" && row.result === "GREEN" &&
        Object.values(row.checks).some((v) => typeof v === "number" && v > 0)) {
      errs.push(`${rel}: live with violations must be RED (result GREEN, checks ${JSON.stringify(row.checks)})`);
    }
    if (checksOk && row.cell === "twin" && row.result === "RED" &&
        Object.values(row.checks).every((v) => v === 0)) {
      errs.push(`${rel}: twin with no violations must not be RED`);
    }
  }
  if (!GATE_RESULTS.includes(row.result)) {
    errs.push(`${rel}: unknown result ${JSON.stringify(row.result)}`);
  }
  if (![1, 2, 3].includes(row.lane)) errs.push(`${rel}: lane must be 1|2|3`);
  if (!["live", "twin"].includes(row.cell)) errs.push(`${rel}: cell must be live|twin`);
  if (!["local", "ci"].includes(row.runner)) errs.push(`${rel}: runner must be local|ci`);
  if ("ran_at" in row && !parseInstant(row.ran_at)) {
    errs.push(
      `${rel}: ran_at ${JSON.stringify(row.ran_at)} is not a strict ISO-8601 UTC instant ` +
      `(YYYY-MM-DDTHH:MM:SS[.fraction]Z on a real calendar date)`,
    );
  }

  // Filename checks take the basename: a shared row's rel is
  // "runs/<generation>/<name>.json", not "<sub>/<name>.json".
  const base = rel.split("/").pop();
  if (shared) {
    const m = base.match(SHARED_NAME);
    if (!m) {
      errs.push(
        `${rel}: filename not <surface>-lane<lane>-live-<stamp>.json or ` +
        `<surface>-lane<lane>-twin-<mutation>-<stamp>.json (windows-safe; mutation [a-z0-9_]+)`,
      );
    } else if (m[1] !== row.surface || Number(m[2]) !== row.lane || (m[3] ?? m[4]) !== row.cell) {
      errs.push(`${rel}: filename disagrees with row surface/lane/cell`);
    } else if (m[4] && m[5] !== row.planted?.mutation) {
      errs.push(
        `${rel}: filename mutation ${JSON.stringify(m[5])} disagrees with planted.mutation ` +
        `${JSON.stringify(row.planted?.mutation)}`,
      );
    }
  } else {
    const m = base.match(LEGACY_NAME);
    if (!m) {
      errs.push(`${rel}: filename not <surface>-lane<lane>-<cell>-<stamp>.json (windows-safe)`);
    } else if (m[1] !== row.surface || Number(m[2]) !== row.lane || m[3] !== row.cell) {
      errs.push(`${rel}: filename disagrees with row surface/lane/cell`);
    }
  }

  // The plant. Whether a twin RED matches it is a needs-a-human question for
  // the current generation (validateGenerations), not a row rule: a
  // superseded twin that went red for the wrong reason stays as history.
  if (row.cell === "twin") {
    if (!isPlainObject(row.planted) || !("expected_violations" in row.planted)) {
      errs.push(`${rel}: twin verdict must carry planted.expected_violations`);
    } else if (shared) {
      const p = row.planted;
      for (const k of Object.keys(p)) {
        if (!PLANTED_PROPERTIES.has(k)) errs.push(`${rel}: planted: unknown key ${JSON.stringify(k)}`);
      }
      if (!(typeof p.mutation === "string" && p.mutation.length > 0)) {
        errs.push(`${rel}: planted.mutation must be a non-empty string (it names the twin within its cell)`);
      } else if (!MUTATION.test(p.mutation)) {
        errs.push(`${rel}: planted.mutation ${JSON.stringify(p.mutation)} must match [a-z0-9_]+ (the twin filename carries it)`);
      }
      if (!isCount(p.mutated_rows)) {
        errs.push(`${rel}: planted.mutated_rows must be a non-negative integer (got ${JSON.stringify(p.mutated_rows)})`);
      }
      if (countsObject(rel, "planted.expected_violations", p.expected_violations, errs) &&
          !Object.values(p.expected_violations).some((v) => typeof v === "number" && v > 0)) {
        errs.push(
          `${rel}: planted.expected_violations plants an empty set: a twin must expect at least one ` +
          `violation (got ${JSON.stringify(p.expected_violations)})`,
        );
      }
    }
  } else if ("planted" in row) {
    errs.push(`${rel}: live verdict must not carry a planted mutation`);
  }

  // The rows binding: rows is a count equal to evaluated.no_future_accepted.
  // A null or non-object evaluated is refused by name above and here, never
  // skipped.
  if ("rows" in row) {
    if (!isCount(row.rows)) {
      errs.push(`${rel}: rows must be a non-negative integer (got ${JSON.stringify(row.rows)})`);
    }
    if (!evaluatedOk) {
      errs.push(`${rel}: rows cannot be bound: evaluated is not a JSON object`);
    } else if (row.rows !== row.evaluated.no_future_accepted) {
      errs.push(`${rel}: rows must equal evaluated.no_future_accepted`);
    }
  }
  if (evaluatedOk && Object.values(row.evaluated).some((v) => v === 0) &&
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
  if ("audit_artifact" in row) {
    const segs = typeof row.audit_artifact === "string" ? row.audit_artifact.split("/") : [];
    if (segs.length < 2 || segs[0] !== "snapshots" || segs.slice(1).some((s) => s === "" || s === "." || s === "..")) {
      errs.push(`${rel}: audit_artifact must name a file under snapshots/ (got ${JSON.stringify(row.audit_artifact)})`);
    } else {
      const p = join(ledgerDir, row.audit_artifact);
      if (!existsSync(p)) {
        errs.push(`${rel}: audit_artifact ${row.audit_artifact} not committed`);
      } else if (`sha256:${sha256(readFileSync(p))}` !== row.snapshot_hash) {
        errs.push(`${rel}: snapshot_hash does not match ${row.audit_artifact}`);
      }
    }
  }
  for (const c of ["live_fire", "positive", "negative"]) {
    if (row.controls?.[c] !== true) {
      errs.push(`${rel}: control ${c} not held — ABSENT without controls is not evidence`);
    }
  }
  return errs;
}

// --- cells and derived status -------------------------------------------------
// Mutation identity: two twins name the same plant when their mutations are
// equal after trimming; two mutations that differ only by letter case or
// whitespace are refused as ambiguous rather than counted as distinct.
const mutationKey = (m) => (typeof m === "string" ? m.trim() : m);
const looseMutationKey = (m) => (typeof m === "string" ? m.replace(/\s+/g, "").toLowerCase() : m);
const mutationOf = (row) => (isPlainObject(row.planted) ? row.planted.mutation : undefined);

// Groups one generation's rows into cells, surface x lane ->
// { live, twins[], dialect }, collecting the refusals of the structural cell
// rules instead of throwing: one live per cell; in the legacy dialect one
// twin per cell; in the shared dialect any number of twins with distinct
// mutations.
function cellsOf(rows, dialect) {
  const groups = new Map();
  const errs = [];
  for (const { row, rel } of rows) {
    const key = `${row.surface}:lane${row.lane}`;
    if (!groups.has(key)) groups.set(key, { live: null, twins: [], dialect });
    const g = groups.get(key);
    const cell = { ...row, rel };
    if (row.cell === "live") {
      if (g.live) errs.push(`${rel}: second live cell for ${key} (have ${g.live.rel})`);
      else g.live = cell;
    } else if (row.cell === "twin") {
      if (dialect === "legacy" && g.twins.length) {
        errs.push(`${rel}: second twin cell for ${key} (have ${g.twins[0].rel})`);
        continue;
      }
      const mutation = mutationOf(row);
      const same = g.twins.find((t) => mutationKey(mutationOf(t)) === mutationKey(mutation));
      const near = same ? null : g.twins.find((t) => looseMutationKey(mutationOf(t)) === looseMutationKey(mutation));
      if (same) {
        errs.push(`${rel}: duplicate twin mutation ${JSON.stringify(mutation)} for ${key} (have ${same.rel})`);
      } else if (near) {
        errs.push(
          `${rel}: twin mutations ${JSON.stringify(mutation)} and ${JSON.stringify(mutationOf(near))} ` +
          `differ only by case or whitespace for ${key} (have ${near.rel})`,
        );
      } else {
        g.twins.push(cell);
      }
    }
  }
  return { groups, errs };
}

// The needs-a-human results, checked before anything is derived: a live RED
// (a real surface failed), a twin GREEN (the gate missed the plant) and a
// twin RED that does not match its plant (a red for the wrong reason). An
// UNEVALUABLE row elsewhere in the cell never hides one of them.
function refuseNeedsAHuman(live, twins) {
  if (live && live.result === "RED") {
    throw new Error(`live RED needs a human: a real surface failed (${live.rel})`);
  }
  for (const t of twins) {
    if (t.result === "GREEN") throw new Error(`twin GREEN needs a human: the gate missed the plant (${t.rel})`);
    if (t.result === "RED" && !twinMatchesPlant(t)) {
      throw new Error(
        `twin RED does not match the plant (expected ${JSON.stringify(t.planted?.expected_violations)}, ` +
        `got ${JSON.stringify(t.checks)}): a red for the wrong reason needs a human (${t.rel})`,
      );
    }
  }
}

// Legacy dialect, as published: CLAIMABLE when the one live is GREEN and the
// one twin is RED matching its plant; UNEVALUABLE when either present cell
// is; PARTIAL when exactly one cell is present. No check-by-check crediting.
function creditLegacy(live, twins) {
  if (twins.length > 1) {
    throw new Error(`${twins[1].rel}: second twin cell (have ${twins[0].rel})`);
  }
  refuseNeedsAHuman(live, twins);
  const twin = twins[0];
  if (!live && !twin) return { status: "UNCLAIMED", unfalsified: [] };
  if ((live && live.result === "UNEVALUABLE") || (twin && twin.result === "UNEVALUABLE")) {
    return { status: "UNEVALUABLE", unfalsified: [] };
  }
  // Past the refusals a present live is GREEN and a present twin RED as planted.
  if (live && twin) return { status: "CLAIMABLE", unfalsified: [] };
  return { status: "PARTIAL", unfalsified: [] };
}

// Shared-row dialect. Refusals first, then UNEVALUABLE when any row is (and
// per-check crediting does not apply). Then, for a GREEN live with at least
// one twin (every twin now RED as planted): every check key the live reports
// must be set nonzero by at least one twin, or the cell derives PARTIAL and
// names the unfalsified checks. Anything else (a lone live, twins without a
// live) is PARTIAL.
function creditShared(live, twins) {
  if (!live && twins.length === 0) return { status: "UNCLAIMED", unfalsified: [] };
  refuseNeedsAHuman(live, twins);
  if ((live && live.result === "UNEVALUABLE") || twins.some((t) => t.result === "UNEVALUABLE")) {
    return { status: "UNEVALUABLE", unfalsified: [] };
  }
  if (live && twins.length > 0) {
    const unfalsified = Object.keys(isPlainObject(live.checks) ? live.checks : {})
      .filter((k) => !twins.some((t) => typeof t.checks?.[k] === "number" && t.checks[k] > 0))
      .sort();
    return { status: unfalsified.length ? "PARTIAL" : "CLAIMABLE", unfalsified };
  }
  return { status: "PARTIAL", unfalsified: [] };
}

// Derived credit per surface x lane: { status, unfalsified }. Never read
// from a file. `cells` is { live, twins, dialect } as groupCells returns it;
// an empty object is an unclaimed lane. Throws on a needs-a-human result.
export function deriveCredit(cells) {
  const live = cells.live ?? null;
  const twins = cells.twins ?? [];
  return cells.dialect === "shared" ? creditShared(live, twins) : creditLegacy(live, twins);
}

export function deriveStatus(cells) {
  return deriveCredit(cells).status;
}

// Generations in order: legacy verdicts/ first, then every runs/<stamp>
// whose name parses, by instant. Unparseable names are left out (and
// refused by validateGenerations).
export function orderedGenerations(generations) {
  const stamped = generations
    .filter((g) => g !== "verdicts")
    .map((g) => ({ g, inst: parseStamp(g.slice("runs/".length)) }))
    .filter((s) => s.inst)
    .sort((a, b) => compareInstants(a.inst, b.inst));
  return [...(generations.includes("verdicts") ? ["verdicts"] : []), ...stamped.map((s) => s.g)];
}

// The generation(s) holding a non-superseded row. On a ledger the gate
// accepts this is exactly one directory, the current generation; when rows
// span several (refused by validateSupersession) each of them is treated as
// current, so no needs-a-human row escapes by that route.
export function currentGenerations({ verdicts, superseded = new Map() }) {
  return new Set(verdicts.filter((v) => !superseded.has(v.rel)).map((v) => generationOf(v.rel)));
}

// Every generation is checked on its own, superseded or not: its directory
// name is a UTC stamp no later than its first row's ran_at and later than
// every row of the earlier generation, it holds rows, its rows ran after
// every row of every earlier generation, and its cells satisfy the
// structural cell rules of its own dialect. The needs-a-human refusals apply
// to the current generation only.
export function validateGenerations({ verdicts, generations, superseded = new Map() }) {
  const errs = [];
  const byGen = new Map(generations.map((g) => [g, []]));
  for (const v of verdicts) byGen.get(generationOf(v.rel))?.push(v);

  const stamped = [];
  for (const g of generations) {
    if (g === "verdicts") continue;
    const inst = parseStamp(g.slice("runs/".length));
    if (!inst) {
      errs.push(`${g}: generation directory name is not a UTC stamp (YYYYMMDDTHHMMSS[.fraction]Z on a real calendar date)`);
      continue;
    }
    if (byGen.get(g).length === 0) errs.push(`${g}: generation directory holds no rows`);
    stamped.push({ g, inst });
  }
  stamped.sort((a, b) => compareInstants(a.inst, b.inst));
  for (let i = 1; i < stamped.length; i++) {
    if (compareInstants(stamped[i - 1].inst, stamped[i].inst) === 0) {
      errs.push(`${stamped[i - 1].g} and ${stamped[i].g} name the same instant: generation order is ambiguous`);
    }
  }

  let prev = null;
  for (const g of orderedGenerations(generations)) {
    const runs = byGen.get(g)
      .map((v) => ({ rel: v.rel, inst: parseInstant(v.row.ran_at) }))
      .filter((x) => x.inst)
      .sort((a, b) => compareInstants(a.inst, b.inst));
    const stamp = g === "verdicts" ? null : parseStamp(g.slice("runs/".length));
    if (stamp && runs.length && compareInstants(stamp, runs[0].inst) > 0) {
      errs.push(
        `${g}: generation stamp is later than its earliest row ${runs[0].rel}: ` +
        `a generation is stamped no later than its first run`,
      );
    }
    if (stamp && prev && compareInstants(stamp, prev.last.inst) <= 0) {
      errs.push(
        `${g}: generation stamp does not postdate ${prev.last.rel}, the latest row of the earlier ` +
        `generation ${prev.g}`,
      );
    }
    if (!runs.length) continue;
    if (prev && compareInstants(prev.last.inst, runs[0].inst) >= 0) {
      errs.push(
        `${g}: ${runs[0].rel} did not run after ${prev.last.rel} of the earlier generation ${prev.g}: ` +
        `generation stamps and ran_at disagree on order`,
      );
    }
    prev = { g, last: runs[runs.length - 1] };
  }

  const current = currentGenerations({ verdicts, superseded });
  for (const g of generations) {
    const { groups, errs: cellErrs } = cellsOf(byGen.get(g), dialectOf(g));
    errs.push(...cellErrs);
    // A superseded generation's needs-a-human rows are history, not refusals.
    if (!current.has(g)) continue;
    for (const [key, cells] of groups) {
      try {
        deriveCredit(cells);
      } catch (e) {
        errs.push(`${g}: ${key}: ${e.message}`);
      }
    }
  }
  return errs;
}

// The cells of the current generation (the one directory holding every
// non-superseded row). Throws on anything the gate refuses; build.mjs calls
// it only after checkLedger has passed.
export function groupCells(verdicts, superseded = new Map()) {
  const current = verdicts.filter((v) => !superseded.has(v.rel));
  const gens = [...new Set(current.map((v) => generationOf(v.rel)))];
  if (gens.length > 1) {
    throw new Error(`non-superseded rows span ${gens.sort().join(", ")}`);
  }
  const { groups, errs } = cellsOf(current, dialectOf(gens[0] ?? "verdicts"));
  if (errs.length) throw new Error(errs[0]);
  return groups;
}

// The three authored-status literals may not appear anywhere in a ledger
// row — as a whole word in any string value, or in an object key — status
// is derived at build time or it is a lie.
export function findStatusLiterals(value, path = "$") {
  if (typeof value === "string") {
    return STATUS_WORD.test(value) ? [`${path} = ${JSON.stringify(value)}`] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => findStatusLiterals(v, `${path}[${i}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => [
      ...(STATUS_WORD.test(k) ? [`${path} key ${JSON.stringify(k)}`] : []),
      ...findStatusLiterals(v, `${path}.${k}`),
    ]);
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

// --- supersession -----------------------------------------------------
// A superseded row is never edited or deleted; supersession.json is the only
// record of a replacement, and it is itself hash-bound in SOURCE.md like
// every other ledger file. "Generation" here means the row's parent path
// ("verdicts", or "runs/<stamp>") — a directory, not a single file.
export function validateSupersession({ verdicts, superseded, generations }) {
  const errs = [];
  const byRel = new Map(verdicts.map((v) => [v.rel, v.row]));
  const order = new Map(
    orderedGenerations(generations ?? [...new Set(verdicts.map((v) => generationOf(v.rel)))])
      .map((g, i) => [g, i]),
  );

  for (const [oldRel, newRel] of superseded) {
    const a = byRel.get(oldRel);
    const b = byRel.get(newRel);
    if (!a) { errs.push(`${SUPERSESSION}: supersedes ${oldRel}, which is not a row`); continue; }
    if (!b) { errs.push(`${SUPERSESSION}: ${oldRel} superseded by ${newRel}, which is not a row`); continue; }
    if (a.surface !== b.surface || a.lane !== b.lane || a.cell !== b.cell) {
      errs.push(`${SUPERSESSION}: ${oldRel} and ${newRel} are not the same surface/lane/cell`);
    } else if (a.cell === "twin") {
      // A successor replaces the same twin: the same plant, by mutation.
      const ma = mutationOf(a);
      const mb = mutationOf(b);
      if (typeof ma === "string" && typeof mb === "string" && mutationKey(ma) !== mutationKey(mb)) {
        errs.push(
          `${SUPERSESSION}: twin ${oldRel} carries planted.mutation ${JSON.stringify(ma)} but its successor ` +
          `${newRel} carries ${JSON.stringify(mb)}` +
          (looseMutationKey(ma) === looseMutationKey(mb)
            ? `: they differ only by case or whitespace`
            : `: a successor replaces the same twin`),
        );
      }
    }
    const ia = parseInstant(a.ran_at);
    const ib = parseInstant(b.ran_at);
    if (!ia || !ib) {
      errs.push(`${SUPERSESSION}: cannot order ${newRel} against ${oldRel}: a ran_at is not a strict ISO-8601 UTC instant`);
    } else if (compareInstants(ib, ia) <= 0) {
      errs.push(`${SUPERSESSION}: successor ${newRel} does not postdate ${oldRel}`);
    }
    const ga = order.get(generationOf(oldRel));
    const gb = order.get(generationOf(newRel));
    if (ga !== undefined && gb !== undefined && gb <= ga) {
      errs.push(`${SUPERSESSION}: successor ${newRel} is not in a later generation than ${oldRel}`);
    }
  }

  // No cycles: following successor pointers from any superseded row must
  // terminate at a row that is not itself a key in the map.
  for (const start of superseded.keys()) {
    const seen = new Set([start]);
    let cur = superseded.get(start);
    while (superseded.has(cur)) {
      if (seen.has(cur)) { errs.push(`${SUPERSESSION}: cycle through ${cur}`); break; }
      seen.add(cur);
      cur = superseded.get(cur);
    }
  }

  // The current generation is derived, never named: the one directory that
  // holds every non-superseded row. A row outside it must be superseded; a
  // superseded row may not sit inside it (a generation is either the
  // current one, wholly live, or a retired one, wholly superseded).
  const liveGens = [...currentGenerations({ verdicts, superseded })].sort();
  if (liveGens.length > 1) {
    errs.push(
      `${SUPERSESSION}: non-superseded rows span ${liveGens.join(", ")}: ` +
      `every row outside the current generation must be superseded`,
    );
  } else if (liveGens.length === 1) {
    for (const oldRel of superseded.keys()) {
      if (generationOf(oldRel) === liveGens[0]) {
        errs.push(
          `${SUPERSESSION}: ${oldRel} is superseded but sits in the current generation ${liveGens[0]}`,
        );
      }
    }
  }

  return errs;
}

// The one directory holding every non-superseded verdict row, or null when
// that is not derivable (zero rows, or rows split across more than one
// directory — validateSupersession already refuses the latter as a build
// failure; callers of this outside the gate, like `--current-generation`,
// must still handle null rather than guess).
export function currentGeneration({ verdicts, superseded }) {
  const gens = [...currentGenerations({ verdicts, superseded })];
  return gens.length === 1 ? gens[0] : null;
}
