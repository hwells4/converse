import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Document, InsertDocument, UpdateDocument } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useCallback, useRef, useEffect } from "react";

// Document states that require active processing monitoring
const PROCESSING_STATES = new Set([
  "uploaded", 
  "processing", 
  "salesforce_upload_pending", 
  "uploading"
]);

// Document states that are stable and don't need frequent polling
const STABLE_STATES = new Set([
  "processed", 
  "failed", 
  "completed", 
  "review_pending"
]);

export function useDocuments() {
  const queryClient = useQueryClient();
  const failureCountRef = useRef(0);
  const lastDataRef = useRef<Document[]>([]);

  const query = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    staleTime: 0, // Always fetch fresh data
    gcTime: 2 * 60 * 1000, // 2 minutes cache time
    refetchIntervalInBackground: true, // Keep polling even when tab is not focused
    refetchInterval: (query) => {
      // Handle exponential backoff for failed requests
      if (query.state.error) {
        failureCountRef.current += 1;
        const backoffMs = Math.min(1000 * Math.pow(2, failureCountRef.current), 30000); // Cap at 30 seconds
        console.log(`📡 Documents query failed, backing off for ${backoffMs}ms (attempt ${failureCountRef.current})`);
        return backoffMs;
      }

      const data = query.state.data;

      // Reset failure count on successful query
      if (data && query.state.error === null) {
        failureCountRef.current = 0;
      }

      // If no data yet, poll every 3 seconds
      if (!data) {
        return 3000;
      }

      // Check if any documents are in processing states
      const hasProcessingDocuments = data.some((doc: Document) => PROCESSING_STATES.has(doc.status));
      
      if (hasProcessingDocuments) {
        // Fast polling for processing documents
        return 2000; // 2 seconds
      } else {
        // Slower polling when all documents are stable
        return 12000; // 12 seconds
      }
    },
    retry: (failureCount, error) => {
      // Retry up to 5 times with exponential backoff
      if (failureCount >= 5) {
        console.error(`📡 Documents query failed after 5 retries:`, error);
        return false;
      }
      return true;
    }
  });

  // Handle successful data updates for logging
  useEffect(() => {
    if (query.data && query.isSuccess) {
      // Store current data for comparison
      lastDataRef.current = query.data;
      
      // Log polling strategy for debugging
      const processingCount = query.data.filter((doc: Document) => PROCESSING_STATES.has(doc.status)).length;
      const stableCount = query.data.filter((doc: Document) => STABLE_STATES.has(doc.status)).length;
      
      if (processingCount > 0) {
        console.log(`📡 Fast polling active: ${processingCount} processing, ${stableCount} stable documents`);
      }
    }
    
    if (query.error) {
      console.error(`📡 Documents query error:`, query.error);
    }
  }, [query.data, query.isSuccess, query.error]);

  // Immediate cache invalidation helper for webhook updates
  const invalidateImmediately = useCallback(async () => {
    console.log("🔄 Webhook update detected - invalidating documents cache immediately");
    
    // Cancel any ongoing queries to prevent race conditions
    await queryClient.cancelQueries({ queryKey: ["/api/documents"] });
    
    // Invalidate and refetch immediately
    await queryClient.invalidateQueries({ 
      queryKey: ["/api/documents"],
      exact: true,
      refetchType: 'active'
    });
  }, [queryClient]);

  // Expose the invalidation method for webhook handlers
  useEffect(() => {
    // Store the invalidation function globally so webhook components can access it
    (window as any).invalidateDocumentsCache = invalidateImmediately;
    
    return () => {
      delete (window as any).invalidateDocumentsCache;
    };
  }, [invalidateImmediately]);

  return {
    ...query,
    invalidateImmediately
  };
}

