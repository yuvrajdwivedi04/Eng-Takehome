const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface FilingResponse {
  id: string;
  sourceUrl: string;
  html: string;
}

export async function fetchFiling(url: string): Promise<FilingResponse> {
  const response = await fetch(`${API_BASE_URL}/api/filings/open-filing`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch filing" }));
    throw new Error(error.detail || "Failed to fetch filing");
  }

  return response.json();
}

export function getTableCsvUrl(filingId: string, tableIndex: number): string {
  return `${API_BASE_URL}/api/filings/${filingId}/tables/${tableIndex}.csv`;
}

export function getTableXlsxUrl(filingId: string, tableIndex: number): string {
  return `${API_BASE_URL}/api/filings/${filingId}/tables/${tableIndex}.xlsx`;
}

export function getAllTablesXlsxUrl(filingId: string): string {
  return `${API_BASE_URL}/api/filings/${filingId}/tables/all.xlsx`;
}

export function getAllTablesCsvZipUrl(filingId: string): string {
  return `${API_BASE_URL}/api/filings/${filingId}/tables/all.zip`;
}

// Exhibit types and API
export interface Exhibit {
  name: string;
  description: string;
  url: string;
}

export interface ExhibitsResponse {
  exhibits: Exhibit[];
  sourceUrl: string;
}

export async function fetchExhibits(filingId: string): Promise<ExhibitsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/filings/${filingId}/exhibits`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch exhibits" }));
    throw new Error(error.detail || "Failed to fetch exhibits");
  }
  
  return response.json();
}

// Company search types and API
export interface CompanyFiling {
  form: string;
  filingDate: string;
  description: string;
  url: string;
  accessionNumber: string;
}

export interface CompanyFilingsResponse {
  cik: string;
  name: string;
  ticker: string | null;
  filings: CompanyFiling[];
}

export async function searchByTicker(ticker: string): Promise<CompanyFilingsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/company/search/ticker/${encodeURIComponent(ticker.trim())}`
  );
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to search by ticker" }));
    throw new Error(error.detail || "Failed to search by ticker");
  }
  
  return response.json();
}

export async function searchByCIK(cik: string): Promise<CompanyFilingsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/company/search/cik/${encodeURIComponent(cik.trim())}`
  );
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to search by CIK" }));
    throw new Error(error.detail || "Failed to search by CIK");
  }
  
  return response.json();
}

