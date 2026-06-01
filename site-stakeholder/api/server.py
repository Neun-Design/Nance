import os
from pathlib import Path
from typing import Literal

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

SOURCES_DIR = Path(__file__).parent.parent.parent / "sourceFiles"


def _load_knowledge_base() -> str:
    chunks = []
    for md_file in sorted(SOURCES_DIR.glob("*.md")):
        chunks.append(f"## {md_file.name}\n\n{md_file.read_text(encoding='utf-8')}")
    return "\n\n---\n\n".join(chunks)


_KNOWLEDGE_BASE = _load_knowledge_base()

_SYSTEM_PROMPT = f"""You are an expert assistant for EDQMS (Event Driven Quality Management System), \
an ISO 9001:2015-aligned quality management framework built for Northwind Energy stakeholders. \
Answer questions clearly and concisely using the project documentation provided below. \
If a question falls outside the documentation, say so honestly and suggest the stakeholder contact the project team.

<documentation>
{_KNOWLEDGE_BASE}
</documentation>"""

app = FastAPI(title="EDQMS Chat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
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


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages must not be empty")
    response = _client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[m.model_dump() for m in request.messages],
    )
    return ChatResponse(reply=response.content[0].text)
