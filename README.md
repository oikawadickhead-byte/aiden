# The Stacks — a TBR catalog with Aiden

A static site with two parts:
- **Shelves**: Reading Now, TBR With Others, TBR, Maybe List, Completed Reads — each book tracks title, author, page count, rating (out of 5, mainly for Completed Reads), and notes. Stored in your browser's `localStorage`, so it's private to whatever browser you use it in.
- **Aiden**: a chat panel wired to the Gemini API, using your Gem's original persona and preferences. Aiden can see your current shelves on every message and can add, move, update, or remove books for you through the chat.

## Before you deploy

1. Get a Gemini API key at **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)** (free tier is fine to start).
2. Open the site, click the ⚙ in the header, paste your key in, and save. It's stored only in your browser's local storage and sent only to Google's API — never anywhere else.

**One important note on the key:** because this is a plain static site (no server), the key lives in your browser and is visible to anyone with access to that browser/device. That's fine for a personal tool only you use. Don't publish the URL publicly or put the key into the source code itself — always enter it through Settings.

## Running it locally

No build step — it's just HTML/CSS/JS. From the project folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploying (pick one)

**Netlify (easiest)**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the whole `aiden-reads` folder onto the page
3. You get a live URL immediately (you can rename it in site settings)

**GitHub Pages**
1. Create a new repo, push these files to it
2. In the repo, go to Settings → Pages → set source to the `main` branch, root folder
3. Your site will be live at `https://yourusername.github.io/reponame`

**Vercel**
1. `npm i -g vercel` then run `vercel` from inside the folder, or drag-and-drop at [vercel.com/new](https://vercel.com/new)

Whichever host you pick, since your shelf data lives in `localStorage`, you'll need to re-enter your API key (and re-add books, since local storage won't carry over) if you ever switch browsers or devices — that's the tradeoff for keeping this simple with no backend/database. If that starts to bug you, the natural next step is adding a small backend + database so everything syncs — happy to help with that later if you want it.

## Files

- `index.html` — page structure
- `style.css` — the library-catalog look
- `lists.js` — shelf config + localStorage helpers (shared)
- `app.js` — catalog rendering, add/edit/delete modal
- `chat.js` — Aiden's persona, Gemini API calls, function-calling tools that edit your shelves
