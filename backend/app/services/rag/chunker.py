import tiktoken
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)


def extract_cell_text(cell) -> str:
    """Extract clean text from table cell, handling nested HTML."""
    text = cell.get_text(separator=" ", strip=True)
    # Remove extra whitespace
    text = " ".join(text.split())
    return text


def handle_merged_cells(rows) -> list[list[str]]:
    """Convert table with colspan/rowspan to regular 2D grid."""
    if not rows:
        return []
    
    # Determine grid dimensions
    max_cols = 0
    for row in rows:
        cols = sum(int(cell.get('colspan', 1)) for cell in row.find_all(['td', 'th']))
        max_cols = max(max_cols, cols)
    
    if max_cols == 0:
        return []
    
    row_count = len(rows)
    grid = [[None] * max_cols for _ in range(row_count)]
    
    # Fill grid
    for row_idx, row in enumerate(rows):
        col_idx = 0
        for cell in row.find_all(['td', 'th']):
            # Skip already-filled cells (from previous rowspan)
            while col_idx < max_cols and grid[row_idx][col_idx] is not None:
                col_idx += 1
            
            if col_idx >= max_cols:
                break
            
            colspan = int(cell.get('colspan', 1))
            rowspan = int(cell.get('rowspan', 1))
            text = extract_cell_text(cell)
            
            # Fill grid with repeated content for merged cells
            for r in range(min(rowspan, row_count - row_idx)):
                for c in range(min(colspan, max_cols - col_idx)):
                    grid[row_idx + r][col_idx + c] = text
            
            col_idx += colspan
    
    # Replace None with empty string
    return [[cell or "" for cell in row] for row in grid]


def format_as_markdown(headers: list[str], rows: list[list[str]]) -> str:
    """Convert 2D grid to markdown table string with column alignment."""
    if not headers:
        return ""
    
    # Calculate column widths for alignment
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            if i < len(col_widths):
                col_widths[i] = max(col_widths[i], len(str(cell)))
    
    # Format header row
    header_row = "| " + " | ".join(h.ljust(w) for h, w in zip(headers, col_widths)) + " |"
    
    # Format separator
    separator = "|" + "|".join("-" * (w + 2) for w in col_widths) + "|"
    
    # Format data rows
    data_rows = [
        "| " + " | ".join(str(cell).ljust(w) for cell, w in zip(row, col_widths)) + " |"
        for row in rows
    ]
    
    return "\n".join([header_row, separator] + data_rows)


def split_large_table(headers: list[str], rows: list[list[str]], max_tokens: int = 1200) -> list[str]:
    """Split large table into multiple markdown chunks with headers preserved."""
    header_md = format_as_markdown(headers, [])
    header_tokens = count_tokens(header_md) + 50  # +50 for separator and spacing
    
    chunks = []
    current_rows = []
    current_tokens = header_tokens
    
    for idx, row in enumerate(rows):
        row_text = " | ".join(str(cell) for cell in row)
        row_tokens = count_tokens(row_text)
        
        if current_tokens + row_tokens > max_tokens and current_rows:
            # Chunk is full, create markdown with note
            start_idx = idx - len(current_rows)
            note = f"[Table excerpt: rows {start_idx} to {idx - 1} of {len(rows)} total]\n\n"
            chunk_md = note + format_as_markdown(headers, current_rows)
            chunks.append(chunk_md)
            
            current_rows = []
            current_tokens = header_tokens
        
        current_rows.append(row)
        current_tokens += row_tokens
    
    # Add remaining rows
    if current_rows:
        start_idx = len(rows) - len(current_rows)
        note = f"[Table excerpt: rows {start_idx} to {len(rows) - 1} of {len(rows)} total]\n\n"
        chunk_md = note + format_as_markdown(headers, current_rows)
        chunks.append(chunk_md)
    
    return chunks


