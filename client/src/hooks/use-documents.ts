import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Document, InsertDocument, UpdateDocument } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export function useDocuments() {
  return useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });
}

export function useDocument(id: number) {
  return useQuery<Document>({
    queryKey: ["/api/documents", id],
    enabled: !!id,
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
