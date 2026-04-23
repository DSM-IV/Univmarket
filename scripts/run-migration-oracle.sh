#!/usr/bin/env bash
#
# Firestore → Oracle Migration Runner (rehearsal-ready)
#
# Usage:
#   ./scripts/run-migration-oracle.sh [path-to-service-account.json]
#
# Env vars (override defaults):
#   DB_USERNAME=univmarket
#   DB_PASSWORD=devpass
#   DB_CONNECT_STRING=localhost:1521/FREEPDB1
#   MIGRATE_DRY_RUN=1     (read Firestore, log counts, don't write Oracle)
#   MIGRATE_KEEP_DATA=1   (skip the WIPE step — append mode, danger)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FUNCTIONS_DIR="$PROJECT_DIR/functions"

# ---------- Resolve service account credentials ----------

if [ -n "${1:-}" ]; then
  export GOOGLE_APPLICATION_CREDENTIALS="$1"
elif [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  for candidate in \
    "$PROJECT_DIR/serviceAccountKey.json" \
    "$SCRIPT_DIR/serviceAccountKey.json" \
    "$FUNCTIONS_DIR/serviceAccountKey.json" \
  ; do
    if [ -f "$candidate" ]; then
      export GOOGLE_APPLICATION_CREDENTIALS="$candidate"
      break
    fi
  done
fi

if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  echo "ERROR: No Firebase service account credentials found." >&2
  echo "Provide via arg, env, or place serviceAccountKey.json in project root." >&2
  exit 1
fi
if [ ! -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
  echo "ERROR: Credentials file not found: $GOOGLE_APPLICATION_CREDENTIALS" >&2
  exit 1
fi

echo "[run-migration-oracle] credentials: $GOOGLE_APPLICATION_CREDENTIALS"

# ---------- Install deps if needed ----------

if [ ! -d "$FUNCTIONS_DIR/node_modules" ] || [ ! -d "$FUNCTIONS_DIR/node_modules/oracledb" ]; then
  echo "[run-migration-oracle] Installing functions/ deps (oracledb, ts-node)..."
  (cd "$FUNCTIONS_DIR" && npm install)
fi

# ---------- Run ----------
#
# Run from inside functions/ so Node resolves firebase-admin and oracledb
# from functions/node_modules (root package.json has "type": "module" which
# breaks ESM resolution from scripts/).

cd "$FUNCTIONS_DIR"
exec npx ts-node --transpile-only "$SCRIPT_DIR/migrate-to-oracle.ts"
