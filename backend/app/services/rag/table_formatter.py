"""
LLM-optimized table formatter for SEC filings.
Converts financial tables to row-by-row prose format that preserves
full context (row label + period + value) in each entry.
"""

import re
import logging
from typing import Optional
from bs4 import Tag

logger = logging.getLogger(__name__)


def extract_cell_text(cell) -> str:
    """Extract clean text from table cell, handling nested HTML."""
    text = cell.get_text(separator=" ", strip=True)
    return " ".join(text.split())


def handle_merged_cells(rows) -> list[list[str]]:
    """Convert table with colspan/rowspan to regular 2D grid."""
    if not rows:
        return []
    
    max_cols = 0
    for row in rows:
        cols = sum(int(cell.get('colspan', 1)) for cell in row.find_all(['td', 'th']))
        max_cols = max(max_cols, cols)
    
    if max_cols == 0:
        return []
    
    row_count = len(rows)
    grid = [[None] * max_cols for _ in range(row_count)]
    
    for row_idx, row in enumerate(rows):
        col_idx = 0
        for cell in row.find_all(['td', 'th']):
            while col_idx < max_cols and grid[row_idx][col_idx] is not None:
                col_idx += 1
            
            if col_idx >= max_cols:
                break
            
            colspan = int(cell.get('colspan', 1))
            rowspan = int(cell.get('rowspan', 1))
            text = extract_cell_text(cell)
            
            for r in range(min(rowspan, row_count - row_idx)):
                for c in range(min(colspan, max_cols - col_idx)):
                    grid[row_idx + r][col_idx + c] = text
            
            col_idx += colspan
    
    return [[cell or "" for cell in row] for row in grid]


def detect_table_type(grid: list[list[str]], headers: list[str]) -> str:
    """
    Detect if table is financial data. Be AGGRESSIVE - default to financial for SEC filings.
    Returns: "financial" or "general"
    """
    if not grid:
        return "general"
    
    # Combine ALL text from the table for analysis
    all_text = " ".join(headers).lower() if headers else ""
    for row in grid:
        all_text += " " + " ".join(str(cell) for cell in row if cell).lower()
    
    # Key financial terms - if ANY of these appear, it's financial
    financial_keywords = [
        'comprehensive income', 'net income', 'total revenue', 'net sales',
        'operating income', 'gross margin', 'earnings per share', 'diluted',
        'total assets', 'total liabilities', 'shareholders equity',
        'cash flow', 'operating expenses', 'cost of sales', 'gross profit',
        'income tax', 'net earnings', 'fiscal', 'quarterly', 'annual'
    ]
    
    for keyword in financial_keywords:
        if keyword in all_text:
            logger.debug(f"Financial table detected via keyword: '{keyword}'")
            return "financial"
    
    # Check for currency symbols anywhere
    if re.search(r'[\$€£¥]', all_text):
        logger.debug("Financial table detected via currency symbol")
        return "financial"
    
    # Check for numbers with parentheses (negative values) - common in financial tables
    if re.search(r'\(\s*\d[\d,]*\s*\)', all_text):
        logger.debug("Financial table detected via parenthetical numbers")
        return "financial"
    
    # Check for date patterns in headers (likely a financial time series)
    date_patterns = [
        r'(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d',
        r'\b20\d{2}\b',  # Years 2000-2099
        r'\bq[1-4]\s*20\d{2}\b',
    ]
    
    for pattern in date_patterns:
        if re.search(pattern, all_text):
            logger.debug(f"Financial table detected via date pattern")
            return "financial"
    
    return "general"


