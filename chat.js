// ===== Aiden persona =====
// Adapted from the user's Gemini Gem instructions. The one change: Aiden's
// "source of truth" used to be Google Keep, which isn't reachable from a
// website. Instead, the current shelves are serialized as JSON and handed
// to Aiden fresh on every turn, so it's always working from live data.
const SYSTEM_INSTRUCTION = `
Role & Identity: You are Aiden, my personal Reading Agent. Your primary purpose is to manage my book list and provide highly personalized, taste-based recommendations. You are analytical, objective, and helpful. You never lose track of your identity as a specialized book assistant. Your speech is casual and very friendly. You speak in short, concise messages. You speak in a very human-like manner. You do not repeat your role to me unless explicitly asked to. You do not mention your core knowledge & data unless explicitly asked. You do not mention I prefer books under 600 pages unless explicitly asked.

Core Knowledge & Data: My reading data is provided to you as a JSON snapshot at the start of every message, under "CURRENT SHELVES". This is always the live, up-to-date state of my shelves — treat it as your source of truth, not your memory of earlier turns. The shelves are:
- "Reading Now" — books I'm currently reading
- "TBR With Others" — books I intend to read but can't until other people are ready
- "TBR" — books I intend to read
- "Maybe List" — books I may read, but am still unsure about
- "Completed Reads" — books I've finished, alongside their rating out of 5

Key Preference Indicator: My taste is defined primarily by the books I have rated 4 or 5 stars. I do not like romance books. I do not like high fantasy books. I do not like collections of short stories. I do not like books over 600 pages. I like horror and thrillers. I like transgressive fiction. I like novellas.

Behavioral Rules
- Consistency: Never hallucinate or suggest books already in my lists.
- Analytical Process: When recommending books, explain your reasoning by linking the suggestion to a specific book, theme, or "why I liked it" note from my reading history.
- Proactive Management: If I mention a new title, ask if I want to add it to one of my shelves.
- Recommendations: When recommending a new book, always give: the title, the page length, a star rating based on Goodreads, a star rating based on how it fits my taste, and a short synopsis.
- Tool use: You can add, move, update, or remove books using the tools available to you. Use them whenever I ask you to change my shelves, or after I confirm I want a new title added. Confirm briefly in chat after you do.

Constraints
- Do not offer general recommendations that contradict my established tastes.
- If a book's genre or style is unclear, ask me to clarify rather than guessing.
`.trim();

// ===== Tool declarations (Gemini function calling) =====
const SHELF_NAMES = SHELVES.map(s => s.label);

const TOOLS = [{
  functionDeclarations: [
    {
      name: "add_book",
      description: "Add a new book to one of the shelves.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          shelf: { type: "string", enum: SHELF_NAMES },
          pages: { type: "number", description: "Page count, if known" },
          rating: { type: "number", description: "Rating out of 5, only for Completed Reads" },
          notes: { type: "string" },
        },
        required: ["title", "shelf"],
      },
    },
    {
      name: "move_book",
      description: "Move an existing book to a different shelf.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          to_shelf: { type: "string", enum: SHELF_NAMES },
        },
        required: ["title", "to_shelf"],
      },
    },
    {
      name: "update_book",
      description: "Update fields on an existing book (rating, notes, pages, author).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          rating: { type: "number" },
          notes: { type: "string" },
          pages: { type: "number" },
          author: { type: "string" },
        },
        required: ["title"],
      },
    },
    {
      name: "remove_book",
      description: "Remove a book from the shelves entirely.",
      parameters: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
      },
    },
  ],
}];

function shelfLabelToId(label) {
  const shelf = SHELVES.find(s => s.label.toLowerCase() === (label || "").toLowerCase());
  return shelf ? shelf.id : null;
}

// Executes a tool call from Aiden against the local catalog (app.js state).
function runTool(name, args) {
  switch (name) {
    case "add_book": {
      const listId = shelfLabelToId(args.shelf) || "tbr";
      const book = addBook({
        title: args.title, author: args.author, list: listId,
        pages: args.pages, rating: args.rating, notes: args.notes,
      });
      return { ok: true, book: book.title, shelf: SHELF_BY_ID[listId].label };
    }
    case "move_book": {
      const listId = shelfLabelToId(args.to_shelf);
      if (!listId) return { ok: false, error: "Unknown shelf" };
      const book = moveBookByTitle(args.title, listId);
      return book ? { ok: true, book: book.title, shelf: args.to_shelf } : { ok: false, error: "Book not found" };
    }
    case "update_book": {
      const { title, ...patch } = args;
      const book = updateBookByTitle(title, patch);
      return book ? { ok: true, book: book.title } : { ok: false, error: "Book not found" };
    }
    case "remove_book": {
      const removed = removeBookByTitle(args.title);
      return { ok: removed, error: removed ? undefined : "Book not found" };
    }
    default:
      return { ok: false, error: "Unknown tool" };
  }
}

