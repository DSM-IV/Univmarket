#!/usr/bin/env bash
#
# Firestore → PostgreSQL Migration Runner
#
# Usage:
#   ./scripts/run-migration.sh [path-to-service-account.json]
#
# If no service account path is given, it will look for:
#   1. $GOOGLE_APPLICATION_CREDENTIALS (if already set)
#   2. ./serviceAccountKey.json
#   3. ../serviceAccountKey.json
#
# Output: scripts/migration-<timestamp>.sql

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FUNCTIONS_DIR="$PROJECT_DIR/functions"

# ---------- Resolve service account credentials ----------

if [ -n "${1:-}" ]; then
  export GOOGLE_APPLICATION_CREDENTIALS="$1"
elif [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  # Try common locations
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
  echo "ERROR: No Firebase service account credentials found."
  echo ""
  echo "Provide one of:"
  echo "  1. Pass path as argument:  ./scripts/run-migration.sh /path/to/serviceAccountKey.json"
  echo "  2. Set env var:            export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json"
  echo "  3. Place file at:          $PROJECT_DIR/serviceAccountKey.json"
  echo ""
  echo "Download from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key"
  exit 1
fi

if [ ! -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
  echo "ERROR: Credentials file not found: $GOOGLE_APPLICATION_CREDENTIALS"
  exit 1
fi

echo "[run-migration] Using credentials: $GOOGLE_APPLICATION_CREDENTIALS"

# ---------- Check dependencies ----------

if ! command -v npx &>/dev/null; then
  echo "ERROR: npx not found. Install Node.js 18+ first."
  exit 1
fi

# Install ts-node if needed (uses functions' node_modules)
if [ ! -d "$FUNCTIONS_DIR/node_modules" ]; then
  echo "[run-migration] Installing dependencies in functions/..."
  (cd "$FUNCTIONS_DIR" && npm install)
fi

# Ensure ts-node is available
if ! npx --prefix "$FUNCTIONS_DIR" ts-node --version &>/dev/null 2>&1; then
  echo "[run-migration] Installing ts-node..."
  (cd "$FUNCTIONS_DIR" && npm install --save-dev ts-node)
fi

# ---------- Run migration ----------

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$SCRIPT_DIR/migration-${TIMESTAMP}.sql"

echo "[run-migration] Running migration script..."
echo "[run-migration] Output: $OUTPUT_FILE"
echo ""

npx --prefix "$FUNCTIONS_DIR" ts-node \
  --project "$FUNCTIONS_DIR/tsconfig.json" \
  --transpile-only \
  "$SCRIPT_DIR/migrate-to-postgres.ts" \
  > "$OUTPUT_FILE"

LINE_COUNT=$(wc -l < "$OUTPUT_FILE")
FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)

echo ""
echo "[run-migration] Migration complete!"
echo "[run-migration] Output: $OUTPUT_FILE"
echo "[run-migration] Lines: $LINE_COUNT"
echo "[run-migration] Size:  $FILE_SIZE"
echo ""
echo "To apply the migration, run:"
echo "  psql -U <user> -d <database> -f $OUTPUT_FILE"
