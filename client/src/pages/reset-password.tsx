import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ResetPasswordForm {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

interface ResetPasswordResponse {
  message: string;
}

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState<ResetPasswordForm>({
    token: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [resetComplete, setResetComplete] = useState(false);

  // Extract token from URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setFormData(prev => ({ ...prev, token }));
    }
  }, []);

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: Omit<ResetPasswordForm, 'confirmPassword'>): Promise<ResetPasswordResponse> => {
      const response = await apiRequest("POST", "/api/auth/reset-password", data);
      return response.json();
    },
    onSuccess: (data) => {
      setResetComplete(true);
      toast({
        title: "Password Reset Successful",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords match
    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    // Validate token exists
    if (!formData.token) {
      toast({
        title: "Invalid Reset Link",
        description: "This reset link is invalid or has expired.",
        variant: "destructive",
      });
      return;
    }

    // Submit form data (excluding confirmPassword)
    const { confirmPassword, ...submitData } = formData;
    resetPasswordMutation.mutate(submitData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const passwordsMatch = formData.newPassword === formData.confirmPassword || formData.confirmPassword === "";

  if (resetComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Password Reset Complete</CardTitle>
            <CardDescription className="text-center">
              Your password has been successfully updated
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Your password has been reset successfully. You can now sign in with your new password.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={() => setLocation("/sign-in")}
              className="w-full"
            >
              Continue to Sign In
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Show error if no token in URL
  if (!formData.token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Invalid Reset Link</CardTitle>
            <CardDescription className="text-center">
              This password reset link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                This reset link is invalid, expired, or has already been used. 
                Please request a new password reset link.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Link href="/forgot-password" className="w-full">
              <Button className="w-full">
                Request New Reset Link
              </Button>
            </Link>
            <div className="text-center text-sm text-gray-600">
              <Link href="/sign-in" className="text-blue-600 hover:underline">
                Back to Sign In
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Reset Password</CardTitle>
          <CardDescription className="text-center">
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={handleInputChange}
                required
                placeholder="Enter your new password"
                disabled={resetPasswordMutation.isPending}
              />
              <p className="text-xs text-gray-500">
                Must be at least 8 characters with uppercase, lowercase, and number
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                placeholder="Confirm your new password"
                disabled={resetPasswordMutation.isPending}
                className={!passwordsMatch ? "border-red-500" : ""}
              />
              {!passwordsMatch && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>
            {resetPasswordMutation.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {resetPasswordMutation.error.message}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={resetPasswordMutation.isPending || !passwordsMatch}
            >
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
            <div className="text-center text-sm text-gray-600">
              <Link href="/sign-in" className="text-blue-600 hover:underline">
                Back to Sign In
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}