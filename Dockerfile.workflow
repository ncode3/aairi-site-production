FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY config ./config
COPY inventory ./inventory
COPY scripts ./scripts
COPY src ./src
ENTRYPOINT ["bash", "scripts/run_ingestion.sh"]
