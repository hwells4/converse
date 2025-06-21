import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Document, InsertDocument, UpdateDocument } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useEffect, useRef } from "react";

// Debug version of useDocuments with extensive logging
export function useDocumentsWithLogging() {
  const lastFetchTime = useRef<Date>();
  const fetchCount = useRef(0);
  
  const query = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      fetchCount.current++;
      const now = new Date();
      console.log(`🔄 [${fetchCount.current}] Fetching documents at ${now.toLocaleTimeString()}`);
      
      if (lastFetchTime.current) {
        const timeSince = (now.getTime() - lastFetchTime.current.getTime()) / 1000;
        console.log(`⏱️ Time since last fetch: ${timeSince}s`);
      }
      
      lastFetchTime.current = now;
      
      const response = await apiRequest("GET", "/api/documents");
      const data = await response.json();
      
      console.log(`📦 Received ${data.length} documents`);
      
      // Log status of specific documents
      const importantDocs = data.filter((doc: Document) => 
        doc.status === "salesforce_upload_pending" || 
        doc.status === "uploading" ||
        doc.status === "completed_with_errors"
      );
      
      if (importantDocs.length > 0) {
        console.log("🎯 Important document statuses:");
        importantDocs.forEach((doc: Document) => {
          console.log(`  - Doc ${doc.id}: ${doc.status}`);
        });
      }
      
      return data;
    },
    refetchInterval: 5000,
    staleTime: 0,
    gcTime: 0,
    retry: 3,
    refetchIntervalInBackground: true,
  });
  
  // Log when data changes
  useEffect(() => {
    if (query.data) {
      console.log("✅ Documents data updated in React component");
    }
  }, [query.data]);
  
  return query;
}