import { useCallback } from "react";
import { apiRequest as baseApiRequest } from "./queryClient";

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

export function useAuthApiRequest() {
  return useCallback(async (
    method: string,
    url: string,
    data?: unknown
  ): Promise<Response> => {
    let headers: HeadersInit = data ? { "Content-Type": "application/json" } : {};
    
    // For session-based auth, we don't need to add auth headers
    // The session cookie is sent automatically with credentials: 'include'
    
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // This sends the session cookie
    });

    // Handle authentication errors
    if (res.status === 401) {
      // Redirect to sign-in page if not authenticated
      window.location.href = '/sign-in';
      throw new Error('Authentication required');
    }

    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
    
    return res;
  }, []);
}