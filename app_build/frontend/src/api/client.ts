const BASE_URL = '/api';
const TENANT_ID = '42'; // Hardcoded for this assessment

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('X-Tenant-Id', TENANT_ID);
  
  // Set Content-Type only if it's not FormData
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw {
      status: res.status,
      message: errorData.error || res.statusText,
      details: errorData.details,
    };
  }

  if (res.status === 204) return null;

  return res.json();
}
