// ===== State =====
let books = loadBooks();
let activeShelf = SHELVES[0].id;
let editingId = null;

// ===== DOM refs =====
const shelfTabsEl = document.getElementById("shelfTabs");
const shelfCountEl = document.getElementById("shelfCount");
const cardGridEl = document.getElementById("cardGrid");
const emptyStateEl = document.getElementById("emptyState");

const bookModal = document.getElementById("bookModal");
const bookForm = document.getElementById("bookForm");
const bookModalTitle = document.getElementById("bookModalTitle");
const fieldTitle = document.getElementById("fieldTitle");
const fieldAuthor = document.getElementById("fieldAuthor");
const fieldList = document.getElementById("fieldList");
const fieldPages = document.getElementById("fieldPages");
const fieldRating = document.getElementById("fieldRating");
const ratingField = document.getElementById("ratingField");
const fieldNotes = document.getElementById("fieldNotes");
const deleteBookBtn = document.getElementById("deleteBookBtn");
const cancelBookBtn = document.getElementById("cancelBookBtn");

// ===== Public mutation API (used by chat.js / Aiden's tools) =====
function addBook({ title, author = "", list = "tbr", pages = null, rating = null, notes = "" }) {
  const shelf = SHELF_BY_ID[list] ? list : "tbr";
  const book = {
    id: makeId(),
    title: title.trim(),
    author: (author || "").trim(),
    list: shelf,
    pages: pages || null,
    rating: rating != null ? Number(rating) : null,
    notes: notes || "",
    dateAdded: new Date().toISOString(),
  };
  books.push(book);
  persistAndRender();
  return book;
}

function findBookByTitle(title) {
  const needle = title.trim().toLowerCase();
  return books.find(b => b.title.toLowerCase() === needle)
      || books.find(b => b.title.toLowerCase().includes(needle));
}

function updateBookByTitle(title, patch) {
  const book = findBookByTitle(title);
  if (!book) return null;
  Object.assign(book, patch);
  persistAndRender();
  return book;
}

function moveBookByTitle(title, toList) {
  if (!SHELF_BY_ID[toList]) return null;
  return updateBookByTitle(title, { list: toList });
}

function removeBookByTitle(title) {
  const book = findBookByTitle(title);
  if (!book) return false;
  books = books.filter(b => b.id !== book.id);
  persistAndRender();
  return true;
}

function getAllBooksState() {
  // Grouped snapshot handed to Aiden as "source of truth" each turn.
  const grouped = {};
  for (const shelf of SHELVES) grouped[shelf.label] = [];
  for (const b of books) {
    const shelf = SHELF_BY_ID[b.list];
    grouped[shelf ? shelf.label : "TBR"].push({
      title: b.title,
      author: b.author || undefined,
      pages: b.pages || undefined,
      rating: b.rating != null ? b.rating : undefined,
      notes: b.notes || undefined,
    });
  }
  return grouped;
}

function persistAndRender() {
  saveBooks(books);
  render();
}

// ===== Rendering =====
function renderTabs() {
  shelfTabsEl.innerHTML = "";
  for (const shelf of SHELVES) {
    const count = books.filter(b => b.list === shelf.id).length;
    const btn = document.createElement("button");
    btn.className = "shelf-tab" + (shelf.id === activeShelf ? " is-active" : "");
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", shelf.id === activeShelf ? "true" : "false");
    btn.innerHTML = `<span class="shelf-tab-label">${shelf.label}</span><span class="shelf-tab-count">${count}</span>`;
    btn.addEventListener("click", () => { activeShelf = shelf.id; render(); });
    shelfTabsEl.appendChild(btn);
  }
}

function stars(n) {
  if (n == null) return "";
  const full = "★".repeat(n);
  const empty = "☆".repeat(5 - n);
  return `<span class="stars" aria-label="${n} out of 5 stars">${full}${empty}</span>`;
}

function renderCards() {
  const shelf = SHELF_BY_ID[activeShelf];
  const shelfBooks = books.filter(b => b.list === activeShelf);
  shelfCountEl.textContent = `${shelfBooks.length} book${shelfBooks.length === 1 ? "" : "s"}`;

  cardGridEl.innerHTML = "";
  emptyStateEl.hidden = shelfBooks.length !== 0;

  shelfBooks
    .slice()
    .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
    .forEach((book, i) => {
      const callNumber = `${shelf.stamp}–${String(i + 1).padStart(3, "0")}`;
      const card = document.createElement("article");
      card.className = "book-card";
      card.innerHTML = `
        <div class="book-card-punch"></div>
        <div class="book-card-stamp">${shelf.stamp}</div>
        <p class="book-call-number">${callNumber}</p>
        <h3 class="book-title">${escapeHtml(book.title)}</h3>
        ${book.author ? `<p class="book-author">${escapeHtml(book.author)}</p>` : ""}
        <div class="book-meta">
          ${book.pages ? `<span class="book-pages">${book.pages}p</span>` : ""}
          ${book.rating != null ? stars(book.rating) : ""}
        </div>
        ${book.notes ? `<p class="book-notes">${escapeHtml(book.notes)}</p>` : ""}
      `;
      card.addEventListener("click", () => openEditModal(book));
      cardGridEl.appendChild(card);
    });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  renderTabs();
  renderCards();
}

// ===== Modal: add/edit =====
function populateShelfSelect() {
  fieldList.innerHTML = SHELVES.map(s => `<option value="${s.id}">${s.label}</option>`).join("");
}

function openAddModal() {
  editingId = null;
  bookModalTitle.textContent = "Add a book";
  bookForm.reset();
  fieldList.value = activeShelf;
  deleteBookBtn.hidden = true;
  toggleRatingVisibility();
  bookModal.showModal();
  fieldTitle.focus();
}

function openEditModal(book) {
  editingId = book.id;
  bookModalTitle.textContent = "Edit book";
  fieldTitle.value = book.title;
  fieldAuthor.value = book.author || "";
  fieldList.value = book.list;
  fieldPages.value = book.pages || "";
  fieldRating.value = book.rating != null ? book.rating : "";
  fieldNotes.value = book.notes || "";
  deleteBookBtn.hidden = false;
  toggleRatingVisibility();
  bookModal.showModal();
}

function toggleRatingVisibility() {
  const shelf = SHELF_BY_ID[fieldList.value];
  ratingField.style.display = shelf && shelf.needsRating ? "" : "";
}

fieldList.addEventListener("change", toggleRatingVisibility);

document.getElementById("addBookBtn").addEventListener("click", openAddModal);
cancelBookBtn.addEventListener("click", () => bookModal.close());

deleteBookBtn.addEventListener("click", () => {
  if (!editingId) return;
  books = books.filter(b => b.id !== editingId);
  persistAndRender();
  bookModal.close();
});

bookForm.addEventListener("submit", (e) => {
  const title = fieldTitle.value.trim();
  if (!title) { e.preventDefault(); return; }

  const patch = {
    title,
    author: fieldAuthor.value.trim(),
    list: fieldList.value,
    pages: fieldPages.value ? Number(fieldPages.value) : null,
    rating: fieldRating.value !== "" ? Number(fieldRating.value) : null,
    notes: fieldNotes.value.trim(),
  };

  if (editingId) {
    const book = books.find(b => b.id === editingId);
    Object.assign(book, patch);
  } else {
    books.push({ id: makeId(), dateAdded: new Date().toISOString(), ...patch });
  }
  persistAndRender();
});

// ===== Init =====
populateShelfSelect();
render();
