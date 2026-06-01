/* EDQMS Ask AI chat widget */
(function () {
  const API_URL = "http://localhost:8001/api/chat";

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
    div.textContent = text;
    msgContainer.appendChild(div);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    return div;
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
        const err = await res.text();
        appendMessage("error", `Error ${res.status}: ${err}`);
      } else {
        const data = await res.json();
        messages.push({ role: "assistant", content: data.reply });
        appendMessage("assistant", data.reply);
      }
    } catch (e) {
      thinking.remove();
      appendMessage("error", "Could not reach the AI server. Make sure it is running on port 8001.");
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
