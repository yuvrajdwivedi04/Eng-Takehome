"""
Filing endpoints for fetching, caching, and exporting SEC documents
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
from io import StringIO

from app.rate_limiter import limiter
from app.config import RATE_LIMIT_FILING_FETCH
from app.services.filing_fetcher import FilingFetcher, InvalidFilingUrlError
from app.services.filing_cache import filing_cache
from app.utils.sanitize_html import sanitize
from app.services.csv_generator import extract_table_at_index, generate_csv, generate_xlsx, build_table_link, generate_all_tables_xlsx, generate_all_tables_csv_zip
from app.services.exhibit_fetcher import ExhibitFetcher


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
@limiter.limit(RATE_LIMIT_FILING_FETCH)
async def open_filing(request: Request, body: OpenFilingRequest):
    # NOTE: SlowAPI requires `request` as first arg - do not reorder parameters
    """
    Fetch and sanitize a SEC filing from a URL.
    
    Args:
        request: FastAPI Request object (required by rate limiter)
        body: Contains the SEC filing URL
        
    Returns:
        Filing ID, source URL, and sanitized HTML
        
    Raises:
        HTTPException: 400 if URL is invalid, 502 if network failure, 500 for other errors
    """
    if not body.url:
        raise HTTPException(status_code=400, detail="URL is required")
    
    try:
        fetcher = FilingFetcher()
        
        # Generate deterministic filing ID
        filing_id = fetcher.generate_filing_id(body.url)
        
        # Fetch raw HTML
        raw_html = await fetcher.fetch(body.url)
        
        # Cache raw HTML for Phase 3 chat retrieval
        filing_cache.store(filing_id, raw_html, body.url)
        
        # Sanitize HTML
        sanitized_html = sanitize(raw_html)
        
        return OpenFilingResponse(
            id=filing_id,
            sourceUrl=body.url,
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


# --- Bulk Table Exports (must be defined BEFORE parameterized routes) ---

@router.get("/{filing_id}/tables/all.xlsx")
async def download_all_tables_xlsx(filing_id: str):
    """
    Download all data tables from a filing as a multi-sheet Excel workbook.
    
    Each data table becomes a separate sheet. Layout tables are filtered out.
    Includes a "View Source" link on the first sheet.
    
    Args:
        filing_id: The filing identifier (SHA-1 hash of source URL)
        
    Returns:
        XLSX file with multiple sheets as streaming response
        
    Raises:
        HTTPException: 404 if filing not found or no data tables exist
    """
    raw_html = filing_cache.get_html(filing_id)
    if not raw_html:
        raise HTTPException(
            status_code=404,
            detail=f"Filing '{filing_id}' not found. Please load the filing first."
        )
    
    source_url = filing_cache.get_source_url(filing_id)
    table_link = build_table_link(source_url, 0) if source_url else None
    
    try:
        xlsx_content, table_count = generate_all_tables_xlsx(raw_html, source_url=table_link)
        
        if table_count == 0:
            raise HTTPException(
                status_code=404,
                detail="No data tables found in this filing."
            )
        
        return StreamingResponse(
            iter([xlsx_content]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="all-tables-{filing_id[:8]}.xlsx"'
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate XLSX: {str(e)}"
        )


@router.get("/{filing_id}/tables/all.zip")
async def download_all_tables_csv_zip(filing_id: str):
    """
    Download all data tables from a filing as a ZIP of CSV files.
    
    Each data table becomes a separate CSV file in the ZIP.
    Layout tables are filtered out.
    
    Args:
        filing_id: The filing identifier (SHA-1 hash of source URL)
        
    Returns:
        ZIP file containing CSVs as streaming response
        
    Raises:
        HTTPException: 404 if filing not found or no data tables exist
    """
    raw_html = filing_cache.get_html(filing_id)
    if not raw_html:
        raise HTTPException(
            status_code=404,
            detail=f"Filing '{filing_id}' not found. Please load the filing first."
        )
    
    try:
        zip_content, table_count = generate_all_tables_csv_zip(raw_html)
        
        if table_count == 0:
            raise HTTPException(
                status_code=404,
                detail="No data tables found in this filing."
            )
        
        return StreamingResponse(
            iter([zip_content]),
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="all-tables-{filing_id[:8]}.zip"'
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate ZIP: {str(e)}"
        )


# --- Individual Table Exports (parameterized routes must come AFTER bulk) ---

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
                detail=f"Table {table_index} not found or is a layout table."
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


@router.get("/{filing_id}/tables/{table_index}.xlsx")
async def download_table_xlsx(filing_id: str, table_index: int):
    """
    Download a specific table from a filing as XLSX (Excel).
    
    Features:
    - Bold header row
    - Source link at bottom for traceability
    
    Args:
        filing_id: The filing identifier (SHA-1 hash of source URL)
        table_index: Zero-based index of the table to export
        
    Returns:
        XLSX file as streaming response
        
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
    
    # Get source URL for the deep link
    source_url = filing_cache.get_source_url(filing_id)
    
    # Extract table on-demand
    try:
        table_data = extract_table_at_index(raw_html, table_index)
        
        if table_data is None:
            raise HTTPException(
                status_code=404,
                detail=f"Table {table_index} not found or is a layout table."
            )
        
        # Build deep link to table in viewer
        table_link = None
        if source_url:
            table_link = build_table_link(source_url, table_index)
        
        # Generate XLSX
        xlsx_content = generate_xlsx(table_data, source_url=table_link)
        
        # Return as streaming response
        return StreamingResponse(
            iter([xlsx_content]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="table-{table_index}.xlsx"'
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate XLSX: {str(e)}"
        )


# --- Exhibits ---

class ExhibitModel(BaseModel):
    """A single exhibit file from a SEC filing."""
    name: str
    description: str
    url: str


class ExhibitsResponse(BaseModel):
    """Response containing list of exhibits for a filing."""
    exhibits: list[ExhibitModel]
    sourceUrl: str


@router.get("/{filing_id}/exhibits", response_model=ExhibitsResponse)
async def get_exhibits(filing_id: str):
    """
    Get list of exhibit files for a SEC filing.
    
    Fetches the SEC index.json for the filing and filters for exhibit files
    (files starting with 'ex' or 'EX').
    
    Args:
        filing_id: The filing identifier (SHA-1 hash of source URL)
        
    Returns:
        List of exhibits with names, descriptions, and URLs
        
    Raises:
        HTTPException: 404 if filing not found in cache
    """
    source_url = filing_cache.get_source_url(filing_id)
    if not source_url:
        raise HTTPException(
            status_code=404,
            detail=f"Filing '{filing_id}' not found. Please load the filing first."
        )
    
    fetcher = ExhibitFetcher()
    result = await fetcher.fetch_exhibits(source_url)
    
    if not result:
        # Return empty list if we couldn't fetch exhibits (graceful degradation)
        return ExhibitsResponse(exhibits=[], sourceUrl=source_url)
    
    return ExhibitsResponse(
        exhibits=[
            ExhibitModel(name=e.name, description=e.description, url=e.url)
            for e in result.exhibits
        ],
        sourceUrl=result.source_url
    )
