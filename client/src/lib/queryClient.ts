import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    // Add timestamp to prevent caching
    const urlWithTimestamp = url.includes('?') 
      ? `${url}&_t=${Date.now()}` 
      : `${url}?_t=${Date.now()}`;
    
    const res = await fetch(urlWithTimestamp, {
      credentials: "include",
      cache: "no-store", // Force no caching
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    // Get response text first so we can debug if needed
    const text = await res.text();
    
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('🚨 JSON PARSING ERROR:');
      console.error('URL:', url);
      console.error('Status:', res.status);
      console.error('Headers:', Object.fromEntries(res.headers.entries()));
      console.error('Response body:', text);
      console.error('Original error:', error);
      
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // Don't set refetchInterval or staleTime here - let individual queries control their own behavior
      refetchOnWindowFocus: false,
      gcTime: 2 * 60 * 1000, // 2 minutes garbage collection
      retry: false,
      // Force network requests
      networkMode: 'always',
    },
    mutations: {
      retry: false,
    },
  },
});
