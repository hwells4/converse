import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Carrier, InsertCarrier } from "@shared/schema";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Fetch all carriers
export function useCarriers() {
  return useQuery({
    queryKey: ["carriers"],
    queryFn: async (): Promise<Carrier[]> => {
      const response = await fetch(`${API_BASE_URL}/api/carriers`);
      if (!response.ok) {
        throw new Error("Failed to fetch carriers");
      }
      return response.json();
    },
  });
}

// Fetch single carrier by ID
export function useCarrier(id: number) {
  return useQuery({
    queryKey: ["carriers", id],
    queryFn: async (): Promise<Carrier> => {
      const response = await fetch(`${API_BASE_URL}/api/carriers/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch carrier");
      }
      return response.json();
    },
    enabled: !!id,
  });
}

// Create new carrier
export function useCreateCarrier() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (carrier: InsertCarrier): Promise<Carrier> => {
      const response = await fetch(`${API_BASE_URL}/api/carriers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(carrier),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create carrier");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate carriers query to refetch the list
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
    },
  });
} 