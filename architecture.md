# Architecture

## High-Level Description

The backend does all the document work: fetching, parsing, annotating, chunking, and understanding structure. The frontend is intentionally a pretty plain renderer that reads annotations from the backend. This separation exists because SEC filings are messy HTML where meaning is scattered across layout divs rather than clean paragraphs. By keeping document logic in one place, we can evolve the chunking strategy, citation matching, or LLM integration without breaking the UI.

All the filing data lives in memory to avoid a database, but that's the next most logical evolution of this plan. For now, the filing cache, vector store, and BM25 index are all Python dictionaries with LRU eviction. This keeps the demo simple but means restarting the server clears everything, which is a big limitation.

The frontend is a Next.js 14 app with three main pages: a home page for URL/ticker/CIK input, a browse page for company filings, and a viewer page that renders the filing alongside a chat panel and sidebar. Hopefully the UI is something you enjoy looking at and a break from the mundane, plain HTML!

---

## Key Data Structures

### How a Filing is Represented

Now, when you load a filing, the backend creates a record with an ID which is a 12-character hash of the source URL, the original SEC EDGAR URL, and the raw HTML from SEC. The raw HTML gets used for table export and also for RAG chunking. Thereafter sanitized HTML goes to the frontend with structural annotations injected:

- `data-element-index` on paragraphs, headings, list items, and table cells (for citation linking and deep links)
- `data-table-index` on each table element
- `data-row`, `data-col`, `data-table` on cells of data tables for cell range selection

### How Tables are Represented

The tables are represented with each table becoming a `TableData` object with headers (a list of strings for the first row). The difficult part is colspan and rowspan handling. I found SEC financial tables often have cells spanning multiple columns or rows. To handle this, the backend expands these into a regular grid where each cell occupies exactly one position. Only the first cell of a merged region gets content and so continuation cells are left empty to avoid duplication. There's also heuristic logic to distinguish data tables from layout tables, though it's imperfect and some edge cases slip through. That would also be a point of improvement and heuristics would be moved away from.

### How Selections are Encoded

Now, selections are encoded as JSON and then base64'd into a URL parameter:

- **Text selections** have `type: "text"`, an `elementIndex`, and `startOffset`/`endOffset` for character positions
- **Table selections** have `type: "table"`, a `tableIndex`, and optionally `startRow`, `startCol`, `endRow`, `endCol` for cell ranges

This means that when someone opens a URL with a selection parameter, the frontend decodes it, finds the matching element, scrolls to it, and applies a highlight using the CSS Highlight API that persists across the session.

---

## How the Chat Pipeline Works

The chat flow has four stages: **ingestion**, **retrieval**, **generation**, and **citation mapping**.

### Ingestion

When a user asks their first question, the backend checks if the filing has been processed. If not, it:

1. Fetches the raw HTML
2. Grabs up to 10 exhibits (with a 15-second timeout per exhibit)
3. Sanitizes everything
4. Chunks it into overlapping segments of roughly 1,000 tokens with 200-token overlap
5. Embeds each chunk using OpenAI's `text-embedding-3-small`
6. Stores vectors in an in-memory vector store
7. Indexes chunks for BM25 keyword search

Large chunks keep related content together and avoid splitting tables or footnote pairs. This was a design decision made that made it easier to avoid citing wrong parts of the table.

### Retrieval

When a question comes in:

1. The question is embedded
2. The vector store scores chunks by cosine similarity
3. The BM25 index scores by keyword overlap
4. Both are normalized and fused (60% semantic, 40% keyword)
5. The top 10 chunks are retrieved

This hybrid approach was something I opted for, since financial content where what were net sales in 2023 needs exact keyword matching, not just semantic similarity.

### Generation

Retrieved chunks are formatted as numbered excerpts and sent to GPT-4o with:

- A system prompt
- The last 8 messages of conversation history
- The user's question

### Citation Mapping

After generation, the backend:

1. Parses `[n]` citations from the answer
2. Keeps only cited chunks and renumbers citations sequentially
3. For each citation, looks at the ~100 characters before it in the answer to find which element index best matches that context

The frontend gets the answer text plus sources with preview snippets, element indices, and relevance scores. Clicking a citation badge scrolls to that element and applies a pulsing highlight.

---

## Exhibit Viewer

SEC filings include attached exhibits (EX-21 subsidiary lists, EX-31/32 certifications, material contracts, etc.). The system ingests these into the same RAG pipeline so the chat can answer questions across the full filing package.

