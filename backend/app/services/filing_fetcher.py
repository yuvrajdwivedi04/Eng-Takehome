import hashlib
from urllib.parse import urlparse
import httpx


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
    
    async def fetch(self, url: str) -> str:
        """
        Fetch HTML content from a SEC filing URL.
        
        Args:
            url: The SEC filing URL to fetch
            
        Returns:
            Raw HTML content as string
            
        Raises:
            InvalidFilingUrlError: If URL is not from an allowed SEC domain
            httpx.HTTPError: If the request fails
        """
        # Validate SEC domain before fetching
        self._validate_sec_url(url)
        
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            headers = {
                "User-Agent": "Endex SEC Filing Viewer (compliance@endex.io)"
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.text

