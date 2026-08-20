# EDQMS Chat API

FastAPI backend for the **Ask AI** widget on the stakeholder site. On startup it
builds the assistant's system prompt from three sources, so its knowledge always
matches the repo state at deploy time:

| Source | Role |
|---|---|
| `site-stakeholder/docs/**/*.md` | Primary — the stakeholder site content |
| `sourceFiles/*.md` (top level only) | Technical reference documents |
| `CLAUDE.md` (repo root) | Project knowledge base — architecture and design-decision history |

**Live service:** <https://edqms-chat-api.onrender.com> (Render free plan, since
2026-08-20). The published site's Ask AI widget talks to it; check
[`/healthz`](https://edqms-chat-api.onrender.com/healthz) if it seems down.

## Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | `{"messages": [{"role": "user"|"assistant", "content": "…"}]}` → `{"reply": "…"}` |
| `/healthz` | GET | Liveness probe for the hosting platform |

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — (required) | Anthropic API key. Locally read from `site-stakeholder/.env`; in hosting, set as a platform secret. |
| `EDQMS_ALLOWED_ORIGINS` | `http://localhost:8000,http://127.0.0.1:8000,https://bovarafa.github.io` | Comma-separated CORS allowlist |
| `EDQMS_RATE_LIMIT_REQUESTS` | `20` | Requests allowed per client per window |
| `EDQMS_RATE_LIMIT_WINDOW_SECONDS` | `300` | Rate-limit window size |

Abuse containment (each request calls the Anthropic API): per-client sliding-window
rate limit, plus payload caps of 40 messages / 20 000 characters per conversation.

## Run locally

From `site-stakeholder/`:

```bash
ANTHROPIC_API_KEY=sk-... bash start.sh   # API on :8001 + mkdocs on :8000
# or just the API:
uvicorn api.server:app --port 8001
```

## Deploy — Render (default)

The production service `edqms-chat-api` is already running from the `render.yaml`
blueprint at the repo root. To recreate it (new account or fork):

1. In Render: **New → Blueprint**, connect the `BOVArafa/EDQMS` repo. It creates
   the `edqms-chat-api` web service (free plan, Python 3.12).
2. Set the `ANTHROPIC_API_KEY` secret when prompted (the blueprint marks it
   `sync: false`, so it is never committed).
3. After the first deploy, confirm `https://<service>.onrender.com/healthz`
   returns `{"status":"ok"}`.

The widget (`docs/javascripts/chatbot.js`) points at
`https://edqms-chat-api.onrender.com/api/chat` when the page is not served from
localhost — this matches the live service, so no widget change is needed. If a
recreated service gets a different hostname, update `PUBLIC_API_URL` there and
republish the stakeholder site (`gh workflow run deploy-stakeholder.yml`).

> Free-plan note: the service spins down when idle; the first question after a
> quiet period takes ~30–60 s while it wakes up. Upgrade the plan if that
> matters for a demo.

## Deploy — Docker (Fly.io / Cloud Run / Railway)

`site-stakeholder/api/Dockerfile` builds a self-contained image. The build
context must be the **repo root** so the markdown sources are embedded:

```bash
docker build -f site-stakeholder/api/Dockerfile -t edqms-chat-api .
docker run -p 8001:8001 -e ANTHROPIC_API_KEY=sk-... edqms-chat-api
```

The container honours the platform's `$PORT`. Remember to set
`EDQMS_ALLOWED_ORIGINS` if the site is served from a new origin.

## Keeping the knowledge fresh

The system prompt is built **once at startup** from the markdown files present
in the deploy. Render redeploys on pushes to `main` that touch
`site-stakeholder/**`, `sourceFiles/**` or `CLAUDE.md` (see `buildFilter`), so
the assistant tracks the documentation automatically. For Docker hosts, rebuild
the image when those files change.
