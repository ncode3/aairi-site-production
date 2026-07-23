$ErrorActionPreference = "Stop"
python src/ingest_gmail_to_blob.py --config config/selection.yaml @args
python src/extract_documents.py
python src/generate_insights.py
