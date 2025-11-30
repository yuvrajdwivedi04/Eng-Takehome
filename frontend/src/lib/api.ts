import { API_BASE_URL } from "./constants";

/**
 * Generic fetch wrapper with consistent error handling.
 * Preserves per-endpoint error messages via fallbackError parameter.
 */
async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  fallbackError = "Request failed"
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: fallbackError }));
    throw new Error(error.detail || fallbackError);
  }

  return response.json();
}

export interface FilingResponse {
  id: string;
  sourceUrl: string;
  html: string;
}

export async function fetchFiling(url: string): Promise<FilingResponse> {
  return apiFetch<FilingResponse>(
    "/api/filings/open-filing",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    },
    "Failed to fetch filing"
  );
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
  return apiFetch<ExhibitsResponse>(
    `/api/filings/${filingId}/exhibits`,
    undefined,
    "Failed to fetch exhibits"
  );
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
  return apiFetch<CompanyFilingsResponse>(
    `/api/company/search/ticker/${encodeURIComponent(ticker.trim())}`,
    undefined,
    "Failed to search by ticker"
  );
}

export async function searchByCIK(cik: string): Promise<CompanyFilingsResponse> {
  return apiFetch<CompanyFilingsResponse>(
    `/api/company/search/cik/${encodeURIComponent(cik.trim())}`,
    undefined,
    "Failed to search by CIK"
  );
}
