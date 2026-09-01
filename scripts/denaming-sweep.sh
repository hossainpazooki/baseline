#!/bin/sh
# De-naming sweep: fail if any denied term appears in the tree.
#
# The denied terms are the audited vendor's real name and product name. They
# are NOT stored here -- a committed pattern would itself be the naming act,
# and would make this gate fire on its own source (which is how a real gate
# becomes an always-red one that people learn to ignore). Terms live in
# `.denylist` at the repo root, which is gitignored.
#
# Without `.denylist` the sweep is UNEVALUABLE, and unevaluable halts: it
# exits non-zero rather than reporting a clean tree it never actually checked.
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
list="$root/.denylist"

if [ ! -f "$list" ]; then
  echo "denaming-sweep: UNEVALUABLE - no .denylist at $list" >&2
  echo "  create it with one case-insensitive term per line (gitignored)." >&2
  exit 2
fi

# Strip blanks and #-comments; refuse an effectively empty list, which would
# otherwise make every run trivially green.
terms=$(sed -e 's/#.*//' -e '/^[[:space:]]*$/d' "$list")
if [ -z "$terms" ]; then
  echo "denaming-sweep: UNEVALUABLE - .denylist has no terms" >&2
  exit 2
fi

pattern=$(printf '%s' "$terms" | tr '\n' '|' | sed 's/|$//')

# grep exits 1 on zero matches, so capture rather than let `set -e` kill us.
hits=$(grep -rniE "$pattern" \
        --exclude-dir=.git \
        --exclude-dir=node_modules \
        --exclude=.denylist \
        "$root" || true)

if [ -n "$hits" ]; then
  echo "denaming-sweep: FAIL - denied term present" >&2
  printf '%s\n' "$hits" >&2
  exit 1
fi

echo "denaming-sweep: clean ($(printf '%s\n' "$terms" | wc -l | tr -d ' ') terms, 0 hits)"
