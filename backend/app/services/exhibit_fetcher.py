"""
Service for fetching exhibit files from SEC EDGAR index.

Parses CIK and accession number from SEC filing URLs, fetches the
index.json from SEC, and filters for exhibit files.
"""

import re
import httpx
from dataclasses import dataclass
from typing import Optional
import logging

from app.config import SEC_USER_AGENT

logger = logging.getLogger(__name__)


@dataclass
class Exhibit:
    """Represents a single exhibit file from a SEC filing."""
    name: str
    description: str
    url: str


@dataclass
class ExhibitResult:
    """Result of fetching exhibits from SEC."""
    exhibits: list[Exhibit]
    source_url: str


class ExhibitFetcher:
    """Service for fetching exhibit files from SEC EDGAR index."""
    
    # Pattern to match SEC filing URLs and extract CIK + accession
    # Example: https://www.sec.gov/Archives/edgar/data/320193/000032019324000006/aapl-20231230.htm
    SEC_URL_PATTERN = re.compile(
        r"sec\.gov/Archives/edgar/data/(\d+)/(\d+)/"
    )
    
    # Pattern to identify exhibit files (case-insensitive)
    # Matches: exhibit21, ex-21, ex21, a10-kexhibit21109282024.htm, etc.
    EXHIBIT_PATTERN = re.compile(r"exhibit\d+|ex[\-_]?\d+", re.IGNORECASE)
    
    # Common SEC exhibit type descriptions
    EXHIBIT_DESCRIPTIONS = {
        "3": "Articles of Incorporation/Bylaws",
        "4": "Instruments Defining Rights of Security Holders",
        "10": "Material Contracts",
        "14": "Code of Ethics",
        "19": "Insider Trading Policy",
        "21": "Subsidiaries of the Registrant",
        "23": "Consent of Experts and Counsel",
        "24": "Power of Attorney",
        "31": "Rule 13a-14(a) Certification",
        "32": "Section 1350 Certification",
        "95": "Mine Safety Disclosure",
        "97": "Clawback Policy",
        "99": "Additional Exhibits",
        "101": "Interactive Data Files",
    }
    
    @staticmethod
    def parse_cik_accession(source_url: str) -> tuple[str, str] | None:
        """
        Extract CIK and accession number from a SEC filing URL.
        
        Args:
            source_url: Full SEC filing URL
            
        Returns:
            Tuple of (cik, accession) or None if parsing fails
        """
        match = ExhibitFetcher.SEC_URL_PATTERN.search(source_url)
        if match:
            return match.group(1), match.group(2)
        return None
    
    @staticmethod
    def _is_exhibit_file(filename: str) -> bool:
        """Check if a filename represents an exhibit file."""
        return bool(ExhibitFetcher.EXHIBIT_PATTERN.search(filename))
    
    # Pattern to extract exhibit number from filename
    EXHIBIT_NUMBER_PATTERN = re.compile(r"(?:exhibit|ex[\-_]?)(\d+)", re.IGNORECASE)
    
    @classmethod
    def _get_exhibit_description(cls, exhibit_num: str) -> str:
        """Get a human-readable description for an exhibit type."""
        # Try exact match first, then prefix match
        base_num = exhibit_num.split('.')[0]  # "31.1" -> "31"
        
        if base_num in cls.EXHIBIT_DESCRIPTIONS:
            return cls.EXHIBIT_DESCRIPTIONS[base_num]
        
        # Try shorter prefixes (e.g., "101" -> "10")
        if len(base_num) >= 2:
            prefix = base_num[:2]
            if prefix in cls.EXHIBIT_DESCRIPTIONS:
                return cls.EXHIBIT_DESCRIPTIONS[prefix]
        
        if len(base_num) >= 1:
            prefix = base_num[:1]
            if prefix in cls.EXHIBIT_DESCRIPTIONS:
                return cls.EXHIBIT_DESCRIPTIONS[prefix]
        
        return ""
    
    @staticmethod
    def _parse_exhibit_name(filename: str) -> str:
        """
        Extract a clean exhibit name from filename.
        
        Handles formats like:
        - ex-21.htm -> EX-21
        - exhibit21109282024.htm -> EX-21 (extracts first digits as exhibit number)
        - a10-kexhibit31109282024.htm -> EX-31
        """
        match = ExhibitFetcher.EXHIBIT_NUMBER_PATTERN.search(filename)
        if match:
            # Extract the exhibit number digits
            digits = match.group(1)
            # Common exhibit numbers are 1-2 digits, sometimes with decimal (21, 31, 10, 4, 97)
            # Take first 2 digits as the exhibit number (or 1 if single digit like "4")
            if len(digits) >= 2:
                exhibit_num = digits[:2]
                # Check if there's a sub-number (e.g., 31.1, 31.2)
                if len(digits) > 2:
                    sub_num = digits[2]
                    return f"EX-{exhibit_num}.{sub_num}"
                return f"EX-{exhibit_num}"
            else:
                return f"EX-{digits}"
        # Fallback: return cleaned filename
        name = re.sub(r"\.(htm|html|txt)$", "", filename, flags=re.IGNORECASE)
        return name.upper()
    
    async def fetch_exhibits(self, source_url: str) -> ExhibitResult | None:
        """
        Fetch exhibit files for a SEC filing.
        
        Args:
            source_url: The SEC filing URL
            
        Returns:
            ExhibitResult with list of exhibits, or None if parsing/fetching fails
        """
        # Parse CIK and accession from URL
        parsed = self.parse_cik_accession(source_url)
        if not parsed:
            logger.warning(f"Failed to parse CIK/accession from URL: {source_url}")
            return None
        
        cik, accession = parsed
        
        # Build SEC index.json URL
        index_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/index.json"
        base_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/"
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                headers = {
                    "User-Agent": SEC_USER_AGENT
                }
                response = await client.get(index_url, headers=headers)
                response.raise_for_status()
                
                data = response.json()
        except httpx.HTTPError as e:
            logger.warning(f"Failed to fetch SEC index.json: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching exhibits: {e}")
            return None
        
        # Parse index.json structure
        # Structure: { "directory": { "item": [ { "name": "...", "description": "..." }, ... ] } }
        exhibits: list[Exhibit] = []
        
        try:
            items = data.get("directory", {}).get("item", [])
            
            for item in items:
                filename = item.get("name", "")
                description = item.get("description", "")
                
                if self._is_exhibit_file(filename):
                    exhibit_name = self._parse_exhibit_name(filename)
                    exhibit_url = base_url + filename
                    
                    # Get description: prefer SEC-provided, fallback to our lookup
                    exhibit_description = description
                    if not exhibit_description:
                        # Extract base exhibit number for description lookup
                        num_match = re.search(r"EX-(\d+)", exhibit_name)
                        if num_match:
                            exhibit_description = self._get_exhibit_description(num_match.group(1))
                    
                    exhibits.append(Exhibit(
                        name=exhibit_name,
                        description=exhibit_description or exhibit_name,
                        url=exhibit_url
                    ))
            
            # Sort exhibits by name for consistent ordering
            exhibits.sort(key=lambda e: e.name)
            
        except Exception as e:
            logger.error(f"Failed to parse SEC index.json: {e}")
            return None
        
        return ExhibitResult(
            exhibits=exhibits,
            source_url=source_url
        )

