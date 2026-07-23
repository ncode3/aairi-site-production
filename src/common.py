from __future__ import annotations

import fnmatch
import hashlib
import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Iterable

import yaml


def configure_logging(verbose: bool = False) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )


def load_yaml(path: str | Path) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def safe_filename(value: str, max_length: int = 180) -> str:
    value = value.replace("&amp;", "and")
    value = re.sub(r"[<>:\\|?*\x00-\x1f]", "_", value)
    value = re.sub(r"\s+", " ", value).strip(" .")
    if not value:
        value = "unnamed"
    stem, suffix = os.path.splitext(value)
    keep = max_length - len(suffix)
    return f"{stem[:keep]}{suffix}"


def match_any(value: str, patterns: Iterable[str]) -> bool:
    lowered = value.lower()
    return any(fnmatch.fnmatch(lowered, pattern.lower()) for pattern in patterns)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def classify_category(filename: str, subject: str, config: dict[str, Any]) -> str:
    haystack = f"{filename} {subject}"
    for category, patterns in config.get("category_rules", {}).items():
        if match_any(haystack, patterns):
            return category
    return "05_plans_budgets_architecture"


def is_restricted(filename: str, subject: str, config: dict[str, Any], sender: str = "") -> bool:
    sender_patterns = config.get("restricted_sources", {}).get("senders", [])
    return (
        match_any(f"{filename} {subject}", config.get("restricted_patterns", []))
        or bool(sender and match_any(sender, sender_patterns))
    )


def document_type(filename: str) -> str:
    lowered = filename.lower()
    for kind in ("invoice", "receipt", "resume", "agreement", "budget", "curriculum", "grant"):
        if kind in lowered:
            return kind
    return Path(filename).suffix.lower().lstrip(".") or "document"


def processing_allowed(metadata: dict[str, str], blob_name: str = "") -> bool:
    return (
        metadata.get("sensitivity", "").lower() != "restricted"
        and metadata.get("index_allowed", "false").lower() == "true"
        and not blob_name.startswith("raw/99_restricted/")
        and "/99_restricted/" not in blob_name
    )


def should_include_filename(filename: str, config: dict[str, Any]) -> bool:
    ext = Path(filename).suffix.lower()
    if ext not in set(config.get("allowed_extensions", [])):
        return False
    if match_any(filename, config.get("exclude_filename_patterns", [])):
        return False
    return match_any(filename, config.get("include_filename_patterns", []))


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, default=str)


def azure_metadata(value: str, max_length: int = 1500) -> str:
    # Azure metadata must remain simple ASCII-compatible strings.
    value = value.encode("ascii", errors="ignore").decode("ascii")
    value = re.sub(r"\s+", " ", value).strip()
    return value[:max_length]
