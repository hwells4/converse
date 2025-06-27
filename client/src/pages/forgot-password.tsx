import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ForgotPasswordForm {
  email: string;
}

interface ForgotPasswordResponse {
  message: string;
}

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<ForgotPasswordForm>({
    email: "",
  });
  const [emailSent, setEmailSent] = useState(false);

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordForm): Promise<ForgotPasswordResponse> => {
      const response = await apiRequest("POST", "/api/auth/forgot-password", data);
      return response.json();
    },
    onSuccess: (data) => {
      setEmailSent(true);
      toast({
        title: "Reset Email Sent",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    forgotPasswordMutation.mutate(formData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Check Your Email</CardTitle>
            <CardDescription className="text-center">
              Password reset instructions have been sent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                If an account with that email exists, a reset link has been sent. 
                Please check your email and follow the instructions to reset your password.
              </AlertDescription>
            </Alert>
            <div className="text-center text-sm text-gray-600">
              <p>Didn't receive an email? Check your spam folder or try again in a few minutes.</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              onClick={() => setEmailSent(false)}
              variant="outline"
              className="w-full"
            >
              Try Again
            </Button>
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
          <CardTitle className="text-2xl font-bold text-center">Forgot Password</CardTitle>
          <CardDescription className="text-center">
            Enter your email address and we'll send you a reset link
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="Enter your email address"
                disabled={forgotPasswordMutation.isPending}
              />
            </div>
            {forgotPasswordMutation.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {forgotPasswordMutation.error.message}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={forgotPasswordMutation.isPending}
            >
              {forgotPasswordMutation.isPending ? "Sending..." : "Send Reset Link"}
            </Button>
            <div className="text-center text-sm text-gray-600">
              <p>
                Remember your password?{" "}
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