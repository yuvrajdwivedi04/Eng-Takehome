# Development TODO

## Phase 1: SEC Filing Loader ⏳

**Backend:**
- [ ] Implement `FilingFetcher.fetch()` to retrieve HTML from SEC URLs
- [ ] Add error handling for invalid URLs and network failures
- [ ] Implement `FilingParser.parse()` to extract metadata (company, filing type, date)
- [ ] Create `/api/filings/fetch` POST endpoint accepting URL
- [ ] Add `httpx` or `aiohttp` to requirements.txt

**Frontend:**
- [ ] Build URL input form on landing page (`app/page.tsx`)
- [ ] Add client-side URL validation
- [ ] Implement `fetchFiling()` in `lib/api.ts` to call backend
- [ ] Add loading state and error handling
- [ ] Redirect to `/view` page on successful fetch

---

## Phase 2: Filing Viewer UI ⏳

**Frontend:**
- [ ] Implement `FilingViewer.tsx` to render HTML content safely
- [ ] Add navigation (table of contents, sections)
- [ ] Style filing content for readability
- [ ] Implement text selection highlighting
- [ ] Add copy-to-clipboard functionality

**Backend:**
- [ ] Implement `sanitize_html()` to clean SEC filing HTML
- [ ] Add `/api/filings/{id}` GET endpoint to retrieve cached filings
- [ ] Store fetched filings (in-memory for now, DB later)

---

## Phase 3: Chat Interface + AI Backend 🤖

**Backend:**
- [ ] Add LangChain/LlamaIndex to requirements.txt
- [ ] Implement `ChatPipeline.respond()` using LLM (OpenAI/Anthropic)
- [ ] Create vector store for filing content chunking
- [ ] Implement RAG (Retrieval-Augmented Generation) pipeline
- [ ] Create `/api/chat/message` POST endpoint
- [ ] Add conversation history management

**Frontend:**
- [ ] Build chat UI in `ChatPanel.tsx` (messages, input, send button)
- [ ] Implement `sendChatMessage()` in `lib/api.ts`
- [ ] Add streaming response support (SSE or WebSocket)
- [ ] Display chat history with user/assistant messages
- [ ] Add loading indicators for AI responses

---

## Phase 4: Table Extraction + CSV Export 📊

**Backend:**
- [ ] Implement table detection in `FilingParser.parse()`
- [ ] Add `Table` model with rows/columns structure
- [ ] Implement `TableExporter.export_csv()`
- [ ] Create `/api/tables/extract` POST endpoint
- [ ] Create `/api/tables/{id}/export` GET endpoint returning CSV

**Frontend:**
- [ ] Implement `TableOverlay.tsx` for table selection UI
- [ ] Add table detection visualization in `FilingViewer`
- [ ] Create export button for selected tables
- [ ] Download CSV files from backend
- [ ] Add table preview modal

---

## Phase 5: Deep Linking & Sharing 🔗

**Backend:**
- [ ] Add `Selection` model for storing user selections
- [ ] Create `/api/selections` POST endpoint to save selections
- [ ] Create `/api/selections/{id}` GET endpoint to retrieve

**Frontend:**
- [ ] Implement URL parameter handling for shared selections
- [ ] Add "Share Selection" button
- [ ] Generate shareable URLs with selection metadata
- [ ] Highlight shared selections on page load
- [ ] Add copy-link-to-clipboard functionality

---

## Phase 6: Polish & Production Readiness 🚀

**Backend:**
- [ ] Add proper database (PostgreSQL/SQLite)
- [ ] Implement caching layer (Redis)
- [ ] Add authentication/rate limiting
- [ ] Write unit tests (pytest)
- [ ] Add logging and monitoring
- [ ] Deploy to cloud (AWS/GCP/Railway)

**Frontend:**
- [ ] Add responsive design for mobile
- [ ] Implement dark mode
- [ ] Add keyboard shortcuts
- [ ] Write component tests (Vitest/Jest)
- [ ] Optimize bundle size
- [ ] Deploy to Vercel/Netlify

**DevOps:**
- [ ] Set up CI/CD pipeline
- [ ] Add Docker containers
- [ ] Create docker-compose for local dev
- [ ] Set up environment variables management
- [ ] Add API documentation (OpenAPI/Swagger)

---

## Nice-to-Have Features 💡

- [ ] Multi-filing comparison view
- [ ] Save/bookmark filings
- [ ] Export chat conversations
- [ ] Advanced search within filings
- [ ] Filing change detection (compare versions)
- [ ] Email notifications for new filings
- [ ] Browser extension for one-click loading

---

**Current Status**: Scaffolding complete ✅

**Next Step**: Begin Phase 1 - SEC Filing Loader

