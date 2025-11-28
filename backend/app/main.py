from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import filings, chat

app = FastAPI(title="Endex SEC Filings API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

app.include_router(filings.router)
app.include_router(chat.router)

