"""
Table extraction and export for CSV/XLSX downloads.

Uses pandas read_html() for reliable colspan/rowspan handling.
This module is EXPORT-ONLY - does not affect RAG embedding pipeline.
"""

from dataclasses import dataclass
from io import StringIO, BytesIO
from bs4 import BeautifulSoup
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font
import csv
import re
import logging

logger = logging.getLogger(__name__)


@dataclass
class TableData:
    """Structured representation of a table for CSV/XLSX export."""
    headers: list[str]
    rows: list[list[str]]


def is_data_table(table_element) -> bool:
    """
    Filter layout tables from data tables using financial heuristics.
    
    Returns True if the table appears to contain actual data (financial tables,
    data grids) rather than being used for layout purposes.
    """
    rows = table_element.find_all('tr')
    cells = table_element.find_all(['td', 'th'])
    text = table_element.get_text(strip=True)
    
    # Structure requirements - must have some substance
    if len(rows) < 2 or len(cells) < 6 or len(text) < 50:
        return False
    
    # Financial content indicators
    has_currency = bool(re.search(r'[\$€£¥]', text))
    has_formatted_nums = bool(re.search(r'\d{1,3}(,\d{3})+', text))
    has_percentages = bool(re.search(r'\d+\.?\d*\s*%', text))
    num_count = len(re.findall(r'\d+', text))
    
    return has_currency or has_formatted_nums or has_percentages or num_count >= 8


def extract_table_at_index(html: str, index: int) -> TableData | None:
    """
    Extract a specific table from HTML using pandas for reliable colspan/rowspan handling.
    
    Uses pandas read_html() which correctly handles merged cells without duplicating
    content. Preserves original text formatting (currency symbols, percentages, 
    parentheses for negative numbers).
    
    Args:
        html: Raw HTML content
        index: Zero-based index of the table to extract
        
    Returns:
        TableData if table exists at index and is a data table, None otherwise
    """
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")
    
    if index < 0 or index >= len(tables):
        return None
    
    target_table = tables[index]
    
    # Validate it's a data table, not layout
    if not is_data_table(target_table):
        logger.warning(f"Table {index} appears to be a layout table, skipping export")
        return None
    
    try:
        # Pass SINGLE table HTML to pandas (avoids nested table confusion)
        # This ensures our indexing matches the frontend's data-table-index
        dfs = pd.read_html(
            StringIO(str(target_table)),
            thousands=None,         # Preserve "1,234" as text, don't parse
            keep_default_na=False,  # Don't convert blanks to NaN
            na_values=[],           # No NA inference at all
        )
        
        if not dfs:
            logger.warning(f"pandas.read_html returned empty for table {index}")
            return None
        
        df = dfs[0]  # Only one table was passed, so always index 0
        
        # Force all values to string to preserve formatting ($, %, parentheses)
        df = df.astype(str).replace({'nan': '', 'None': '', '<NA>': ''})
        
        # Handle MultiIndex columns (common in SEC filings with multi-row headers)
        if isinstance(df.columns, pd.MultiIndex):
            new_cols = []
            for i, col in enumerate(df.columns):
                # Filter out empty/nan/unnamed parts, dedupe while preserving order
                parts = [str(c) for c in col if c and str(c).lower() not in ('', 'nan', 'unnamed')]
                unique_parts = list(dict.fromkeys(parts))  # Dedupe, keep order
                new_cols.append(' '.join(unique_parts) if unique_parts else f"Column_{i+1}")
            df.columns = new_cols
        else:
            # Clean regular column names
            df.columns = [
                str(c).strip() if str(c).lower() not in ('unnamed', 'nan', '') else f"Column_{i+1}"
                for i, c in enumerate(df.columns)
            ]
        
        # Convert to our format
        headers = [str(h).strip() for h in df.columns.tolist()]
        rows = [[str(cell).strip() for cell in row] for row in df.values.tolist()]
        
        # Remove completely empty rows
        rows = [r for r in rows if any(cell for cell in r)]
        
        return TableData(headers=headers, rows=rows)
        
    except Exception as e:
        logger.error(f"Table extraction failed for index {index}: {e}")
        return None


def generate_csv(table: TableData) -> str:
    """
    Generate CSV content from table data.
    
    Args:
        table: Structured table data
        
    Returns:
        CSV-formatted string with proper escaping
    """
    output = StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    
    # Write headers
    writer.writerow(table.headers)
    
    # Write data rows
    for row in table.rows:
        writer.writerow(row)
    
    return output.getvalue()


def generate_xlsx(table: TableData, source_url: str = None) -> bytes:
    """
    Generate XLSX content from table data with formatting.
    
    Features:
    - Bold header row
    - Optional source link at bottom for traceability
    
    Args:
        table: Structured table data
        source_url: Optional URL to include as "View Source" link
        
    Returns:
        XLSX file content as bytes
    """
    wb = Workbook()
    ws = wb.active
    
    # Write headers with bold formatting
    for col, header in enumerate(table.headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = Font(bold=True)
    
    # Write data rows
    for row_idx, row in enumerate(table.rows, 2):
        for col_idx, value in enumerate(row, 1):
            ws.cell(row=row_idx, column=col_idx, value=value)
    
    # Add source link at bottom if provided
    if source_url:
        link_row = len(table.rows) + 3  # 2 blank rows after data
        cell = ws.cell(row=link_row, column=1, value="View Source")
        cell.hyperlink = source_url
        cell.font = Font(color="0563C1", underline="single")
    
    # Write to bytes buffer
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


def build_table_link(filing_url: str, table_index: int, base_url: str = "http://localhost:3000") -> str:
    """
    Build a deep link URL that opens the filing and highlights the specific table.
    
    Args:
        filing_url: Original SEC filing URL
        table_index: Index of the table
        base_url: Base URL of the frontend app
        
    Returns:
        Complete URL with selection parameter
    """
    import base64
    import json
    from urllib.parse import urlencode
    
    selection = {"type": "table", "tableIndex": table_index}
    encoded = base64.b64encode(json.dumps(selection).encode()).decode()
    
    params = urlencode({"source": filing_url, "selection": encoded})
    return f"{base_url}/view?{params}"
