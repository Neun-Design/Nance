/* EDQMS Ask AI chat widget */
(function () {
  // Local dev talks to the uvicorn instance started by start.sh; the published
  // site talks to the hosted API (see site-stakeholder/api/README.md — update
  // PUBLIC_API_URL if the service is deployed under a different host).
  const LOCAL_API_URL = "http://localhost:8001/api/chat";
  const PUBLIC_API_URL = "https://edqms-chat-api.onrender.com/api/chat";
  const IS_LOCAL = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const API_URL = IS_LOCAL ? LOCAL_API_URL : PUBLIC_API_URL;

  let messages = [];
  let busy = false;

  function getElements() {
    return {
      btn: document.getElementById("edqms-chat-btn"),
      panel: document.getElementById("edqms-chat-panel"),
      closeBtn: document.getElementById("edqms-chat-close"),
      msgContainer: document.getElementById("edqms-chat-messages"),
      input: document.getElementById("edqms-chat-input"),
      sendBtn: document.getElementById("edqms-chat-send"),
    };
  }

  function appendMessage(role, text) {
    const { msgContainer } = getElements();
    const div = document.createElement("div");
    div.className = `edqms-msg ${role}`;
    if (role === "assistant" && typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
      div.innerHTML = DOMPurify.sanitize(marked.parse(text));
    } else {
      div.textContent = text;
    }
    msgContainer.appendChild(div);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    return div;
  }

  function watchFooter() {
    const btn = document.getElementById("edqms-chat-btn");
    const panel = document.getElementById("edqms-chat-panel");
    const footer = document.querySelector(".md-footer");
    if (!btn || !footer) return;

    const adjust = () => {
      const rect = footer.getBoundingClientRect();
      const overlap = Math.max(0, window.innerHeight - rect.top);
      const extra = overlap > 0 ? overlap + 8 : 0;
      btn.style.bottom = `calc(1.5rem + ${extra}px)`;
      panel.style.bottom = `calc(5rem + ${extra}px)`;
    };

    window.addEventListener("scroll", adjust, { passive: true });
    window.addEventListener("resize", adjust, { passive: true });
    adjust();
  }

  async function sendMessage() {
    if (busy) return;
    const { input, sendBtn, msgContainer } = getElements();
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    messages.push({ role: "user", content: text });
    appendMessage("user", text);

    busy = true;
    sendBtn.disabled = true;

    const thinking = document.createElement("div");
    thinking.className = "edqms-msg thinking";
    thinking.textContent = "Thinking…";
    msgContainer.appendChild(thinking);
    msgContainer.scrollTop = msgContainer.scrollHeight;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      thinking.remove();

      if (!res.ok) {
        let detail = await res.text();
        try {
          detail = JSON.parse(detail).detail || detail;
        } catch (_) {
          // keep the raw text
        }
        appendMessage("error", `Error ${res.status}: ${detail}`);
      } else {
        const data = await res.json();
        messages.push({ role: "assistant", content: data.reply });
        appendMessage("assistant", data.reply);
      }
    } catch (e) {
      thinking.remove();
      appendMessage(
        "error",
        IS_LOCAL
          ? "Could not reach the AI server. Make sure it is running on port 8001."
          : "The AI assistant is temporarily unavailable. Please try again later."
      );
    } finally {
      busy = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function init() {
    const { btn, panel, closeBtn, input, sendBtn } = getElements();
    if (!btn || btn.dataset.chatInit) return;
    btn.dataset.chatInit = "1";

    btn.addEventListener("click", () => {
      panel.classList.toggle("open");
      if (panel.classList.contains("open")) input.focus();
    });

    closeBtn.addEventListener("click", () => {
      panel.classList.remove("open");
    });

    sendBtn.addEventListener("click", sendMessage);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    watchFooter();
  }

  // MkDocs Material instant navigation replaces the DOM on each page visit
  // without firing DOMContentLoaded, so we must re-init via document$.
  if (typeof document$ !== "undefined") {
    document$.subscribe(init);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
