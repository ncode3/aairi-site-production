from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from common import classify_category, document_type, is_restricted, processing_allowed, safe_filename, sha256_bytes, should_include_filename


CONFIG = {
    "allowed_extensions": [".pdf", ".xlsx"],
    "include_filename_patterns": ["AARI*", "*Budget*", "*Resume*"],
    "exclude_filename_patterns": ["*ticket.pdf"],
    "restricted_patterns": ["*Resume*", "*W9*"],
    "category_rules": {
        "02_grants_funding": ["*Grant*", "*Budget*"],
        "04_curriculum_training": ["*Curriculum*"],
    },
}


def test_safe_filename_removes_invalid_characters():
    assert safe_filename('AARI: Budget?.xlsx') == 'AARI_ Budget_.xlsx'


def test_sha256_is_stable():
    assert sha256_bytes(b"aari") == sha256_bytes(b"aari")
    assert sha256_bytes(b"aari") != sha256_bytes(b"AARI")


def test_filtering():
    assert should_include_filename("AARI_Budget.xlsx", CONFIG)
    assert not should_include_filename("event-ticket.pdf", CONFIG)
    assert not should_include_filename("photo.jpg", CONFIG)


def test_restricted_classification():
    assert is_restricted("Student Resume.pdf", "Resumes", CONFIG)
    assert not is_restricted("AARI_Budget.xlsx", "Data center budget", CONFIG)


def test_restricted_sender_classification():
    config = {**CONFIG, "restricted_sources": {"senders": ["*@avaron.*"]}}
    assert is_restricted("statement.pdf", "Account", config, "Accounts <billing@avaron.example>")


def test_category_classification():
    assert classify_category("Data Center Budget.xlsx", "Budget", CONFIG) == "02_grants_funding"


def test_restricted_documents_are_never_ai_processable():
    assert not processing_allowed({"sensitivity": "restricted", "index_allowed": "true"}, "processed/x.json")
    assert not processing_allowed({"sensitivity": "internal", "index_allowed": "false"}, "processed/x.json")
    assert not processing_allowed({"sensitivity": "internal", "index_allowed": "true"}, "raw/99_restricted/x.pdf")
    assert processing_allowed({"sensitivity": "internal", "index_allowed": "true"}, "processed/04_curriculum/x.json")


def test_document_type():
    assert document_type("Invoice-0103.pdf") == "invoice"