def extract_column_periods(headers: list[str], grid: list[list[str]] = None) -> list[Optional[str]]:
    """
    Parse date/period information from column headers.
    Also scans early rows for date patterns if headers don't have them.
    Returns list of period strings (None for non-date columns).
    """
    # First, combine all header-like text (headers + first few rows which might be sub-headers)
    all_header_text = list(headers) if headers else []
    
    # SEC tables often have dates in the first few data rows as sub-headers
    if grid and len(grid) > 0:
        for row_idx in range(min(3, len(grid))):  # Check first 3 rows
            for col_idx, cell in enumerate(grid[row_idx]):
                if cell and col_idx < len(all_header_text):
                    # Append cell content to corresponding header
                    all_header_text[col_idx] = f"{all_header_text[col_idx]} {cell}"
                elif cell and col_idx >= len(all_header_text):
                    all_header_text.append(cell)
    
    periods = []
    
    for header in all_header_text:
        header_clean = str(header).strip()
        
        if not header_clean:
            periods.append(None)
            continue
        
        # Check for date patterns - try multiple patterns
        # Pattern: "December 30, 2023" or "December 31, 2022"
        date_match = re.search(
            r'(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}',
            header_clean,
            re.IGNORECASE
        )
        
        if date_match:
            periods.append(date_match.group(0))
            continue
        
        # Pattern: "Three Months Ended December 30, 2023"
        period_match = re.search(
            r'(three|six|nine|twelve)\s+months?\s+ended\s+(.+?\d{4})',
            header_clean,
            re.IGNORECASE
        )
        
        if period_match:
            periods.append(period_match.group(0))
            continue
        
        # Pattern: "Year Ended December 31, 2023"
        year_match = re.search(
            r'year\s+ended\s+(.+?\d{4})',
            header_clean,
            re.IGNORECASE
        )
        
        if year_match:
            periods.append(year_match.group(0))
            continue
        
        # Pattern: "Q1 2024" or "Q4 2023"
        quarter_match = re.search(r'q[1-4]\s*\d{4}', header_clean, re.IGNORECASE)
        
        if quarter_match:
            periods.append(quarter_match.group(0))
            continue
        
        # Pattern: Just a year "2023" or "2024" 
        year_only = re.search(r'\b20\d{2}\b', header_clean)
        
        if year_only:
            periods.append(year_only.group(0))
            continue
        
        periods.append(None)
    
    # If no periods found at all, return None for all
    if not any(periods):
        logger.debug(f"No date periods found in headers: {headers[:3]}...")
    else:
        logger.debug(f"Found periods: {[p for p in periods if p][:5]}")
    
    return periods


def clean_value(value: str) -> str:
    """Clean and normalize a financial value."""
    if not value:
        return ""
    
    value = value.strip()
    
    # Remove extra whitespace
    value = " ".join(value.split())
    
    # Normalize currency: "$ 33,916" -> "$33,916"
    value = re.sub(r'\$\s+', '$', value)
    
    # Handle parentheses for negative (keep as is, it's standard)
    
    return value


def format_financial_table(
    title: str,
    headers: list[str],
    grid: list[list[str]],
    periods: list[Optional[str]]
) -> str:
    """
    Convert financial table to LLM-optimized format.
    
    Each value is a COMPLETE self-contained statement:
    ROW_LABEL for PERIOD = VALUE
    
    This ensures no ambiguity when searching for specific metrics.
    """
    lines = []
    
    # Add title
    if title:
        lines.append(f"[{title}]")
        lines.append("")
    
    # Find which columns have period data
    value_columns = [(i, period) for i, period in enumerate(periods) if period]
    
    if not value_columns:
        # Fallback: use header text as period if no dates detected
        value_columns = [(i, h if h.strip() else f"Column {i+1}") for i, h in enumerate(headers) if i > 0]
    
    # If still no columns (headers might be empty), use all columns except first
    if not value_columns and grid and len(grid[0]) > 1:
        value_columns = [(i, f"Column {i+1}") for i in range(1, len(grid[0]))]
    
    logger.debug(f"format_financial_table: {len(value_columns)} value columns detected")
    
    # Process each row
    for row in grid:
        if not row:
            continue
        
        # First column is typically the row label
        row_label = row[0].strip() if row else ""
        
        if not row_label:
            continue
        
        # Skip rows that look like section headers with no data
        if row_label.lower() in ['', 'total', 'subtotal'] and all(not cell.strip() for cell in row[1:]):
            continue
        
        # Output each value as a COMPLETE self-contained statement
        # Format: "ROW_LABEL for PERIOD = VALUE"
        for col_idx, period in value_columns:
            if col_idx < len(row):
                value = clean_value(row[col_idx])
                # Skip empty values, values that match the label, or pure formatting
                if value and value != row_label and not value.startswith('|'):
                    # Each line is completely self-contained - no context needed from other lines
                    lines.append(f"{row_label} for {period} = {value}")
    
    result = "\n".join(lines)
    logger.debug(f"format_financial_table produced {len(lines)} lines, {len(result)} chars")
    return result


