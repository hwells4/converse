import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useRedirectIfAuthenticated } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

interface LoginForm {
  username: string;
  password: string;
}

interface LoginResponse {
  message: string;
  user: {
    id: number;
    username: string;
    email: string;
    isActive: boolean;
    createdAt: string;
  };
}

export default function SignInPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Redirect if already authenticated
  const { isLoading: isCheckingAuth } = useRedirectIfAuthenticated();
  
  const [formData, setFormData] = useState<LoginForm>({
    username: "",
    password: "",
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm): Promise<LoginResponse> => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "You have been logged in successfully.",
      });
      
      // Update user data in cache
      queryClient.setQueryData(["/api/auth/me"], data.user);
      
      // Redirect to home page
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(formData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Sign In to Converse AI Hub</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access your AI-powered workspace
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                required
                placeholder="Enter your username"
                disabled={loginMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                placeholder="Enter your password"
                disabled={loginMutation.isPending}
              />
            </div>
            {loginMutation.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {loginMutation.error.message}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Signing In..." : "Sign In"}
            </Button>
            <div className="text-center text-sm text-gray-600 space-y-2">
              <p>
                <Link href="/forgot-password" className="text-blue-600 hover:underline">
                  Forgot your password?
                </Link>
              </p>
              <p>
                Don't have an account?{" "}
                <Link href="/sign-up" className="text-blue-600 hover:underline">
                  Sign up
                </Link>
              </p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}