from __future__ import annotations

import argparse
import base64
import csv
import html
import io
import json
import logging
import os
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any, Iterator

from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient, ContentSettings
from bs4 import BeautifulSoup
from google.auth.transport.requests import Request
from google.oauth2 import credentials as user_credentials
from google.oauth2 import service_account
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from tenacity import retry, stop_after_attempt, wait_exponential

from common import (
    azure_metadata,
    classify_category,
    configure_logging,
    document_type,
    is_restricted,
    load_yaml,
    match_any,
    safe_filename,
    sha256_bytes,
    should_include_filename,
)

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def build_gmail_service():
    mode = os.getenv("GMAIL_AUTH_MODE", "oauth").strip().lower()
    if mode == "service_account":
        path = os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
        user = os.environ["GMAIL_IMPERSONATE_USER"]
        creds = service_account.Credentials.from_service_account_file(path, scopes=SCOPES)
        creds = creds.with_subject(user)
        return build("gmail", "v1", credentials=creds, cache_discovery=False)

    credentials_path = os.getenv("GMAIL_CREDENTIALS_PATH", "./secrets/client_secret.json")
    token_path = Path(os.getenv("GMAIL_TOKEN_PATH", "./secrets/token.json"))
    creds = None
    if token_path.exists():
        creds = user_credentials.Credentials.from_authorized_user_file(str(token_path), SCOPES)
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    if not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
        creds = flow.run_local_server(port=0)
        token_path.parent.mkdir(parents=True, exist_ok=True)
        token_path.write_text(creds.to_json(), encoding="utf-8")
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def build_blob_service() -> BlobServiceClient:
    account_url = os.environ["AZURE_STORAGE_ACCOUNT_URL"]
    return BlobServiceClient(account_url=account_url, credential=DefaultAzureCredential())


@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=1, max=20))
def gmail_execute(request):
    return request.execute()


def list_message_ids(service, user_id: str, query: str) -> Iterator[str]:
    page_token = None
    while True:
        response = gmail_execute(
            service.users().messages().list(
                userId=user_id,
                q=query,
                maxResults=500,
                pageToken=page_token,
            )
        )
        for item in response.get("messages", []):
            yield item["id"]
        page_token = response.get("nextPageToken")
        if not page_token:
            return


def header_map(message: dict[str, Any]) -> dict[str, str]:
    return {
        h.get("name", "").lower(): h.get("value", "")
        for h in message.get("payload", {}).get("headers", [])
    }


