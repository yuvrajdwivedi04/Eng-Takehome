from dataclasses import dataclass
from bs4 import BeautifulSoup
import csv
from io import StringIO
from app.services.rag.chunker import extract_cell_text, handle_merged_cells


@dataclass
class TableData:
    """Structured representation of a table for CSV export."""
    headers: list[str]
    rows: list[list[str]]


def extract_table_at_index(html: str, index: int) -> TableData | None:
    """
    Extract a specific table from HTML by index.
    
    Args:
        html: Raw HTML content
        index: Zero-based index of the table to extract
        
    Returns:
        TableData if table exists at index, None otherwise
    """
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")
    
    if index < 0 or index >= len(tables):
        return None
    
    table_element = tables[index]
    rows = table_element.find_all("tr")
    
    if not rows:
        return None
    
    # Detect headers (first row with <th> OR first row if no <th>)
    header_row_idx = 0
    headers = []
    
    for idx, row in enumerate(rows):
        ths = row.find_all("th")
        if ths:
            header_row_idx = idx
            headers = [extract_cell_text(th) for th in ths]
            break
    
    # If no <th> found, use first row as headers
    if not headers and rows:
        first_row_cells = rows[0].find_all(['td', 'th'])
        if first_row_cells:
            headers = [extract_cell_text(cell) for cell in first_row_cells]
            header_row_idx = 0
        else:
            # No headers at all, generate generic ones
            first_data_cells = rows[1].find_all(['td', 'th']) if len(rows) > 1 else []
            col_count = len(first_data_cells) if first_data_cells else 1
            headers = [f"Column {i+1}" for i in range(col_count)]
    
    # Extract data rows (all rows after header)
    data_rows = rows[header_row_idx + 1:] if len(rows) > header_row_idx + 1 else []
    
    if not data_rows:
        # Table with headers only
        return TableData(headers=headers, rows=[])
    
    # Handle merged cells to create regular grid
    grid = handle_merged_cells(data_rows)
    
    if not grid:
        return TableData(headers=headers, rows=[])
    
    return TableData(headers=headers, rows=grid)


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



