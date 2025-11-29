from bs4 import BeautifulSoup
import re


def _unhide_sec_containers(soup: BeautifulSoup) -> None:
    """
    Remove hiding styles from known SEC filing content containers.
    
    SEC filings often wrap main content in divs with specific IDs (formDiv, Report, etc.)
    and use inline styles to hide them initially. JavaScript would normally unhide these
    on user interaction, but since we remove scripts for security, we need to unhide
    these containers explicitly to make the filing content visible.
    """
    # Known SEC filing container IDs
    filing_container_ids = ['formDiv', 'formDiv1', 'formDiv2', 'Report', 'FilingSummary', 'MainContent']
    
    for container_id in filing_container_ids:
        # Use find_all to handle duplicate IDs in non-compliant SEC HTML
        elements = soup.find_all(id=container_id)
        
        for element in elements:
            if element.has_attr('style'):
                style = element['style']
                
                # Remove display:none (case-insensitive, flexible whitespace)
                style = re.sub(r'display\s*:\s*none\s*;?', '', style, flags=re.IGNORECASE)
                
                # Remove visibility:hidden (case-insensitive, flexible whitespace)
                style = re.sub(r'visibility\s*:\s*hidden\s*;?', '', style, flags=re.IGNORECASE)
                
                # Normalize: collapse multiple semicolons
                style = re.sub(r';+', ';', style)
                
                # Normalize: strip leading/trailing whitespace and semicolons
                style = style.strip().strip(';').strip()
                
                # Remove attribute if empty, otherwise update it
                if not style:
                    del element['style']
                else:
                    element['style'] = style


def sanitize(html: str) -> str:
    """
    Sanitize HTML by removing scripts, event handlers, external assets, and styles.

    Removes:
    - <script> tags
    - <link rel="stylesheet"> tags
    - <style> blocks
    - <img> tags
    - Event handler attributes (onclick, onload, onerror, etc.)
    - javascript: URLs in href/src/style attributes

    Preserves:
    - Text content
    - Tables and table structure
    - Headings, paragraphs, lists
    - Safe hyperlinks

    Args:
        html: Raw HTML string

    Returns:
        Sanitized HTML string safe for rendering without external asset requests
    """
    soup = BeautifulSoup(html, "html.parser")
    
    # Remove all <script> tags
    for script in soup.find_all("script"):
        script.decompose()
    
    # Remove all <link rel="stylesheet"> tags
    for link in soup.find_all("link", rel="stylesheet"):
        link.decompose()
    
    # Remove all <style> tags
    for style in soup.find_all("style"):
        style.decompose()
    
    # Remove all <img> tags
    for img in soup.find_all("img"):
        img.decompose()
    
    # Event handler attributes to remove
    event_handlers = [
        "onclick", "onload", "onerror", "onmouseover", "onmouseout",
        "onmousemove", "onmousedown", "onmouseup", "onfocus", "onblur",
        "onchange", "onsubmit", "onkeydown", "onkeyup", "onkeypress",
        "ondblclick", "oncontextmenu", "oninput", "onscroll"
    ]
    
    # Remove event handlers and javascript: URLs from all tags
    for tag in soup.find_all():
        # Remove event handler attributes
        for attr in event_handlers:
            if tag.has_attr(attr):
                del tag[attr]
        
        # Remove javascript: URLs from href, src, and style attributes
        for attr in ["href", "src", "style"]:
            if tag.has_attr(attr):
                value = tag[attr]
                if isinstance(value, str) and re.search(r"javascript:", value, re.IGNORECASE):
                    del tag[attr]
    
    # Unhide known SEC filing content containers
    _unhide_sec_containers(soup)
    
    # Add data-table-index attributes for CSV export feature
    for index, table in enumerate(soup.find_all("table")):
        table["data-table-index"] = str(index)
    
    # Add data-element-index attributes for deep linking feature
    element_index = 0
    
    # Semantic elements to always index (headings, emphasized text)
    semantic_tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b']
    
    # Index semantic elements first (headings, bold text, etc.)
    for tag in soup.find_all(semantic_tags):
        text_content = tag.get_text(separator=" ", strip=True)
        if len(text_content) > 0:  # Any non-empty semantic element
            tag["data-element-index"] = str(element_index)
            element_index += 1
    
    # Then index substantial text blocks (paragraphs, divs, list items, cells)
    text_block_tags = ['p', 'div', 'li', 'td', 'th']
    for tag in soup.find_all(text_block_tags):
        # Skip if already indexed
        if tag.has_attr('data-element-index'):
            continue
        
        text_content = tag.get_text(separator=" ", strip=True)
        if len(text_content) >= 20:  # Only index substantial text blocks
            tag["data-element-index"] = str(element_index)
            element_index += 1
    
    return str(soup)

