# AARI Avaron Receipts → Azure Blob Storage

This repository contains the secure workflow for the two paid invoices Jonathan Kelly sent from Avaron. The invoice binaries remain outside Git.

## Files being uploaded

| Invoice | Purpose | Amount | Status |
|---|---|---:|---|
| 0103 | Monthly physical space and energy usage for Solar Datacenter Site #1 | $2,570.94 | Paid |
| 0104 | Installation fee for Solar Site #1 | $500.00 | Paid |
| **Total** |  | **$3,070.94** | **Paid** |

These are financial records. They are deliberately routed to:

`raw/99_restricted/avaron/2026-07-10/`

The upload metadata sets `sensitivity=restricted` and `index_allowed=false`. Do not send these documents to Azure AI Search or the normal AI-analysis pipeline.

## Do this once

1. Install Azure CLI if it is not already installed.
2. Place the two verified PDFs in `restricted_inputs/avaron/2026-07-10/`; this directory is ignored by Git.
3. Copy and edit the sanitized runtime configuration.
4. Run the correct command below from the repository root.

### Windows PowerShell

```powershell
Copy-Item .\config\azure.env.example .\config\azure.env
notepad .\config\azure.env
az login
PowerShell -ExecutionPolicy Bypass -File .\scripts\upload_receipts.ps1
```

### Mac or Linux

```bash
cp ./config/azure.env.example ./config/azure.env
nano ./config/azure.env
az login
bash ./scripts/upload_receipts.sh
```

The scripts fail closed unless the Blob prefix is exactly `raw/99_restricted/avaron/2026-07-10`. They:

- open Azure login if needed;
- create the container as private if it does not exist;
- calculate each PDF's SHA-256 hash;
- skip a blob that already exists;
- upload both PDFs with restricted metadata;
- print the uploaded blobs for verification.

## Required Azure permission

Your signed-in account needs a Blob data role such as **Storage Blob Data Contributor** on the storage account or container.

## Expected result

```text
<container>/raw/99_restricted/avaron/2026-07-10/Invoice-0103.pdf
<container>/raw/99_restricted/avaron/2026-07-10/Invoice-0104.pdf
```

## General Gmail automation

See `docs/document-workflow-architecture.md`. The reusable pipeline handles approved Gmail messages, SHA-256 deduplication, extraction, manifests, reports, and mandatory restricted-document exclusions.
