# Optional Azure AI Search Layer

The included scripts already generate batch insights. Add Azure AI Search when you want conversational retrieval over the document set.

## Recommended pattern

1. Use the `processed/` Blob prefix as the search source, not raw attachments.
2. Create an Azure AI Search index with these fields:
   - `id`
   - `content`
   - `title`
   - `source_blob`
   - `category`
   - `source_date`
   - `sensitivity`
   - `index_allowed`
   - `partners`
   - `topics`
   - `content_vector`
3. Configure a Blob indexer restricted to `processed/`.
4. Add an integrated vectorization skillset using an Azure OpenAI embedding deployment.
5. Filter every query with `index_allowed eq true` and `sensitivity ne 'restricted'`.
6. Use hybrid retrieval: keyword + vector + semantic ranking.
7. Return source blob names in every answer so decisions remain auditable.

## Recommended retrieval questions

- Which grants are awarded, received, pending, or merely proposed?
- What partner commitments have no clear owner or next action?
- Which curriculum version should be treated as canonical?
- Where do budgets conflict with build plans or grant restrictions?
- Which external claims lack supporting documentation?
- Which deadlines, reporting obligations, and compliance documents are missing?
- Where are curriculum topics duplicated, absent, or sequenced incorrectly?
