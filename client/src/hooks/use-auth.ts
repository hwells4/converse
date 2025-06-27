import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  username: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

interface AuthResponse {
  user: User;
}

// Hook to get current user
export function useUser() {
  return useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/auth/me");
        const data: AuthResponse = await response.json();
        return data.user;
      } catch (error: any) {
        // If user is not authenticated, return null instead of throwing
        if (error.message.includes("401")) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to check if user is authenticated
export function useIsAuthenticated() {
  const { data: user, isLoading } = useUser();
  return {
    isAuthenticated: !!user,
    isLoading,
    user,
  };
}

// Hook to logout
export function useLogout() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout");
      return response.json();
    },
    onSuccess: () => {
      // Clear all cached user data
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      // Redirect to sign-in page
      setLocation("/sign-in");
    },
    onError: (error) => {
      console.error("Logout error:", error);
      // Even if logout fails on server, clear local state and redirect
      queryClient.setQueryData(["/api/auth/me"], null);
      setLocation("/sign-in");
    },
  });
}

// Hook to require authentication (redirect if not authenticated)
export function useRequireAuth() {
  const { isAuthenticated, isLoading, user } = useIsAuthenticated();
  const [, setLocation] = useLocation();

  // Redirect to sign-in if not authenticated (after loading completes)
  if (!isLoading && !isAuthenticated) {
    setLocation("/sign-in");
  }

  return {
    isAuthenticated,
    isLoading,
    user,
  };
}

// Hook to redirect authenticated users (for sign-in/sign-up pages)
export function useRedirectIfAuthenticated() {
  const { isAuthenticated, isLoading } = useIsAuthenticated();
  const [, setLocation] = useLocation();

  // Redirect to home if already authenticated (after loading completes)
  if (!isLoading && isAuthenticated) {
    setLocation("/");
  }

  return {
    isAuthenticated,
    isLoading,
  };
}