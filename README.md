# Endex SEC Filing Viewer - EndSec

WATCH DEMO: https://drive.google.com/file/d/1ekm6diy-5n1sRYQppkWnnHISqzQS1JzE/preview


EndSec is tool for exploring SEC filings with an AI-powered chat interface. Load any 10-K, 10-Q, or other SEC document by URL, ticker, or CIK, then ask questions about it. An LLM responds with answers grounded in the actual filing text, complete with citations you can click to jump to the source.

## Quick Start (Docker)

The easiest way to run the project. Requires Docker Desktop.

```bash
# 1. Copy the environment template and add your OpenAI API key
cp .env.example .env
# Edit .env and set OPENAI_API_KEY=sk-your-actual-key

# 2. Start the app
docker compose up
```

First build takes 2-3 minutes. Once running, open `http://localhost:3000`.

To stop: `Ctrl+C` or `docker compose down`

To rebuild after code changes: `docker compose up --build`

---

## Running Locally (Without Docker)

You'll need Python 3.10+, Node.js 18+, and an OpenAI API key.

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set your OpenAI API key
export OPENAI_API_KEY=your-key-here  # On Windows: set OPENAI_API_KEY=your-key-here

# Start the server
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. FastAPI's interactive docs are at `http://localhost:8000/docs` if you want to poke around the endpoints directly.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:3000`.

### Environment Variables

Backend (`backend/.env`):
- `OPENAI_API_KEY` - Required. Your OpenAI API key
- `FRONTEND_URL` - Optional. Base URL for deep links in exports (default: `http://localhost:3000`)
- `ALLOWED_ORIGINS` - Optional. CORS origins (default: `http://localhost:3000,http://localhost:3001`)

Frontend (`frontend/.env.local`):
- `NEXT_PUBLIC_API_URL` - Optional. Backend URL (default: `http://localhost:8000`)


## Features

### Filing Loader

The app fetches SEC filings directly from EDGAR by URL. Paste in any SEC filing link and it pulls the HTML, sanitizes it to strip scripts and unsafe elements while preserving structure, and renders it in a clean viewer. The raw HTML is also cached server-side so the chat and export features can work against it without re-fetching.

URLs are validated to ensure they point to SEC domains. The fetcher generates a deterministic ID from each URL, so the same filing always maps to the same cache entry. Caching is in-memory, so restarting the server clears everything.

### LLM Chat

When a filing loads, it gets chunked into overlapping segments and embedded with OpenAI's text-embedding-3-small, then kept in a vector store in memory. Questions trigger retrieval using a hybrid approach, semantic similarity combined with BM25 keyword matching—and GPT-4-turbo generates answers based on those chunks.

Answers include numbered citations. Clicking one scrolls to that part of the filing and briefly highlights the source element. Conversation history is maintained, so follow-up questions have context. I implemented question rewriting as well, but ended up removing it due to an increase in response time. Do note that the citations don't tend to work as well on tables due to the way chunking is implemented.

### Exhibit Viewer

The sidebar lists documents attached to the filing (ex10, ex21, ex31, etc.). These are discovered by parsing the SEC's index.json for the filing directory. Clicking an exhibit opens it in the same viewer. The exhibits are also automatically ingested into the chat context, so questions can reference material from the full filing package, not just the main filing.

### Table Detection and Export

The export feature parses tables from the HTML and handles column and row merging, which gets tricky with financial tables and their merged cells. There's also heuristic-based detection to distinguish actual data tables from layout tables, but there are edge cases for which our heuristic approach does not work.

If you hover over a table you can see export options. You can download a single table as CSV or Excel or you can download all tables at once as either XLSX or a CSV. Excel exports include a hyperlink that deep-links back to that table in the viewer. Sometimes you'll find that deeply nested tables don't parse perfectly, and the layout-vs-data heuristics occasionally misclassify.

### Shareable Deep Links

Like mentioned in the project proposal, text selections and table references can be shared via URL. If you select text in the filing a menu appears with options to copy a link. The link encodes the element index and character offsets, so opening it loads the filing and scrolls directly to that selection with it highlighted. Same works for tables—click the share option and the URL will open with that table highlighted.

Highlights are also saved locally (persisted in browser storage) for quick reference.

### Company Browser

With some extra time, I implemented the company browser as well. Instead of pasting a URL, you can search by the ticker symbol and CIK number. The app then queries and fetches the company's submission history from the SEC API. These results are then filtered to common form types—10-K, 10-Q, 8-K, proxy statements, registration statements, insider filings, especially since the raw feed includes a lot of administrative noise.

The browse page shows the company name, recent filings with dates and descriptions, and links to open each one directly in the viewer.


## How It Works

The backend is built using FastAPI with async throughout. The filing HTML goes through BeautifulSoup for sanitization and table extraction. Then, our RAG pipeline chunks documents with overlap, tracks element positions for citation linking, and stores everything in memory.

The frontend is Next.js 14 with the App Router. The viewer renders sanitized HTML with data attributes that enable selection tracking. Chat state persists when switching between documents in the same session.
