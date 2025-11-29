from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
from io import StringIO

from app.services.filing_fetcher import FilingFetcher, InvalidFilingUrlError
from app.services.filing_cache import filing_cache
from app.utils.sanitize_html import sanitize
from app.services.csv_generator import extract_table_at_index, generate_csv


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
        
        # Cache raw HTML for Phase 3 chat retrieval
        filing_cache.store(filing_id, raw_html, request.url)
        
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


@router.get("/{filing_id}/tables/{table_index}.csv")
async def download_table_csv(filing_id: str, table_index: int):
    """
    Download a specific table from a filing as CSV.
    
    Args:
        filing_id: The filing identifier (SHA-1 hash of source URL)
        table_index: Zero-based index of the table to export
        
    Returns:
        CSV file as streaming response
        
    Raises:
        HTTPException: 404 if filing not found or table index out of range,
                      400 if table index is invalid
    """
    # Validate table index
    if table_index < 0:
        raise HTTPException(status_code=400, detail="Table index must be non-negative")
    
    # Get raw HTML from cache
    raw_html = filing_cache.get_html(filing_id)
    if not raw_html:
        raise HTTPException(
            status_code=404,
            detail=f"Filing '{filing_id}' not found. Please load the filing first."
        )
    
    # Extract table on-demand
    try:
        table_data = extract_table_at_index(raw_html, table_index)
        
        if table_data is None:
            raise HTTPException(
                status_code=404,
                detail=f"Table index {table_index} not found in this filing."
            )
        
        # Generate CSV
        csv_content = generate_csv(table_data)
        
        # Return as streaming response
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="table-{table_index}.csv"'
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate CSV: {str(e)}"
        )