def table_to_markdown(table_element) -> str | list[str]:
    """
    Convert HTML table to markdown, splitting if large.
    Returns single markdown string or list of strings if split.
    """
    rows = table_element.find_all("tr")
    if not rows:
        return ""
    
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
            # Determine column count from first data row
            first_data_cells = rows[1].find_all(['td', 'th']) if len(rows) > 1 else []
            col_count = len(first_data_cells) if first_data_cells else 1
            headers = [f"Column {i+1}" for i in range(col_count)]
    
    # Extract data rows (all rows after header)
    data_rows = rows[header_row_idx + 1:] if len(rows) > header_row_idx + 1 else []
    
    if not data_rows:
        return ""
    
    # Handle merged cells to create regular grid
    grid = handle_merged_cells(data_rows)
    
    if not grid:
        return ""
    
    # Format as markdown
    markdown = format_as_markdown(headers, grid)
    
    # Check if table is too large
    token_count = count_tokens(markdown)
    if token_count > 1200:
        logger.debug(f"Large table detected ({token_count} tokens), splitting by rows")
        return split_large_table(headers, grid, max_tokens=1200)
    
    return markdown


def extract_tables(soup: BeautifulSoup) -> list[dict]:
    """Extract all tables and convert to markdown with error handling."""
    tables = []
    table_elements = soup.find_all("table")
    
    for i, table_elem in enumerate(table_elements):
        try:
            markdown = table_to_markdown(table_elem)
            
            if markdown:  # Skip empty tables
                # Handle both single string and list (for split tables)
                if isinstance(markdown, list):
                    # Large table was split
                    for idx, md_chunk in enumerate(markdown):
                        tables.append({
                            "markdown": md_chunk,
                            "index": i,
                            "sub_index": idx,
                            "is_split": True
                        })
                else:
                    tables.append({
                        "markdown": markdown,
                        "index": i,
                        "is_split": False
                    })
        except Exception as e:
            logger.warning(f"Failed to convert table {i}: {str(e)}")
            # Continue with next table - don't crash entire process
    
    logger.info(f"Extracted {len(tables)} table chunks from {len(table_elements)} tables")
    return tables


def chunk_filing(html: str) -> list[dict]:
    """
    Phase 3B: Extract tables, convert to markdown, chunk with structure preserved.
    """
    soup = BeautifulSoup(html, "html.parser")
    
    # Extract and convert tables to markdown
    tables = extract_tables(soup)
    
    # Replace tables with placeholders in HTML
    for i, table_elem in enumerate(soup.find_all("table")):
        placeholder = f"[TABLE_{i}_PLACEHOLDER]"
        table_elem.replace_with(placeholder)
    
    # Extract text (now with placeholders instead of table HTML)
    text = soup.get_text(separator=" ", strip=True)
    
    # Group split tables by index and join them
    tables_by_index = {}
    for table_data in tables:
        idx = table_data["index"]
        if idx not in tables_by_index:
            tables_by_index[idx] = []
        tables_by_index[idx].append(table_data["markdown"])
    
    # Reinsert markdown tables at placeholder positions
    for idx, markdown_parts in tables_by_index.items():
        placeholder = f"[TABLE_{idx}_PLACEHOLDER]"
        combined_markdown = "\n\n".join(markdown_parts)
        text = text.replace(placeholder, f"\n\n{combined_markdown}\n\n", 1)
    
    # Chunk the combined text (with markdown tables)
    chunks = chunk_text(text, max_tokens=1000, overlap=200)
    
    # Return chunks with metadata
    return [
        {
            "id": f"chunk-{i}",
            "text": chunk,
            "metadata": {
                "position": i,
                "token_count": count_tokens(chunk),
                "has_table": "| " in chunk  # Markdown table marker
            }
        }
        for i, chunk in enumerate(chunks)
    ]


def chunk_text(text: str, max_tokens: int = 1000, overlap: int = 200) -> list[str]:
    """Split text into overlapping chunks of ~max_tokens."""
    encoding = tiktoken.encoding_for_model("gpt-4")
    tokens = encoding.encode(text)
    
    chunks = []
    start = 0
    
    while start < len(tokens):
        end = start + max_tokens
        chunk_tokens = tokens[start:end]
        
        # Enforce hard max of 1500 tokens
        if len(chunk_tokens) > 1500:
            chunk_tokens = chunk_tokens[:1500]
            logger.warning(f"Truncated chunk to 1500 tokens")
        
        chunks.append(encoding.decode(chunk_tokens))
        start += max_tokens - overlap
    
    return chunks


def count_tokens(text: str) -> int:
    """Count tokens in text using GPT-4 encoding."""
    encoding = tiktoken.encoding_for_model("gpt-4")
    return len(encoding.encode(text))

