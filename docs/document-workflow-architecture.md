# Gmail to Azure document workflow

## Architecture

The public site remains a plain HTML Azure Static Web Apps deployment. The document workflow is a separate Python workload in the same repository so it can share policy, inventory, review, and deployment controls without placing documents under the public site.

```text
Gmail API (read-only)
  -> selection.yaml allow/exclude/restricted rules
  -> SHA-256 container-wide deduplication
  -> private Blob container
       raw/01..05/                 internal, index_allowed=true
       raw/99_restricted/          restricted, index_allowed=false
  -> Document Intelligence prebuilt-layout / native Office extractors
  -> processed/ (eligible internal records only)
  -> Azure OpenAI cross-document analysis
  -> insights/ funding, partner, action, risk, curriculum-gap, conflict reports
```

Azure authentication uses `DefaultAzureCredential`: managed identity in Azure and the operator's `az login` session locally. The identity needs Storage Blob Data Contributor (or a narrower custom data role), Document Intelligence User, and the minimum Azure OpenAI user role. Storage keys and connection strings are not used by the document workflow.

Gmail uses the read-only scope. Local OAuth stores its client file and refresh token under ignored `secrets/`. An Azure-hosted job may use a Google Workspace service account only after domain-wide delegation for the same read-only scope; mount that credential from a secret store.

## Configuration

- `config/azure.env.example`: sanitized resource names, endpoints, identity mode, and local paths. Copy to ignored `config/azure.env`.
- `config/selection.yaml`: selection, routing, report, and restricted-classification policy.
- `config/metadata_schema.json`: required Blob metadata and restricted invariants.
- `inventory/curated_manifest.csv`: initial approximately 33-document selection list; every live run must be compared with the generated Gmail manifest.
- `inventory/restricted_or_excluded.csv`: handling policy for excluded classes.

## Local setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ./config/azure.env.example ./config/azure.env
nano ./config/azure.env
az login
set -a; source ./config/azure.env; set +a
python src/ingest_gmail_to_blob.py --config config/selection.yaml --dry-run
```

Review `run_output/ingestion_manifest.csv` against `inventory/curated_manifest.csv`, then run `bash scripts/run_ingestion.sh` without `--dry-run`.

## Gmail authorization

For local OAuth, create a Google Cloud desktop OAuth client with Gmail API enabled and the read-only Gmail scope. Save its JSON as `secrets/client_secret.json`; the first run opens the consent flow and writes `secrets/token.json`. Neither file may be committed.

If the OAuth files already exist elsewhere, do not move them. Set `GMAIL_CREDENTIALS_PATH` and `GMAIL_TOKEN_PATH` in ignored `config/azure.env` to their existing absolute paths. Prepare the default local directory with:

```bash
mkdir -p secrets
chmod 700 secrets
```

After the first consent run:

```bash
chmod 600 secrets/client_secret.json secrets/token.json
```

For a scheduled Azure job, use a secret-mounted OAuth token or a Workspace service account with administrator-approved domain-wide delegation. Set `GMAIL_AUTH_MODE=service_account`, `GOOGLE_APPLICATION_CREDENTIALS`, and `GMAIL_IMPERSONATE_USER`.

## Azure deployment

Build the workflow image separately from the website:

```bash
docker build -f Dockerfile.workflow -t aari-gmail-blob:local .
```

Deploy it as an Azure Container Apps Job or equivalent controlled job, attach a managed identity, grant only required data-plane roles, mount Gmail credentials from Key Vault, and set the sanitized variables from `config/azure.env.example`. Do not expose an HTTP endpoint.

## Restricted-document policy

Restricted records always use `raw/99_restricted/`, metadata `sensitivity=restricted` and `index_allowed=false`, and a private container. Extraction and insight scripts use a shared fail-closed policy function and provide no override flag. Azure AI Search must source only `processed/` and filter for `index_allowed=true`; restricted raw blobs never reach processed storage.

Avaron invoices have an additional fixed route: `raw/99_restricted/avaron/2026-07-10/`. Their uploaders reject any other configured prefix and attach `source=avaron`, `document_type=invoice`, and `payment_status=paid`.

## Troubleshooting

- Missing OAuth file/token: check ignored `secrets/` paths and rerun local consent.
- Azure 403: confirm `az account show`, the subscription, and data-plane role assignment; management-plane Contributor alone is insufficient.
- Duplicate: the SHA-256 already exists in raw Blob metadata; the item is recorded as `duplicate_rejected`.
- Empty Gmail result: verify the mailbox identity, query date window, and `selection.yaml` patterns.
- No Document Intelligence endpoint: PDFs use the local text fallback; images require Document Intelligence.
- Reports absent: confirm there are eligible `processed/*.json` records and Azure OpenAI endpoint/deployment access.