export function useDocument(id: number, enablePolling = false) {
  const queryClient = useQueryClient();

  return useQuery<Document>({
    queryKey: ["/api/documents", id],
    enabled: !!id,
    staleTime: 0,
    gcTime: 2 * 60 * 1000,
    refetchInterval: enablePolling ? (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      
      // Fast polling if document is in processing state
      if (PROCESSING_STATES.has(data.status)) {
        return 2000; // 2 seconds
      }
      
      // Stop polling once document reaches stable state
      return false;
    } : false,
    refetchIntervalInBackground: enablePolling,
    retry: (failureCount) => failureCount < 3,
  });
}

export function useDocumentProcessedData(id: number) {
  return useQuery<any>({
    queryKey: ["/api/documents", id, "processed-json"],
    queryFn: async () => {
      console.log(`Fetching processed data for document ${id}`);
      const response = await apiRequest("GET", `/api/documents/${id}/processed-json`);
      const data = await response.json();
      console.log(`Received processed data for document ${id}:`, data);
      return data;
    },
    enabled: !!id,
    retry: false, // Don't retry if the processed data isn't available yet
  });
}

export function useDocumentProcessedCSVData(id: number) {
  return useQuery<any>({
    queryKey: ["/api/documents", id, "processed-csv-data"],
    queryFn: async () => {
      console.log(`Fetching processed CSV data for document ${id}`);
      const response = await apiRequest("GET", `/api/documents/${id}/processed-csv-data`);
      const data = await response.json();
      console.log(`Received processed CSV data for document ${id}:`, data);
      return data;
    },
    enabled: !!id,
    retry: false,
  });
}

export function useDocumentCSVData(id: number) {
  return useQuery<any>({
    queryKey: ["/api/documents", id, "csv-data"],
    queryFn: async () => {
      console.log(`Fetching CSV data for document ${id}`);
      const response = await apiRequest("GET", `/api/documents/${id}/csv-data`);
      const data = await response.json();
      console.log(`Received CSV data for document ${id}:`, data);
      return data;
    },
    enabled: !!id,
    retry: false,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (document: InsertDocument): Promise<Document> => {
      const response = await apiRequest("POST", "/api/documents", document);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: UpdateDocument }): Promise<Document> => {
      const response = await apiRequest("PATCH", `/api/documents/${id}`, updates);
      return response.json();
    },
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", document.id] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
  });
}

export function useDocumentsByStatus(status: string) {
  return useQuery<Document[]>({
    queryKey: ["/api/documents/status", status],
    enabled: !!status,
  });
}

// Manual refresh function for force-updating documents
export function useForceRefreshDocuments() {
  const queryClient = useQueryClient();
  
  return useCallback(async () => {
    console.log("🔄 Force refreshing documents...");
    
    // Cancel any ongoing queries to prevent race conditions
    await queryClient.cancelQueries({ queryKey: ["/api/documents"] });
    
    // Reset any error states and refetch
    queryClient.resetQueries({ 
      queryKey: ["/api/documents"],
      exact: true 
    });
    
    // Trigger immediate refetch
    return queryClient.refetchQueries({ 
      queryKey: ["/api/documents"],
      exact: true,
      type: 'active'
    });
  }, [queryClient]);
}

// Enhanced hook for webhook-triggered updates
export function useWebhookRefresh() {
  const queryClient = useQueryClient();
  
  return useCallback(async (documentId?: number) => {
    console.log("🎣 Webhook refresh triggered", documentId ? `for document ${documentId}` : "for all documents");
    
    // Cancel ongoing queries to prevent stale data
    await queryClient.cancelQueries({ queryKey: ["/api/documents"] });
    
    if (documentId) {
      // Also refresh specific document queries
      await queryClient.cancelQueries({ queryKey: ["/api/documents", documentId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/documents", documentId] });
    }
    
    // Force immediate refresh of documents list
    await queryClient.invalidateQueries({ 
      queryKey: ["/api/documents"],
      exact: true,
      refetchType: 'active'
    });
    
    // Return a promise that resolves when the refetch completes
    return queryClient.refetchQueries({ 
      queryKey: ["/api/documents"],
      exact: true,
      type: 'active'
    });
  }, [queryClient]);
}
