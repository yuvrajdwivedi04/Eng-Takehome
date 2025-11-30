"""
Rate limiter configuration for API endpoints.

Uses SlowAPI with in-memory storage for basic request throttling.
Only applied to specific endpoints (e.g., /open-filing) to prevent abuse
while keeping UX-critical endpoints (chat, table exports) unrestricted.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Rate limiter instance (imported by routes that need throttling)
limiter = Limiter(key_func=get_remote_address)

