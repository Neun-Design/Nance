# EDQMS chatbot API — portable image for Fly.io / Cloud Run / Railway.
# Build context must be the REPO ROOT (the system prompt embeds CLAUDE.md,
# sourceFiles/*.md and the stakeholder docs):
#   docker build -f site-stakeholder/api/Dockerfile -t edqms-chat-api .
#   docker run -p 8001:8001 -e ANTHROPIC_API_KEY=sk-... edqms-chat-api
FROM python:3.12-slim

WORKDIR /app
COPY site-stakeholder/api/requirements.txt site-stakeholder/api/requirements.txt
RUN pip install --no-cache-dir -r site-stakeholder/api/requirements.txt

COPY CLAUDE.md CLAUDE.md
COPY sourceFiles/*.md sourceFiles/
COPY site-stakeholder/docs site-stakeholder/docs
COPY site-stakeholder/api site-stakeholder/api

WORKDIR /app/site-stakeholder
EXPOSE 8001
# Shell form so $PORT from the platform (Cloud Run/Railway) is honoured.
CMD uvicorn api.server:app --host 0.0.0.0 --port ${PORT:-8001} --proxy-headers
