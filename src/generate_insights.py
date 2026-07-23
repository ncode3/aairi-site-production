from __future__ import annotations

import argparse
import csv
import io
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from azure.storage.blob import BlobServiceClient, ContentSettings
from openai import AzureOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from common import configure_logging, processing_allowed


def blob_service() -> BlobServiceClient:
    return BlobServiceClient(
        account_url=os.environ["AZURE_STORAGE_ACCOUNT_URL"],
        credential=DefaultAzureCredential(),
    )


def openai_client() -> AzureOpenAI:
    endpoint = os.environ["AZURE_OPENAI_ENDPOINT"]
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21")
    key = os.getenv("AZURE_OPENAI_API_KEY")
    if key:
        return AzureOpenAI(azure_endpoint=endpoint, api_version=api_version, api_key=key)
    provider = get_bearer_token_provider(
        DefaultAzureCredential(),
        "https://cognitiveservices.azure.com/.default",
    )
    return AzureOpenAI(
        azure_endpoint=endpoint,
        api_version=api_version,
        azure_ad_token_provider=provider,
    )


@retry(stop=stop_after_attempt(4), wait=wait_exponential(multiplier=1, min=2, max=30))
def json_completion(client: AzureOpenAI, system: str, user: str) -> dict[str, Any]:
    response = client.chat.completions.create(
        model=os.environ["AZURE_OPENAI_DEPLOYMENT"],
        temperature=0.1,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    content = response.choices[0].message.content or "{}"
    return json.loads(content)


def summarize_document(client: AzureOpenAI, record: dict[str, Any]) -> dict[str, Any]:
    text = record.get("content", "")
    metadata = record.get("source_metadata", {})
    prompt = f"""
Document metadata:
{json.dumps(metadata, ensure_ascii=False)}
Source blob: {record.get('source_blob')}

Document content:
{text[:60000]}

Return JSON with these keys:
- title
- document_type
- executive_summary
- partners: list of organizations or people central to the document
- amounts: list of objects with amount, currency, purpose, and confidence
- dates: list of objects with date, event, and confidence
- commitments: list of explicit commitments, requirements, deliverables, or obligations
- action_items: list of objects with action, owner, due_date, status, evidence
- risks: list of objects with risk, severity, evidence, mitigation
- claims_needing_evidence: list of claims that should be verified before external use
- topics: list of concise topic labels
- possible_duplicates_or_versions: list of version clues
Do not invent missing facts. Use null where information is absent.
"""
    result = json_completion(
        client,
        "You are an exacting nonprofit operations and AI-infrastructure analyst. Extract only supported facts.",
        prompt,
    )
    result["source_blob"] = record.get("source_blob")
    result["source_metadata"] = metadata
    return result


def aggregate(client: AzureOpenAI, summaries: list[dict[str, Any]]) -> dict[str, Any]:
    payload = json.dumps(summaries, ensure_ascii=False)
    if len(payload) > 220000:
        payload = payload[:220000]
    prompt = f"""
Analyze this set of AARI document summaries:
{payload}

Return JSON with exactly these keys:
1. executive_brief_markdown: a concise executive brief covering funding, partnerships, programs, infrastructure, immediate actions, and major risks.
2. funding_summary: list of objects with funder, amount, status, purpose, date, and source_blob.
3. partner_map: list of objects with partner, relationship, commitments, next_step, and source_blobs.
4. action_register: list of objects with priority, action, owner, due_date, status, source_blob, and rationale.
5. curriculum_gap_analysis: list of objects with capability, covered, gap, recommendation, and source_blobs.
6. conflicts_and_stale_documents: list of objects with issue, documents, recommended_canonical_version, and resolution.
7. risk_register: list of objects with severity, risk, evidence, mitigation, owner, and source_blob.
8. strategic_insights: list of concise, non-obvious cross-document findings.

Rules:
- Do not total funding unless amounts are clearly awarded or received.
- Separate awarded, received, pending, and proposed amounts.
- Flag contradictions and version drift.
- Do not expose personal phone numbers, bank data, tax IDs, student IDs, or home addresses.
- Do not infer protected characteristics.
"""
    return json_completion(
        client,
        "You synthesize organizational records into defensible decisions. Every conclusion must trace to source documents.",
        prompt,
    )


def write_csv(rows: list[dict[str, Any]]) -> bytes:
    if not rows:
        return b""
    keys = sorted({k for row in rows for k in row})
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=keys)
    writer.writeheader()
    for row in rows:
        writer.writerow({k: json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else v for k, v in row.items()})
    return buffer.getvalue().encode("utf-8")


def upload(container, name: str, data: bytes, content_type: str) -> None:
    container.upload_blob(
        name,
        data,
        overwrite=True,
        content_settings=ContentSettings(content_type=content_type),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate cross-document AARI insights with Azure OpenAI.")
    parser.add_argument("--prefix", default="processed/")
    parser.add_argument("--max-documents", type=int, default=100)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    configure_logging(args.verbose)

    service = blob_service()
    container = service.get_container_client(os.getenv("AZURE_STORAGE_CONTAINER", "aari-knowledge-base"))
    client = openai_client()

    summaries: list[dict[str, Any]] = []
    for blob in container.list_blobs(name_starts_with=args.prefix, include=["metadata"]):
        if not blob.name.endswith(".json"):
            continue
        metadata = blob.metadata or {}
        if not processing_allowed(metadata, blob.name):
            logging.info("Policy skip (not AI-processable): %s", blob.name)
            continue
        record = json.loads(container.get_blob_client(blob.name).download_blob().readall())
        summaries.append(summarize_document(client, record))
        logging.info("Analyzed %s", blob.name)
        if len(summaries) >= args.max_documents:
            break

    result = aggregate(client, summaries)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    root = f"insights/{stamp}"
    upload(container, f"{root}/document_summaries.json", json.dumps(summaries, ensure_ascii=False, indent=2).encode("utf-8"), "application/json")
    upload(container, f"{root}/full_analysis.json", json.dumps(result, ensure_ascii=False, indent=2).encode("utf-8"), "application/json")
    upload(container, f"{root}/executive_brief.md", result.get("executive_brief_markdown", "").encode("utf-8"), "text/markdown")
    upload(container, f"{root}/action_register.csv", write_csv(result.get("action_register", [])), "text/csv")
    upload(container, f"{root}/funding_summary.csv", write_csv(result.get("funding_summary", [])), "text/csv")
    upload(container, f"{root}/partner_map.json", json.dumps(result.get("partner_map", []), ensure_ascii=False, indent=2).encode("utf-8"), "application/json")
    upload(container, f"{root}/document_conflicts.csv", write_csv(result.get("conflicts_and_stale_documents", [])), "text/csv")
    upload(container, f"{root}/risk_register.csv", write_csv(result.get("risk_register", [])), "text/csv")
    upload(container, f"{root}/curriculum_gap_analysis.csv", write_csv(result.get("curriculum_gap_analysis", [])), "text/csv")
    logging.info("Insight package uploaded to %s", root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