// ===== Chat state =====
let history = []; // [{role: "user"|"model", parts: [...]}]
const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatDot = document.getElementById("chatDot");
const chatSub = document.getElementById("chatSub");

function addMessageToLog(role, text) {
  const div = document.createElement("div");
  div.className = "chat-msg chat-msg--" + role;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

function addSystemNoteToLog(text) {
  const div = document.createElement("div");
  div.className = "chat-msg chat-msg--note";
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// Models we currently offer in Settings. If a browser has an older/retired
// model string saved (e.g. from before Google deprecated it), we fall back
// to the default instead of sending a doomed request.
const KNOWN_MODELS = ["gemini-flash-latest", "gemini-pro-latest", "gemini-3.5-flash"];
const DEFAULT_MODEL = "gemini-flash-latest";

async function callGemini(contents) {
  const settings = loadSettings();
  if (!settings.apiKey) {
    throw new Error("NO_KEY");
  }
  let model = settings.model || DEFAULT_MODEL;
  if (!KNOWN_MODELS.includes(model)) {
    console.warn(`Saved model "${model}" is no longer offered — falling back to ${DEFAULT_MODEL}.`);
    model = DEFAULT_MODEL;
    saveSettings({ ...settings, model });
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": settings.apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      tools: TOOLS,
      contents,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }
  return res.json();
}

async function sendToAiden(userText) {
  const stateJson = JSON.stringify(getAllBooksState(), null, 2);
  const userMessage = {
    role: "user",
    parts: [{ text: `CURRENT SHELVES:\n${stateJson}\n\nMessage: ${userText}` }],
  };
  history.push(userMessage);

  chatDot.classList.add("is-thinking");
  chatSub.textContent = "thinking…";

  try {
    let data = await callGemini(history);
    let guard = 0;

    // Handle chained function calls until Aiden produces plain text.
    while (guard++ < 5) {
      const candidate = data.candidates && data.candidates[0];
      const parts = candidate?.content?.parts || [];
      const functionCalls = parts.filter(p => p.functionCall);

      if (functionCalls.length === 0) break;

      history.push({ role: "model", parts });

      const responseParts = functionCalls.map(fc => {
        const result = runTool(fc.functionCall.name, fc.functionCall.args || {});
        return {
          functionResponse: {
            name: fc.functionCall.name,
            response: result,
          },
        };
      });
      history.push({ role: "user", parts: responseParts });

      data = await callGemini(history);
    }

    const finalCandidate = data.candidates && data.candidates[0];
    const finalParts = finalCandidate?.content?.parts || [];
    const text = finalParts.map(p => p.text).filter(Boolean).join("\n").trim();

    history.push({ role: "model", parts: finalParts });
    addMessageToLog("aiden", text || "…");
  } catch (err) {
    if (err.message === "NO_KEY") {
      addSystemNoteToLog("Add a Gemini API key in Settings (⚙) to chat with Aiden.");
    } else if (/404/.test(err.message) && /model/i.test(err.message)) {
      addSystemNoteToLog("That model isn't available anymore. Open Settings (⚙) and re-save to switch to the current default — then try again.");
    } else {
      console.error(err);
      addSystemNoteToLog("Error talking to Aiden: " + err.message);
    }
  } finally {
    chatDot.classList.remove("is-thinking");
    chatSub.textContent = "your reading agent";
  }
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  addMessageToLog("user", text);
  chatInput.value = "";
  chatInput.style.height = "auto";
  sendToAiden(text);
});

chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + "px";
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

// ===== Settings modal =====
const settingsModal = document.getElementById("settingsModal");
const apiKeyInput = document.getElementById("apiKeyInput");
const modelSelect = document.getElementById("modelSelect");

document.getElementById("settingsBtn").addEventListener("click", () => {
  const s = loadSettings();
  apiKeyInput.value = s.apiKey || "";
  modelSelect.value = s.model || "gemini-flash-latest";
  settingsModal.showModal();
});
document.getElementById("closeSettingsBtn").addEventListener("click", () => settingsModal.close());
settingsModal.querySelector("form").addEventListener("submit", () => {
  saveSettings({ apiKey: apiKeyInput.value.trim(), model: modelSelect.value });
});

// ===== Collapse / reopen chat =====
const chatPane = document.getElementById("chatPane");
const chatReopenBtn = document.getElementById("chatReopenBtn");
document.getElementById("chatCollapseBtn").addEventListener("click", () => {
  chatPane.classList.add("is-collapsed");
  chatReopenBtn.hidden = false;
});
chatReopenBtn.addEventListener("click", () => {
  chatPane.classList.remove("is-collapsed");
  chatReopenBtn.hidden = true;
});

// ===== Welcome message =====
if (!loadSettings().apiKey) {
  addSystemNoteToLog("Add your Gemini API key in Settings (⚙) to start chatting with Aiden.");
} else {
  addMessageToLog("aiden", "Hey — what are we doing to the shelves today?");
}
