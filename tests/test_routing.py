from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ingest_gmail_to_blob import make_blob_name


def test_avaron_restricted_route():
    from datetime import datetime, timezone

    name = make_blob_name(
        "02_grants_funding",
        datetime(2026, 7, 10, tzinfo=timezone.utc),
        "Invoice-0103.pdf",
        "0" * 64,
        True,
    )
    assert name.startswith("raw/99_restricted/")


def test_hash_in_blob_name_is_stable():
    from datetime import datetime, timezone

    when = datetime(2026, 1, 1, tzinfo=timezone.utc)
    first = make_blob_name("04_curriculum_training", when, "AARI Curriculum.pdf", "a" * 64, False)
    second = make_blob_name("04_curriculum_training", when, "AARI Curriculum.pdf", "a" * 64, False)
    assert first == second
