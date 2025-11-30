import hashlib
from urllib.parse import urlparse, parse_qs
import httpx

from app.config import SEC_USER_AGENT


class InvalidFilingUrlError(Exception):
    """Raised when a filing URL is not from an allowed SEC domain."""
    pass


class FilingFetcher:
    """Service for fetching SEC filing HTML from URLs."""
    
    ALLOWED_DOMAINS = {"sec.gov", "www.sec.gov"}
    
    @staticmethod
    def generate_filing_id(url: str) -> str:
        """
        Generate a deterministic filing ID from a URL.
        
        Args:
            url: The SEC filing URL
            
        Returns:
            12-character filing ID
        """
        return hashlib.sha1(url.encode()).hexdigest()[:12]
    
    def _validate_sec_url(self, url: str) -> None:
        """
        Validate that the URL is from an allowed SEC domain.
        
        Args:
            url: The URL to validate
            
        Raises:
            InvalidFilingUrlError: If URL is not from sec.gov or www.sec.gov
        """
        parsed = urlparse(url)
        
        if not parsed.netloc:
            raise InvalidFilingUrlError("Invalid URL: missing domain")
        
        if parsed.netloc not in self.ALLOWED_DOMAINS:
            raise InvalidFilingUrlError(
                f"Only SEC filing URLs are allowed (sec.gov or www.sec.gov). "
                f"Got: {parsed.netloc}"
            )
    
    def _resolve_ixbrl_url(self, url: str) -> str:
        """
        Convert IXBRL viewer URLs to direct filing URLs.
        
        SEC's Inline XBRL viewer uses /ix?doc=/Archives/... pattern.
        This extracts the actual HTML filing path for fetching.
        
        Example:
            Input:  https://www.sec.gov/ix?doc=/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm
            Output: https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm
        
        Args:
            url: The URL to resolve (may be IXBRL viewer or direct HTML)
            
        Returns:
            Direct HTML filing URL (original URL if not an IXBRL viewer URL)
        """
        parsed = urlparse(url)
        
        # Pattern: /ix?doc=/Archives/edgar/data/...
        if parsed.path == "/ix":
            query = parse_qs(parsed.query)
            doc_path = query.get("doc", [None])[0]
            if doc_path:
                return f"https://www.sec.gov{doc_path}"
        
        return url
    
    async def fetch(self, url: str) -> str:
        """
        Fetch HTML content from a SEC filing URL.
        
        Supports both direct HTML filing URLs and IXBRL viewer URLs.
        IXBRL viewer URLs (/ix?doc=...) are resolved to direct HTML URLs before fetching.
        
        Args:
            url: The SEC filing URL to fetch (HTML or IXBRL viewer format)
            
        Returns:
            Raw HTML content as string
            
        Raises:
            InvalidFilingUrlError: If URL is not from an allowed SEC domain
            httpx.HTTPError: If the request fails
        """
        # Resolve IXBRL viewer URL to direct filing URL
        resolved_url = self._resolve_ixbrl_url(url)
        
        # Validate SEC domain before fetching
        self._validate_sec_url(resolved_url)
        
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            headers = {
                "User-Agent": SEC_USER_AGENT
            }
            response = await client.get(resolved_url, headers=headers)
            response.raise_for_status()
            return response.text

