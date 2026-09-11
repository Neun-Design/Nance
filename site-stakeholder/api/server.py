import os
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Literal

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

_ROOT = Path(__file__).parent.parent.parent
SITE_DOCS_DIR = _ROOT / "site-stakeholder" / "docs"
SOURCES_DIR = _ROOT / "sourceFiles"
PROJECT_KNOWLEDGE_FILE = _ROOT / "CLAUDE.md"
# The public demo's domain pack (Vitalis Health Network) — lets the assistant
# explain exactly what a visitor is looking at in the demo, entity by entity.
DEMO_DOMAIN_DIR = _ROOT / "prototype" / "tools" / "seed"

# Comma-separated list; overridable so a fork or a new host can allow its own origin.
_DEFAULT_ORIGINS = (
    "http://localhost:8000,http://127.0.0.1:8000,https://neun-design.github.io"
)
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("EDQMS_ALLOWED_ORIGINS", _DEFAULT_ORIGINS).split(",")
    if origin.strip()
]

# Basic abuse containment for the public endpoint (each request calls the
# Anthropic API): sliding-window per-client limit + payload size caps.
RATE_LIMIT_REQUESTS = int(os.environ.get("EDQMS_RATE_LIMIT_REQUESTS", "20"))
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("EDQMS_RATE_LIMIT_WINDOW_SECONDS", "300"))
MAX_MESSAGES = 40
MAX_TOTAL_CHARS = 20_000

_request_log: dict[str, deque] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    # Behind Render/Cloud Run the client is in X-Forwarded-For (uvicorn only
    # rewrites request.client with --proxy-headers, so read the header directly).
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _enforce_rate_limit(client_ip: str) -> None:
    now = time.monotonic()
    log = _request_log[client_ip]
    while log and now - log[0] > RATE_LIMIT_WINDOW_SECONDS:
        log.popleft()
    if len(log) >= RATE_LIMIT_REQUESTS:
        raise HTTPException(
            status_code=429,
            detail="Too many requests — please wait a few minutes and try again.",
        )
    log.append(now)


def _load_site_content() -> str:
    chunks = []
    for md_file in sorted(SITE_DOCS_DIR.rglob("*.md")):
        rel = md_file.relative_to(SITE_DOCS_DIR)
        chunks.append(f"### {rel}\n\n{md_file.read_text(encoding='utf-8')}")
    return "\n\n---\n\n".join(chunks)


def _load_reference_sources() -> str:
    # Disabled: the former sourceFiles/*.md set held client/consulting material
    # (proposals, engagement docs, business model) and must never reach the
    # public assistant. Reference content will return from a vetted, client-free
    # source once curated.
    return ""


def _load_project_knowledge() -> str:
    # Disabled for the public assistant: CLAUDE.md is the internal engineering
    # log (client references, internal file paths, PR numbers) and is not fit to
    # serve publicly. Re-introduce a vetted, client-free subset if "how/why it
    # works" depth is later needed.
    return ""


def _load_demo_domain() -> str:
    chunks = []
    for name in ("domains/clinic.yaml", "narrative.md"):
        f = DEMO_DOMAIN_DIR / name
        if f.exists():
            chunks.append(f"### {name}\n\n{f.read_text(encoding='utf-8')}")
    return "\n\n---\n\n".join(chunks)


_SITE_CONTENT = _load_site_content()
_REFERENCE_SOURCES = _load_reference_sources()
_PROJECT_KNOWLEDGE = _load_project_knowledge()
_DEMO_DOMAIN = _load_demo_domain()

_SYSTEM_PROMPT = f"""You are an expert assistant for EDQMS (Event Driven Quality Management System), \
an open-source, ISO 9001:2015-aligned quality management platform. \
Answer questions clearly and concisely using the documentation provided below. \
The stakeholder site content is your primary source. \
The PUBLIC DEMO at /app/ shows the Vitalis Health Network — a FICTITIOUS chain of diagnostic \
clinics generated for demonstration; when a visitor asks about something they see in the demo \
(an exam, an insurer contract, a requirement like ANVISA RDC 611, one of the planted stories), \
answer from the demo domain pack below and make clear the data is fictitious. \
The platform itself is sector-agnostic and industry-neutral; do NOT name, confirm or hint at any specific real customer, client or deployment, and treat any such reference that may appear in the source text below as redacted. \
Use the reference documents only to provide additional technical depth or to resolve gaps not covered by the site. \
The project knowledge base is the engineering log of the system — its data model, design decisions and their \
rationale; draw on it when the stakeholder asks how or why something works the way it does, but never expose \
internal file paths, pull-request numbers or tooling details in your answers. \
If a question falls outside the documentation, say so honestly and suggest the stakeholder contact the project team.

<primary_source title="Stakeholder Site Content">
{_SITE_CONTENT}
</primary_source>

<demo_domain title="Public Demo Domain Pack — Vitalis Health Network (fictitious)">
{_DEMO_DOMAIN}
</demo_domain>

<reference_sources title="Technical Reference Documents">
{_REFERENCE_SOURCES}
</reference_sources>

<project_knowledge title="Project Knowledge Base — architecture and design decisions">
{_PROJECT_KNOWLEDGE}
</project_knowledge>"""

app = FastAPI(title="EDQMS Chat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

_client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


class ChatResponse(BaseModel):
    reply: str


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest, http_request: Request) -> ChatResponse:
    _enforce_rate_limit(_client_ip(http_request))
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages must not be empty")
    if len(request.messages) > MAX_MESSAGES:
        raise HTTPException(status_code=413, detail="conversation is too long")
    if sum(len(m.content) for m in request.messages) > MAX_TOTAL_CHARS:
        raise HTTPException(status_code=413, detail="conversation is too large")
    response = _client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[m.model_dump() for m in request.messages],
    )
    return ChatResponse(reply=response.content[0].text)
