"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import Logo from "@/components/logo";
import { Input } from "@/components/ui/input";
import TextLinkButton from "@/components/text-link-button";
import MainButton from "@/components/main-button";
import SocialLoginButton from "@/components/social-login-button";
import PasskeyButton from "@/components/passkey-button";
import { useToast } from "@/components/ui/toast";
import { validateEmail, validatePassword } from "@/lib/validation";
import { authenticateWithPasskey } from "@/lib/webauthn";
import {
  OAuthErrorDisplay,
  useOAuthError,
} from "@/components/oauth-error-display";
import { parseOAuthError } from "@/lib/oauth-errors";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const { addToast } = useToast();

  // Get OAuth error information for display
  const oauthErrorParams = {
    error: searchParams.get("error"),
    error_description: searchParams.get("error_description"),
    error_uri: searchParams.get("error_uri"),
  };
  const { hasError: hasOAuthError, isRetryable } =
    useOAuthError(oauthErrorParams);

  // Handle URL parameters for success and error messages
  useEffect(() => {
    const verified = searchParams.get("verified");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Show success message if user just verified their email
    if (verified === "true") {
      addToast({
        title: "Email Verified",
        description:
          "Your email has been verified. Please sign in to continue.",
        variant: "success",
        duration: 4000,
      });
    }

    // Handle OAuth errors using the new error handling system
    if (error) {
      const oauthError = parseOAuthError({
        error,
        error_description: errorDescription,
      });

      if (oauthError) {
        addToast({
          title: oauthError.title,
          description: oauthError.description,
          variant: "error",
          duration: 6000,
        });
      }
    }
  }, [searchParams, addToast]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Reset errors
    setEmailError("");
    setPasswordError("");

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.message || "Invalid email");
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(password, "Password");
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.message || "Invalid password");
      return;
    }

    // If validation passes, proceed with login
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        addToast({
          title: "Login Failed",
          description: "Invalid email or password. Please try again.",
          variant: "error",
          duration: 4000,
        });
      } else {
        addToast({
          title: "Login Successful",
          description: "Welcome back!",
          variant: "success",
          duration: 3000,
        });

        // Redirect to dashboard
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      console.error("Login error:", error);
      addToast({
        title: "Login Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "error",
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Clear error when user starts typing
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) setEmailError("");
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (passwordError) setPasswordError("");
  };

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    try {
      await signIn("azure-ad", {
        callbackUrl: "/dashboard",
      });
    } catch (error) {
      console.error("Microsoft login error:", error);
      addToast({
        title: "Login Failed",
        description: "Unable to login with Microsoft. Please try again.",
        variant: "error",
        duration: 4000,
      });
      setIsLoading(false);
    }
  };

  const handleMicrosoftRetry = async () => {
    await handleMicrosoftLogin();
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await signIn("google", {
        callbackUrl: "/dashboard",
      });
    } catch (error) {
      console.error("Google login error:", error);
      addToast({
        title: "Login Failed",
        description: "Unable to login with Google. Please try again.",
        variant: "error",
        duration: 4000,
      });
      setIsLoading(false);
    }
  };

  const handleGoogleRetry = async () => {
    await handleGoogleLogin();
  };

  const handlePasskeyAuth = async () => {
    try {
      // Get the WebAuthn response
      const authResponse = await authenticateWithPasskey(email);

      // Sign in with the passkey response
      const result = await signIn("passkey", {
        email,
        response: JSON.stringify(authResponse),
        redirect: false,
      });

      if (result?.error) {
        addToast({
          title: "Authentication Failed",
          description: "Unable to authenticate with passkey. Please try again.",
          variant: "error",
          duration: 4000,
        });
      } else {
        addToast({
          title: "Login Successful",
          description: "Welcome back!",
          variant: "success",
          duration: 3000,
        });

        // Redirect to dashboard
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      console.error("Passkey authentication error:", error);
      addToast({
        title: "Authentication Failed",
        description: "Unable to authenticate with passkey. Please try again.",
        variant: "error",
        duration: 4000,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo size="md" />
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            Sign in to your account
          </h1>
        </div>

        {/* Form */}
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email Input */}
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={handleEmailChange}
                disabled={isLoading}
                error={!!emailError}
                errorMessage={emailError}
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className="pr-10"
                  value={password}
                  onChange={handlePasswordChange}
                  disabled={isLoading}
                  error={!!passwordError}
                  errorMessage={passwordError}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <Eye className="size-4" />
                  ) : (
                    <EyeOff className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end">
              <TextLinkButton href="/forgot-password">
                Forgot Password
              </TextLinkButton>
            </div>

            {/* Login Button */}
            <MainButton
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Login"}
            </MainButton>
          </form>

          {/* OAuth Error Display */}
          {hasOAuthError && (
            <OAuthErrorDisplay
              errorParams={oauthErrorParams}
              onRetry={() => {
                // Determine which provider to retry based on the error context
                if (oauthErrorParams.error === "AccessDenied") {
                  // For access denied, we can't determine which provider failed
                  // So we'll show a generic retry message
                  addToast({
                    title: "Retry Authentication",
                    description:
                      "Please try signing in again with your preferred method.",
                    variant: "default",
                    duration: 4000,
                  });
                }
              }}
              onContactSupport={() => {
                // You can implement contact support functionality here
                addToast({
                  title: "Contact Support",
                  description:
                    "Please email support@bidkore.com for assistance.",
                  variant: "default",
                  duration: 5000,
                });
              }}
              variant="card"
              className="mb-4"
            />
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-background px-2 text-muted-foreground">
                or
              </span>
            </div>
          </div>

          {/* Authentication Options */}
          <div className="space-y-3">
            {/* Passkey Authentication */}
            <PasskeyButton
              onPasskeyAuth={handlePasskeyAuth}
              size="lg"
              disabled={isLoading}
            />

            {/* Microsoft OAuth */}
            <SocialLoginButton
              provider="microsoft"
              size="lg"
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
            />

            {/* Google OAuth */}
            <SocialLoginButton
              provider="google"
              size="lg"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            />
          </div>

          {/* Sign Up Link */}
          <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <TextLinkButton href="/signup">Sign Up</TextLinkButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">Loading...</h1>
        </div>
        <div className="flex justify-center pt-2">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SignInContent />
    </Suspense>
  );
}
