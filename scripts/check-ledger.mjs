#!/usr/bin/env node
// The ledger gate — runs in CI before the page builds; any failure fails the
// build. Usage: node scripts/check-ledger.mjs [ledger-dir]

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

import {
  loadLedger, validateVerdict, validateAudit, groupCells, deriveStatus,
  findStatusLiterals, parseSourceBindings, sha256,
} from "./lib/ledger.mjs";

export function checkLedger(ledgerDir) {
  const errors = [];

  // 1. Rows parse, carry their kind, and validate.
  let ledger;
  try {
    ledger = loadLedger(ledgerDir);
  } catch (e) {
    return [e.message];
  }
  for (const v of ledger.verdicts) errors.push(...validateVerdict(v));
  for (const a of ledger.audits) errors.push(...validateAudit(a, ledgerDir));

  // 2. No authored status literal anywhere in a row.
  for (const { row, rel } of [...ledger.verdicts, ...ledger.audits]) {
    for (const hit of findStatusLiterals(row)) {
      errors.push(`${rel}: authored status literal (${hit}) — status is derived, never written`);
    }
  }

  // 3. Derived status recomputes without refusal (live RED / twin GREEN throws).
  try {
    for (const [key, cells] of groupCells(ledger.verdicts)) {
      deriveStatus(cells); // value unused here; build.mjs renders it
      void key;
    }
  } catch (e) {
    errors.push(e.message);
  }

  // 4. SOURCE.md binds exactly the set of ledger files, hashes matching.
  const sourcePath = join(ledgerDir, "SOURCE.md");
  if (!existsSync(sourcePath)) {
    errors.push("SOURCE.md missing — the hand-copy seam is unbound");
  } else {
    const bindings = parseSourceBindings(readFileSync(sourcePath, "utf8"));
    const onDisk = [];
    for (const sub of ["verdicts", "audits", "snapshots"]) {
      const dir = join(ledgerDir, sub);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (statSync(join(dir, f)).isFile()) onDisk.push(`${sub}/${f}`);
      }
    }
    for (const rel of onDisk) {
      const bound = bindings.get(rel);
      if (!bound) {
        errors.push(`${rel}: present but not bound in SOURCE.md`);
      } else if (sha256(readFileSync(join(ledgerDir, rel))) !== bound) {
        errors.push(`${rel}: sha256 does not match SOURCE.md binding`);
      }
    }
    for (const rel of bindings.keys()) {
      if (!onDisk.includes(rel)) errors.push(`SOURCE.md binds ${rel} but the file is absent`);
    }
    if (onDisk.length === 0) errors.push("ledger holds no rows at all");
  }

  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ledgerDir = process.argv[2] ?? join(process.cwd(), "ledger");
  const errors = checkLedger(ledgerDir);
  if (errors.length) {
    for (const e of errors) console.error(`FAIL ${e}`);
    process.exit(1);
  }
  console.log("check-ledger: all rows bound, valid, and status-free");
}
