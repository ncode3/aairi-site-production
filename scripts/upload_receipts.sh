#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/config/azure.env}"
RECEIPTS_DIR="${AVARON_RECEIPTS_DIR:-$ROOT_DIR/restricted_inputs/avaron/2026-07-10}"

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: Azure CLI is not installed. Install it, then rerun this script." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Missing $ENV_FILE" >&2
  echo "Copy config/azure.env.example to config/azure.env and fill in the storage account." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${AZURE_STORAGE_ACCOUNT:?AZURE_STORAGE_ACCOUNT is required}"
: "${AZURE_BLOB_CONTAINER:?AZURE_BLOB_CONTAINER is required}"
: "${AZURE_BLOB_PREFIX:?AZURE_BLOB_PREFIX is required}"

EXPECTED_PREFIX="raw/99_restricted/avaron/2026-07-10"
if [[ "${AZURE_BLOB_PREFIX%/}" != "$EXPECTED_PREFIX" ]]; then
  echo "ERROR: Avaron receipts may only route to $EXPECTED_PREFIX/." >&2
  exit 1
fi
if [[ ! -d "$RECEIPTS_DIR" ]]; then
  echo "ERROR: Missing restricted receipt input directory: $RECEIPTS_DIR" >&2
  exit 1
fi

if ! az account show >/dev/null 2>&1; then
  az login
fi

if [[ -n "${AZURE_SUBSCRIPTION_ID:-}" ]]; then
  az account set --subscription "$AZURE_SUBSCRIPTION_ID"
fi

# Create the private container if it does not already exist.
az storage container create \
  --account-name "$AZURE_STORAGE_ACCOUNT" \
  --name "$AZURE_BLOB_CONTAINER" \
  --auth-mode login \
  --public-access off \
  --only-show-errors >/dev/null

upload_one() {
  local file="$1"
  local filename sha blob exists invoice amount description expected_sha
  filename="$(basename "$file")"
  sha="$(sha256sum "$file" | awk '{print $1}')"
  blob="${AZURE_BLOB_PREFIX%/}/$filename"

  case "$filename" in
    Invoice-0103.pdf)
      invoice="0103"
      amount="2570.94"
      description="monthly_space_and_energy"
      expected_sha="05dc182cdd27b4d864ae546dcaf96836921c8745d7e859ca7b8942a689990092"
      ;;
    Invoice-0104.pdf)
      invoice="0104"
      amount="500.00"
      description="installation_fee"
      expected_sha="95ec90fcf32b9cdb901e1c710305a9a882933df087fc90e65dd48bda6eea1ff4"
      ;;
    *)
      echo "Skipping unrecognized file: $filename"
      return 0
      ;;
  esac

  if [[ "$sha" != "$expected_sha" ]]; then
    echo "ERROR: SHA-256 mismatch for $filename; refusing upload." >&2
    return 1
  fi

  exists="$(az storage blob exists \
    --account-name "$AZURE_STORAGE_ACCOUNT" \
    --container-name "$AZURE_BLOB_CONTAINER" \
    --name "$blob" \
    --auth-mode login \
    --query exists -o tsv)"

  if [[ "$exists" == "true" ]]; then
    echo "SKIP: $blob already exists."
    return 0
  fi

  echo "UPLOAD: $filename -> $blob"
  az storage blob upload \
    --account-name "$AZURE_STORAGE_ACCOUNT" \
    --container-name "$AZURE_BLOB_CONTAINER" \
    --name "$blob" \
    --file "$file" \
    --auth-mode login \
    --overwrite false \
    --content-type application/pdf \
    --metadata \
      source=avaron \
      vendor=avaron_ai \
      invoice_number="$invoice" \
      invoice_date=2026-07-10 \
      amount_usd="$amount" \
      description="$description" \
      original_filename="$filename" \
      sha256="$sha" \
      category=financial_records \
      document_type=invoice \
      payment_status=paid \
      sensitivity=restricted \
      index_allowed=false \
    --only-show-errors >/dev/null

  echo "DONE: $blob"
}

for file in "$RECEIPTS_DIR"/Invoice-0103.pdf "$RECEIPTS_DIR"/Invoice-0104.pdf; do
  [[ -f "$file" ]] || { echo "ERROR: Missing $(basename "$file")" >&2; exit 1; }
  upload_one "$file"
done

echo
echo "Verification:"
az storage blob list \
  --account-name "$AZURE_STORAGE_ACCOUNT" \
  --container-name "$AZURE_BLOB_CONTAINER" \
  --prefix "${AZURE_BLOB_PREFIX%/}/" \
  --auth-mode login \
  --query "[].{Blob:name,Size:properties.contentLength,Type:properties.contentSettings.contentType}" \
  -o table
