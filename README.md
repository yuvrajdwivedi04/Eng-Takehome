# Endex for SEC Filings

A full-stack application for viewing, analyzing, and interacting with SEC filings through an intelligent chat interface and table extraction tools.

## Architecture

- **Backend**: FastAPI (Python 3.10+)
- **Frontend**: Next.js 14 with TypeScript
- **Structure**: Monorepo with separate backend/frontend directories

## Getting Started

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend API will be available at `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Project Structure

### Backend (`/backend`)

```
app/
├── main.py              # FastAPI app initialization
├── routes/              # API endpoints
│   ├── filings.py       # Filing fetch/parse endpoints
│   ├── chat.py          # Chat interface endpoints
│   └── tables.py        # Table extraction endpoints
├── services/            # Business logic
│   ├── filing_fetcher.py
│   ├── filing_parser.py
│   ├── chat_pipeline.py
│   └── table_exporter.py
├── models/              # Pydantic models
│   ├── filing.py
│   ├── table.py
│   └── selection.py
└── utils/               # Helper functions
    ├── sanitize_html.py
    └── http_client.py
```

### Frontend (`/frontend`)

```
src/
├── app/
│   ├── page.tsx         # Landing page (URL input)
│   └── view/
│       └── page.tsx     # Main viewer + chat UI
├── components/
│   ├── FilingViewer.tsx # SEC filing display
│   ├── ChatPanel.tsx    # Chat interface
│   └── TableOverlay.tsx # Table selection/export
└── lib/
    └── api.ts           # Backend API client
```

## Development Roadmap

See `TODO.md` for detailed implementation phases.

### High-Level Features

1. **SEC Filing Loader**: Fetch and parse SEC filing HTML from user-provided URLs
2. **Filing Viewer**: Clean, navigable display of filing content
3. **AI Chat Interface**: Ask questions about the filing content
4. **Table Extraction**: Identify, select, and export tables as CSV
5. **Deep Linking**: Share specific sections/selections via URL

## Tech Stack

- **FastAPI**: High-performance async Python web framework
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe frontend development
- **Pydantic**: Data validation and serialization

## Contributing

This project is structured for clean separation of concerns:
- Backend handles data fetching, parsing, AI processing
- Frontend focuses on user experience and visualization
- Clear API boundaries enable independent development

---

Built for the Endex take-home challenge.



