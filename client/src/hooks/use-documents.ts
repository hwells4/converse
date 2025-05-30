import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Document, InsertDocument, UpdateDocument } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export function useDocuments() {
  return useQuery<Document[]>({
    queryKey: ["/api/documents"],
    refetchInterval: 5000, // Poll every 5 seconds to check for status updates
  });
}

export function useDocument(id: number) {
  return useQuery<Document>({
    queryKey: ["/api/documents", id],
    enabled: !!id,
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
