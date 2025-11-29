"""
Shared heuristics for detecting data tables vs layout tables.
Used by both sanitize_html.py and csv_generator.py.
"""
import re


def is_data_table(table_element) -> bool:
    """
    Filter layout tables from data tables using financial heuristics.
    Returns True for financial/data tables, False for layout tables.
    """
    rows = table_element.find_all('tr')
    cells = table_element.find_all(['td', 'th'])
    text = table_element.get_text(strip=True)
    
    if len(rows) < 2 or len(cells) < 6 or len(text) < 50:
        return False
    
    has_currency = bool(re.search(r'[\$€£¥]', text))
    has_formatted_nums = bool(re.search(r'\d{1,3}(,\d{3})+', text))
    has_percentages = bool(re.search(r'\d+\.?\d*\s*%', text))
    num_count = len(re.findall(r'\d+', text))
    
    return has_currency or has_formatted_nums or has_percentages or num_count >= 8

