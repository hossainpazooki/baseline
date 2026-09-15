#!/usr/bin/env node
// The ledger gate — runs in CI before the page builds; any failure fails the
// build. Usage:
//   node scripts/check-ledger.mjs [ledger-dir]
//   node scripts/check-ledger.mjs [ledger-dir] --current-generation
// Exit 0: the ledger passes (or, with --current-generation, the current
// generation is printed). Exit 1: the gate refuses the ledger. Exit 2: a
// usage error (an unknown flag or more than one positional argument), or
// --current-generation on a ledger the gate refuses or whose current
// generation cannot be derived. Exit 2 is never coerced into 0.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

import {
  loadLedger, ledgerTree, validateVerdict, validateAudit, validateGenerations,
  findStatusLiterals, parseSourceBindings, sha256,
  validateSupersession, currentGeneration, validateLegacyFrozen, validateSnapshots,
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

  // 3. Every generation, current or superseded, satisfies the structural
  // cell rules on its own (one live per cell, distinct twin mutations);
  // stamps and ran_at agree on generation order. The needs-a-human results
  // (live RED / twin GREEN / twin RED for the wrong reason) refuse only in
  // the current generation; a superseded one keeps them as history.
  errors.push(...validateGenerations(ledger));

  // 3b. The supersession pointer, if any, is internally consistent (targets
  // exist and are later, a twin's successor carries its mutation,
  // generations don't overlap) — see lib/ledger.mjs.
  errors.push(...validateSupersession(ledger));

  // 4. SOURCE.md binds exactly the set of files under the ledger root (every
  // file but SOURCE.md itself, in every directory), hashes matching, and the
  // root holds nothing outside its known entries. Generation zero holds
  // exactly its committed rows, and snapshots/ holds audit artifacts only.
  const tree = ledgerTree(ledgerDir);
  errors.push(...tree.errors);
  errors.push(...validateLegacyFrozen(ledgerDir, tree.files));
  errors.push(...validateSnapshots(ledgerDir, tree.files, ledger.audits));
  const sourcePath = join(ledgerDir, "SOURCE.md");
  if (!existsSync(sourcePath)) {
    errors.push("SOURCE.md missing — the hand-copy seam is unbound");
  } else {
    const bindings = parseSourceBindings(readFileSync(sourcePath, "utf8"));
    for (const rel of tree.files) {
      const bound = bindings.get(rel);
      if (!bound) {
        errors.push(`${rel}: present but not bound in SOURCE.md`);
      } else if (sha256(readFileSync(join(ledgerDir, rel))) !== bound) {
        errors.push(`${rel}: sha256 does not match SOURCE.md binding`);
      }
    }
    for (const rel of bindings.keys()) {
      if (!tree.files.includes(rel)) errors.push(`SOURCE.md binds ${rel} but the file is absent`);
    }
    if (tree.files.length === 0) errors.push("ledger holds no rows at all");
  }

  return errors;
}

const USAGE = "usage: check-ledger.mjs [ledger-dir] [--current-generation]";

function main(args) {
  const flags = args.filter((a) => a.startsWith("-"));
  const positional = args.filter((a) => !a.startsWith("-"));
  if (flags.some((f) => f !== "--current-generation") || flags.length > 1 || positional.length > 1) {
    console.error(USAGE);
    return 2;
  }
  const ledgerDir = positional[0] ?? join(process.cwd(), "ledger");
  const errors = checkLedger(ledgerDir);

  if (flags.length === 1) {
    // Never guess: a ledger the gate refuses has no current generation.
    if (errors.length) {
      for (const e of errors) console.error(`FAIL ${e}`);
      console.error("FAIL cannot derive a current generation: the ledger gate refuses this ledger");
      return 2;
    }
    const gen = currentGeneration(loadLedger(ledgerDir));
    if (!gen) {
      console.error(
        "FAIL cannot derive a current generation — non-superseded rows span zero or more than one directory",
      );
      return 2;
    }
    console.log(gen);
    return 0;
  }

  if (errors.length) {
    for (const e of errors) console.error(`FAIL ${e}`);
    return 1;
  }
  console.log("check-ledger: all rows bound, valid, and status-free");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // exitCode, not exit(): lets piped stdout/stderr flush before the process ends.
  process.exitCode = main(process.argv.slice(2));
}
