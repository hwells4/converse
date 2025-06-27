// List of endpoints that require authentication
const PROTECTED_ENDPOINTS = [
  // Document management
  { method: 'POST', pattern: /^\/api\/documents$/ },
  { method: 'PATCH', pattern: /^\/api\/documents\/\d+$/ },
  { method: 'DELETE', pattern: /^\/api\/documents\/\d+$/ },
  
  // Carrier management
  { method: 'POST', pattern: /^\/api\/carriers$/ },
  { method: 'PATCH', pattern: /^\/api\/carriers\/\d+$/ },
  { method: 'DELETE', pattern: /^\/api\/carriers\/\d+$/ },
  
  // S3 operations
  { method: 'POST', pattern: /^\/api\/s3\// },
  
  // Processing triggers
  { method: 'POST', pattern: /^\/api\/pdf-parser\/trigger$/ },
  { method: 'POST', pattern: /^\/api\/lambda\/invoke-textract$/ },
];

function isProtectedEndpoint(method: string, url: string): boolean {
  const path = new URL(url, window.location.origin).pathname;
  return PROTECTED_ENDPOINTS.some(endpoint => 
    endpoint.method === method && endpoint.pattern.test(path)
  );
}

export async function authFetch(url: string, options: RequestInit = {}) {
  const method = options.method || 'GET';
  
  // Add credentials: 'include' to all requests to send session cookies
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include',
  };
  
  // For protected endpoints, we rely on session-based authentication
  // The server will check the session cookie automatically
  
  const response = await fetch(url, fetchOptions);
  
  // Handle authentication errors
  if (response.status === 401) {
    // Redirect to sign-in page if not authenticated
    window.location.href = '/sign-in';
    throw new Error('Authentication required');
  }
  
  return response;
}

// Simple hook wrapper for consistency
export function useAuthFetch() {
  return authFetch;
}