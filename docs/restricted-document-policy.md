# Security Rules

1. Keep the Blob container private.
2. Use Microsoft Entra login, managed identity, or `DefaultAzureCredential`; do not commit account keys or connection strings.
3. Put invoices, receipts, banking records, tax records, personally identifiable information, and signed financial documents under `raw/99_restricted/`.
4. Any file with `index_allowed=false` must not enter Azure AI Search, Azure OpenAI analysis, or a public knowledge base.
5. Keep OAuth tokens, `.env`, `azure.env`, and local credential caches out of Git.
6. Preserve SHA-256 hashes and ingestion manifests for auditability and deduplication.
7. Give users and automation identities only the minimum Blob roles they require.
