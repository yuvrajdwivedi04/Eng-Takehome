const API_BASE_URL = "http://localhost:8000";

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