def format_as_markdown(headers: list[str], rows: list[list[str]]) -> str:
    """Fallback: Convert 2D grid to markdown table string."""
    if not headers:
        return ""
    
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            if i < len(col_widths):
                col_widths[i] = max(col_widths[i], len(str(cell)))
    
    header_row = "| " + " | ".join(h.ljust(w) for h, w in zip(headers, col_widths)) + " |"
    separator = "|" + "|".join("-" * (w + 2) for w in col_widths) + "|"
    data_rows = [
        "| " + " | ".join(str(cell).ljust(w) for cell, w in zip(row, col_widths)) + " |"
        for row in rows
    ]
    
    return "\n".join([header_row, separator] + data_rows)


def extract_table_title(table_element: Tag) -> str:
    """
    Try to extract table title from surrounding HTML context.
    Looks for preceding headers, captions, or bold text.
    """
    # Check for caption element
    caption = table_element.find('caption')
    if caption:
        return caption.get_text(strip=True)
    
    # Look at previous siblings for title
    prev = table_element.find_previous_sibling()
    for _ in range(3):  # Check up to 3 previous siblings
        if prev is None:
            break
        
        text = prev.get_text(strip=True)
        
        # Check if it looks like a title (short, capitalized, contains keywords)
        if text and len(text) < 200:
            text_lower = text.lower()
            title_keywords = [
                'statement', 'balance sheet', 'income', 'cash flow',
                'comprehensive', 'operations', 'financial', 'consolidated',
                'condensed', 'position', 'equity', 'shareholders'
            ]
            if any(kw in text_lower for kw in title_keywords):
                return text
        
        prev = prev.find_previous_sibling()
    
    # Check parent for title context
    parent = table_element.parent
    if parent:
        # Look for preceding text in parent
        for child in parent.children:
            if child == table_element:
                break
            if hasattr(child, 'get_text'):
                text = child.get_text(strip=True)
                if text and len(text) < 200:
                    text_lower = text.lower()
                    if any(kw in text_lower for kw in ['statement', 'balance', 'income', 'cash']):
                        return text
    
    return ""


def format_table_for_llm(table_element: Tag, fallback_title: str = "") -> str:
    """
    Main entry point: Convert HTML table to LLM-optimized format.
    
    For financial tables: Row-by-row prose format
    For general tables: Markdown format (backward compatible)
    
    Returns formatted string ready for chunking.
    """
    rows = table_element.find_all("tr")
    if not rows:
        return ""
    
    # Extract title
    title = extract_table_title(table_element) or fallback_title
    
    # Find headers
    header_row_idx = 0
    headers = []
    
    for idx, row in enumerate(rows):
        ths = row.find_all("th")
        if ths:
            header_row_idx = idx
            headers = [extract_cell_text(th) for th in ths]
            break
    
    if not headers and rows:
        first_row_cells = rows[0].find_all(['td', 'th'])
        if first_row_cells:
            headers = [extract_cell_text(cell) for cell in first_row_cells]
            header_row_idx = 0
    
    # Extract data rows
    data_rows = rows[header_row_idx + 1:] if len(rows) > header_row_idx + 1 else []
    
    if not data_rows:
        return ""
    
    # Convert to grid
    grid = handle_merged_cells(data_rows)
    
    if not grid:
        return ""
    
    # Detect table type
    table_type = detect_table_type(grid, headers)
    
    logger.debug(f"Table detected as '{table_type}': {title[:50] if title else 'no title'}")
    
    if table_type == "financial":
        # Extract period information from headers AND grid (SEC tables often have dates in sub-header rows)
        periods = extract_column_periods(headers, grid)
        
        # Format as LLM-optimized prose
        formatted = format_financial_table(title, headers, grid, periods)
        
        if formatted.strip():
            return formatted
    
    # Fallback to markdown for general tables or if financial formatting failed
    markdown = format_as_markdown(headers, grid)
    
    if title:
        return f"[{title}]\n\n{markdown}"
    
    return markdown