The backend discovers exhibits by fetching the SEC's `index.json` for the filing directory. Each exhibit is fetched asynchronously with a 15-second timeout, up to 10 per filing. Failed fetches are logged and skipped. Exhibit HTML goes through the same sanitization and chunking pipeline as the main filing.

The frontend sidebar lists available exhibits. Clicking one loads it in the viewer with identical annotation handling. This unified approach means citations can reference exhibit content and deep links work across the entire filing package.

---

## Company Browser

The browse page provides ticker and CIK-based filing lookup as an alternative to direct URL entry.

The backend queries SEC's company submissions API (`/submissions/CIK{cik}.json`) and returns filing metadata filtered to common form types (10-K, 10-Q, 8-K, DEF 14A, S-1, 4, 13F) since the raw feed includes administrative noise.

Ticker-to-CIK resolution uses SEC's company tickers endpoint with results cached (1-hour TTL). Both ticker symbols and raw CIK numbers are accepted, with CIKs normalized to the required 10-digit zero-padded format.

---

## Extending to a Full BAMSEC-Style Product

### Organization and Navigation

BAMSEC groups filings into categories like financials, prospectuses, ownership, and news. The obvious move is adding a database with filing metadata and building a search index, but the more interesting challenge is categorization. SEC form types don't map cleanly to user intent since an 8-K could be a CEO resignation, an acquisition, or quarterly earnings.

I'd build a two-stage classification pipeline. First stage is a fine-tuned DistilBERT model trained on labeled SEC filings with tags like M&A, leadership changes, financial results, legal proceedings, risk updates. Second stage is an LLM call for edge cases where model confidence is below 0.7. For common forms like 10-Ks and 10-Qs, you can skip the model entirely and just use form type rules.

The real value though isn't just better categorization. I'd focus on building smart navigation that surfaces what actually changed between filings. Store a diff of each section against the previous filing in the same series using a simple text diff algorithm. When you open a filing, highlight sections with significant changes and add a side panel showing what was modified. This gets stored in Postgres as a filing_diffs table. Far more actionable than browse-and-search, and the kind of thing analysts actually need.

### Similar Tables

Fingerprinting with structural hashes is too brittle. The approach that works: embed the concatenated headers and first few rows using the same embedding model, store the vectors in Postgres with pgvector. When someone clicks find similar tables, do a cosine similarity search with a threshold of 0.85 for same-company comparisons and 0.75 for cross-company.

You need two indices though. Index 1 is pure structural with exact header matching and Levenshtein distance on row labels. Index 2 is semantic embeddings that capture revenue equals net sales equals total income. The UI lets you toggle between same structure for quarterly comparisons and same metrics for peer analysis.

For edge cases where HTML differs but visual presentation is identical, add a table understanding model that takes a screenshot and outputs a normalized schema. Run this on-demand rather than at ingestion because it's expensive.

### Better Table Export

The heuristics for detecting data tables versus layout tables are never going to be perfect. I'm ditching them entirely and going with a vision-language approach: screenshot each table element, run it through a multimodal LLM to extract as JSON. The model handles merged cells, nested structures, number formatting, everything. Validate against XBRL tags when available and flag discrepancies for manual review.

For XBRL reconciliation: use XBRL as source of truth for the numbers, HTML for the presentation. When they disagree, store both values with a conflict flag so users can make their own call.

---

## Extending to Multi-User Collaboration

### User Accounts and Shared Workspaces

The auth model would be via organizations which contain teams, teams contain workspaces, users belong to teams with roles like owner, editor, viewer, contributor.

Workspaces work like feeds, not folders. When you view a filing, it auto-adds to your default workspace. But you can create project-specific workspaces with rules like auto-add all 10-Ks and 10-Qs from companies with these tickers filed after this date. These rules are stored as JSONB and evaluated by a background job that runs every 6 hours checking for new filings. Manual curation is also supported.

### Real-Time Collaboration

For real-time coordination, I'd add investigation rooms tied to specific filings. Open a room that creates a shared cursor and synchronized scroll via WebSocket broadcasts. Everyone sees the same view, can drop markers at specific paragraphs or tables, and has a dedicated chat that's spatially anchored to the document. Messages get tagged with the current scroll position so chat history maintains spatial context. Way more intuitive than coordinating over Slack with everyone looking at different parts of a 200-page document.

