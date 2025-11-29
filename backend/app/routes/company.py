from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from typing import Optional
import re

router = APIRouter(prefix="/api/company", tags=["company"])

# SEC API headers - required for SEC EDGAR
SEC_HEADERS = {
    "User-Agent": "EndSec Research contact@endsec.com",
    "Accept-Encoding": "gzip, deflate",
}

# Whitelist of sensical form types - filters out administrative noise
ALLOWED_FORMS = {
    # Annual/Quarterly reports
    "10-K", "10-K/A", "10-Q", "10-Q/A",
    # Current reports
    "8-K", "8-K/A",
    # Proxy statements
    "DEF 14A", "DEFA14A",
    # Registration statements
    "S-1", "S-1/A", "S-3", "S-3/A", "S-4", "S-4/A", "F-1", "F-1/A",
    # Insider/Institutional ownership
    "4", "13F-HR", "13F-HR/A", "SC 13G", "SC 13G/A", "SC 13D", "SC 13D/A",
    # Foreign private issuer
    "6-K", "6-K/A",
    # Annual report for foreign private issuer
    "20-F", "20-F/A",
}


class Filing(BaseModel):
    """A single SEC filing with normalized fields."""
    form: str
    filingDate: str
    description: str
    url: str
    accessionNumber: str


class CompanyFilingsResponse(BaseModel):
    """Response containing company info and filings."""
    cik: str
    name: str
    ticker: Optional[str] = None
    filings: list[Filing]


def normalize_cik(cik: str) -> str:
    """Pad CIK to 10 digits with leading zeros."""
    return cik.zfill(10)


def build_filing_url(cik: str, accession_number: str, primary_document: str) -> str:
    """
    Build the direct URL to the filing document on SEC EDGAR.
    Returns the actual .htm file, not the XBRL viewer.
    """
    accession_no_dashes = accession_number.replace("-", "")
    normalized_cik = normalize_cik(cik)
    return f"https://www.sec.gov/Archives/edgar/data/{normalized_cik}/{accession_no_dashes}/{primary_document}"


async def get_cik_from_ticker(ticker: str) -> Optional[dict]:
    """
    Look up CIK and company name from ticker symbol.
    Uses SEC's company_tickers.json endpoint.
    """
    async with httpx.AsyncClient(headers=SEC_HEADERS, timeout=30) as client:
        response = await client.get("https://www.sec.gov/files/company_tickers.json")
        response.raise_for_status()
        data = response.json()
        
        ticker_upper = ticker.upper().strip()
        for entry in data.values():
            if entry.get("ticker", "").upper() == ticker_upper:
                return {
                    "cik": str(entry["cik_str"]),
                    "name": entry["title"],
                    "ticker": entry["ticker"]
                }
        return None


async def fetch_company_submissions(cik: str) -> dict:
    """
    Fetch company submissions from SEC EDGAR.
    Returns the full submissions JSON.
    """
    normalized_cik = normalize_cik(cik)
    url = f"https://data.sec.gov/submissions/CIK{normalized_cik}.json"
    
    async with httpx.AsyncClient(headers=SEC_HEADERS, timeout=30) as client:
        response = await client.get(url)
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Company with CIK {cik} not found")
        response.raise_for_status()
        return response.json()


def extract_filings(submissions: dict, cik: str, limit: int = 100) -> list[Filing]:
    """
    Extract and filter filings from SEC submissions response.
    Only returns sensical form types (ALLOWED_FORMS whitelist).
    """
    recent = submissions.get("filings", {}).get("recent", {})
    
    accession_numbers = recent.get("accessionNumber", [])
    forms = recent.get("form", [])
    filing_dates = recent.get("filingDate", [])
    primary_documents = recent.get("primaryDocument", [])
    primary_doc_descriptions = recent.get("primaryDocDescription", [])
    
    filings = []
    for i in range(len(accession_numbers)):
        form = forms[i] if i < len(forms) else ""
        
        # Skip forms not in our whitelist
        if form not in ALLOWED_FORMS:
            continue
        
        # Get description, fallback to form type if empty
        description = ""
        if i < len(primary_doc_descriptions) and primary_doc_descriptions[i]:
            description = primary_doc_descriptions[i]
        else:
            description = form
        
        filings.append(Filing(
            form=form,
            filingDate=filing_dates[i] if i < len(filing_dates) else "",
            description=description,
            url=build_filing_url(
                cik,
                accession_numbers[i],
                primary_documents[i] if i < len(primary_documents) else ""
            ),
            accessionNumber=accession_numbers[i]
        ))
        
        # Stop once we hit the limit
        if len(filings) >= limit:
            break
    
    return filings


@router.get("/search/ticker/{ticker}", response_model=CompanyFilingsResponse)
async def search_by_ticker(ticker: str, limit: int = 100):
    """
    Search for a company by ticker symbol and return recent filings.
    
    Args:
        ticker: Stock ticker symbol (e.g., AAPL, MSFT)
        limit: Maximum number of filings to return (default 100)
    
    Returns:
        Company info and list of recent filings (filtered to sensical form types)
    """
    # Look up CIK from ticker
    company_info = await get_cik_from_ticker(ticker)
    if not company_info:
        raise HTTPException(
            status_code=404, 
            detail=f"No company found with ticker '{ticker}'"
        )
    
    # Fetch submissions
    submissions = await fetch_company_submissions(company_info["cik"])
    
    # Extract and filter filings
    filings = extract_filings(submissions, company_info["cik"], limit)
    
    return CompanyFilingsResponse(
        cik=company_info["cik"],
        name=company_info["name"],
        ticker=company_info.get("ticker"),
        filings=filings
    )


@router.get("/search/cik/{cik}", response_model=CompanyFilingsResponse)
async def search_by_cik(cik: str, limit: int = 100):
    """
    Search for a company by CIK and return recent filings.
    
    Args:
        cik: SEC Central Index Key (e.g., 320193 for Apple)
        limit: Maximum number of filings to return (default 100)
    
    Returns:
        Company info and list of recent filings (filtered to sensical form types)
    """
    # Validate CIK format
    if not re.match(r'^\d+$', cik):
        raise HTTPException(status_code=400, detail="CIK must be numeric")
    
    # Fetch submissions
    submissions = await fetch_company_submissions(cik)
    
    # Get company name and ticker
    name = submissions.get("name", "Unknown Company")
    tickers = submissions.get("tickers", [])
    ticker = tickers[0] if tickers else None
    
    # Extract and filter filings
    filings = extract_filings(submissions, cik, limit)
    
    return CompanyFilingsResponse(
        cik=cik,
        name=name,
        ticker=ticker,
        filings=filings
    )

