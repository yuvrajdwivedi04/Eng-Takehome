from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

from app.services.filing_fetcher import FilingFetcher, InvalidFilingUrlError
from app.utils.sanitize_html import sanitize


router = APIRouter(prefix="/api/filings", tags=["filings"])


class OpenFilingRequest(BaseModel):
    """Request body for opening a SEC filing."""
    url: str


class OpenFilingResponse(BaseModel):
    """Response for successfully opened filing."""
    id: str
    sourceUrl: str
    html: str


@router.post("/open-filing", response_model=OpenFilingResponse)
async def open_filing(request: OpenFilingRequest):
    """
    Fetch and sanitize a SEC filing from a URL.
    
    Args:
        request: Contains the SEC filing URL
        
    Returns:
        Filing ID, source URL, and sanitized HTML
        
    Raises:
        HTTPException: 400 if URL is invalid, 502 if network failure, 500 for other errors
    """
    if not request.url:
        raise HTTPException(status_code=400, detail="URL is required")
    
    try:
        fetcher = FilingFetcher()
        
        # Generate deterministic filing ID
        filing_id = fetcher.generate_filing_id(request.url)
        
        # Fetch raw HTML
        raw_html = await fetcher.fetch(request.url)
        
        # Sanitize HTML
        sanitized_html = sanitize(raw_html)
        
        return OpenFilingResponse(
            id=filing_id,
            sourceUrl=request.url,
            html=sanitized_html
        )
    except InvalidFilingUrlError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch filing from SEC: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {str(e)}"
        )

