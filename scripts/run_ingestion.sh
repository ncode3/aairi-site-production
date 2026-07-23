#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${AARI_ENV_FILE:-$ROOT_DIR/config/azure.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Missing $ENV_FILE. Copy config/azure.env.example and configure it." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
cd "$ROOT_DIR"
python src/ingest_gmail_to_blob.py --config config/selection.yaml "$@"
if [[ " $* " == *" --dry-run "* ]]; then
  exit 0
fi
python src/extract_documents.py
python src/generate_insights.py
