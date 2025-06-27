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

interface SignUpForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  invitationToken: string;
}

interface SignUpResponse {
  message: string;
  user: {
    id: number;
    username: string;
    email: string;
    isActive: boolean;
    createdAt: string;
  };
}

export default function SignUpPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Redirect if already authenticated
  const { isLoading: isCheckingAuth } = useRedirectIfAuthenticated();
  
  const [formData, setFormData] = useState<SignUpForm>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    invitationToken: "",
  });

  const signUpMutation = useMutation({
    mutationFn: async (data: Omit<SignUpForm, 'confirmPassword'>): Promise<SignUpResponse> => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Your account has been created successfully.",
      });
      
      // Update user data in cache
      queryClient.setQueryData(["/api/auth/me"], data.user);
      
      // Redirect to home page
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    // Submit form data (excluding confirmPassword)
    const { confirmPassword, ...submitData } = formData;
    signUpMutation.mutate(submitData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const passwordsMatch = formData.password === formData.confirmPassword || formData.confirmPassword === "";

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
          <CardTitle className="text-2xl font-bold text-center">Join Converse AI Hub</CardTitle>
          <CardDescription className="text-center">
            Create an account to access AI-powered document processing
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
                placeholder="Choose a username"
                disabled={signUpMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="Enter your email"
                disabled={signUpMutation.isPending}
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
                placeholder="Create a password"
                disabled={signUpMutation.isPending}
              />
              <p className="text-xs text-gray-500">
                Must be at least 8 characters with uppercase, lowercase, and number
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                placeholder="Confirm your password"
                disabled={signUpMutation.isPending}
                className={!passwordsMatch ? "border-red-500" : ""}
              />
              {!passwordsMatch && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="invitationToken">Invitation Token</Label>
              <Input
                id="invitationToken"
                name="invitationToken"
                type="text"
                value={formData.invitationToken}
                onChange={handleInputChange}
                required
                placeholder="Enter your invitation token"
                disabled={signUpMutation.isPending}
              />
              <p className="text-xs text-gray-500">
                You need an invitation token to create an account
              </p>
            </div>
            {signUpMutation.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {signUpMutation.error.message}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={signUpMutation.isPending || !passwordsMatch}
            >
              {signUpMutation.isPending ? "Creating Account..." : "Sign Up"}
            </Button>
            <div className="text-center text-sm text-gray-600">
              <p>
                Already have an account?{" "}
                <Link href="/sign-in" className="text-blue-600 hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}