def decode_b64url(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def walk_parts(part: dict[str, Any]) -> Iterator[dict[str, Any]]:
    yield part
    for child in part.get("parts", []) or []:
        yield from walk_parts(child)


def extract_body_text(message: dict[str, Any]) -> str:
    plain: list[str] = []
    rich: list[str] = []
    for part in walk_parts(message.get("payload", {})):
        mime = part.get("mimeType", "")
        data = part.get("body", {}).get("data")
        if not data:
            continue
        text = decode_b64url(data).decode("utf-8", errors="replace")
        if mime == "text/plain":
            plain.append(text)
        elif mime == "text/html":
            rich.append(BeautifulSoup(text, "html.parser").get_text("\n"))
    body = "\n".join(plain or rich)
    body = html.unescape(body)
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    return body


def parse_message_date(headers: dict[str, str], internal_date: str | None) -> datetime:
    try:
        if headers.get("date"):
            return parsedate_to_datetime(headers["date"]).astimezone(timezone.utc)
    except Exception:
        pass
    if internal_date:
        return datetime.fromtimestamp(int(internal_date) / 1000, tz=timezone.utc)
    return datetime.now(timezone.utc)


def download_part(service, user_id: str, message_id: str, part: dict[str, Any]) -> bytes:
    body = part.get("body", {})
    if body.get("data"):
        return decode_b64url(body["data"])
    attachment_id = body.get("attachmentId")
    if not attachment_id:
        return b""
    response = gmail_execute(
        service.users().messages().attachments().get(
            userId=user_id,
            messageId=message_id,
            id=attachment_id,
        )
    )
    return decode_b64url(response["data"])


def make_blob_name(category: str, date: datetime, filename: str, digest: str, restricted: bool) -> str:
    folder = "99_restricted" if restricted else category
    safe = safe_filename(filename)
    stem, ext = os.path.splitext(safe)
    return f"raw/{folder}/{date:%Y}/{stem}__{digest[:10]}{ext.lower()}"


def upload_bytes(container, blob_name: str, data: bytes, mime: str, metadata: dict[str, str]) -> None:
    container.upload_blob(
        name=blob_name,
        data=data,
        overwrite=False,
        metadata=metadata,
        content_settings=ContentSettings(content_type=mime or "application/octet-stream"),
    )


def write_manifest(rows: list[dict[str, Any]], output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    jsonl_path = output_dir / "ingestion_manifest.jsonl"
    csv_path = output_dir / "ingestion_manifest.csv"
    with jsonl_path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
    keys = sorted({key for row in rows for key in row})
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(rows)
    return jsonl_path, csv_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Curate Gmail documents and upload them to Azure Blob Storage.")
    parser.add_argument("--config", default="config/selection.yaml")
    parser.add_argument("--output-dir", default="run_output")
    parser.add_argument("--include-restricted", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    configure_logging(args.verbose)

    config = load_yaml(args.config)
    service = build_gmail_service()
    user_id = os.getenv("GMAIL_USER", "me")

    container = None
    if not args.dry_run:
        blob_service = build_blob_service()
        container_name = os.getenv("AZURE_STORAGE_CONTAINER", "aari-knowledge-base")
        container = blob_service.get_container_client(container_name)
        try:
            container.create_container()
        except Exception as exc:
            if "ContainerAlreadyExists" not in str(exc):
                logging.debug("Container create returned: %s", exc)

    seen_message_ids: set[str] = set()
    seen_hashes: set[str] = set()
    rows: list[dict[str, Any]] = []

    if container:
        for existing in container.list_blobs(name_starts_with="raw/", include=["metadata"]):
            digest = (existing.metadata or {}).get("sha256")
            if digest:
                seen_hashes.add(digest.lower())

    for query in config.get("queries", []):
        logging.info("Gmail query: %s", query)
        for message_id in list_message_ids(service, user_id, query):
            if message_id in seen_message_ids:
                continue
            seen_message_ids.add(message_id)
            message = gmail_execute(
                service.users().messages().get(userId=user_id, id=message_id, format="full")
            )
            headers = header_map(message)
            subject = headers.get("subject", "(no subject)")
            date = parse_message_date(headers, message.get("internalDate"))

            if match_any(subject, config.get("include_subject_patterns", [])):
                body = extract_body_text(message)
                if body:
                    data = (
                        f"# {subject}\n\n"
                        f"- Date: {date.isoformat()}\n"
                        f"- From: {headers.get('from', '')}\n"
                        f"- To: {headers.get('to', '')}\n\n"
                        f"{body}\n"
                    ).encode("utf-8")
                    digest = sha256_bytes(data)
                    filename = safe_filename(f"{date:%Y-%m-%d} - {subject}.md")
                    category = classify_category(filename, subject, config)
                    restricted = is_restricted(filename, subject, config, headers.get("from", ""))
                    if not restricted or args.include_restricted:
                        blob_name = make_blob_name(category, date, filename, digest, restricted)
                        metadata = {
                            "source": "gmail_email_body",
                            "source_subject": azure_metadata(subject),
                            "source_date": date.date().isoformat(),
                            "original_filename": azure_metadata(filename),
                            "sha256": digest,
                            "category": "99_restricted" if restricted else category,
                            "sensitivity": "restricted" if restricted else "internal",
                            "index_allowed": "false" if restricted else "true",
                            "document_type": "email",
                        }
                        if digest not in seen_hashes:
                            if not args.dry_run:
                                upload_bytes(container, blob_name, data, "text/markdown", metadata)
                            seen_hashes.add(digest)
                            rows.append({**metadata, "blob_name": blob_name, "size_bytes": len(data), "status": "dry_run" if args.dry_run else "uploaded"})
                        else:
                            rows.append({**metadata, "blob_name": blob_name, "size_bytes": len(data), "status": "duplicate_rejected"})

            for part in walk_parts(message.get("payload", {})):
                filename = part.get("filename", "")
                if not filename or not should_include_filename(filename, config):
                    continue
                restricted = is_restricted(filename, subject, config, headers.get("from", ""))
                if restricted and not args.include_restricted:
                    rows.append({
                        "source": "gmail_attachment",
                        "source_subject": subject,
                        "source_date": date.date().isoformat(),
                        "original_filename": filename,
                        "category": "99_restricted",
                        "sensitivity": "restricted",
                        "index_allowed": "false",
                        "document_type": document_type(filename),
                        "status": "skipped_restricted",
                    })
                    continue
                data = download_part(service, user_id, message_id, part)
                if not data:
                    continue
                digest = sha256_bytes(data)
                if digest in seen_hashes:
                    rows.append({
                        "source": "gmail_attachment",
                        "source_subject": azure_metadata(subject),
                        "source_date": date.date().isoformat(),
                        "original_filename": azure_metadata(filename),
                        "sha256": digest,
                        "sensitivity": "restricted" if restricted else "internal",
                        "index_allowed": "false" if restricted else "true",
                        "document_type": document_type(filename),
                        "status": "duplicate_rejected",
                    })
                    continue
                seen_hashes.add(digest)
                category = classify_category(filename, subject, config)
                mime = part.get("mimeType", "application/octet-stream")
                blob_name = make_blob_name(category, date, filename, digest, restricted)
                metadata = {
                    "source": "gmail_attachment",
                    "source_subject": azure_metadata(subject),
                    "source_date": date.date().isoformat(),
                    "original_filename": azure_metadata(filename),
                    "sha256": digest,
                    "category": "99_restricted" if restricted else category,
                    "sensitivity": "restricted" if restricted else "internal",
                    "index_allowed": "false" if restricted else "true",
                    "document_type": document_type(filename),
                }
                if not args.dry_run:
                    upload_bytes(container, blob_name, data, mime, metadata)
                rows.append({
                    **metadata,
                    "blob_name": blob_name,
                    "mime_type": mime,
                    "size_bytes": len(data),
                    "status": "dry_run" if args.dry_run else "uploaded",
                })

    jsonl_path, csv_path = write_manifest(rows, Path(args.output_dir))
    logging.info("Manifest rows: %d", len(rows))
    logging.info("Manifest: %s", csv_path)

    if not args.dry_run and container:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        for path in (jsonl_path, csv_path):
            container.upload_blob(
                f"manifests/{stamp}/{path.name}",
                path.read_bytes(),
                overwrite=True,
                content_settings=ContentSettings(content_type="application/jsonl" if path.suffix == ".jsonl" else "text/csv"),
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
