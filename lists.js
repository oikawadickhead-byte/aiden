// Shared shelf configuration used by app.js (catalog) and chat.js (Aiden).
const SHELVES = [
  { id: "reading-now",    label: "Reading Now",     stamp: "READING",  needsRating: false },
  { id: "tbr-with-others", label: "TBR With Others", stamp: "ON HOLD",  needsRating: false },
  { id: "tbr",             label: "TBR",             stamp: "TBR",      needsRating: false },
  { id: "maybe",           label: "Maybe List",      stamp: "MAYBE",    needsRating: false },
  { id: "completed",       label: "Completed Reads", stamp: "DONE",     needsRating: true  },
];

const SHELF_BY_ID = Object.fromEntries(SHELVES.map(s => [s.id, s]));

const STORAGE_KEY = "stacks_books_v1";
const SETTINGS_KEY = "stacks_settings_v1";

function loadBooks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load books:", e);
    return [];
  }
}

function saveBooks(books) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { apiKey: "", model: "gemini-flash-latest" };
  } catch (e) {
    return { apiKey: "", model: "gemini-flash-latest" };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function makeId() {
  return "b_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}
