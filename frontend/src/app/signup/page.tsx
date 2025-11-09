"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import Logo from "@/components/logo";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import TextLinkButton from "@/components/text-link-button";
import MainButton from "@/components/main-button";
import SocialLoginButton from "@/components/social-login-button";
import PasskeyButton from "@/components/passkey-button";
import { useToast } from "@/components/ui/toast";
import {
  validateEmail,
  validatePassword,
  validateName,
  validateCheckbox,
} from "@/lib/validation";
import { registerPasskey } from "@/lib/webauthn";

export default function SignUpPage() {
  const router = useRouter();
  const termsId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [termsError, setTermsError] = useState("");
  const [showPasskeyOption] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Reset errors
    setFirstNameError("");
    setLastNameError("");
    setEmailError("");
    setPasswordError("");
    setTermsError("");

    let hasError = false;

    // Validate first name
    const firstNameValidation = validateName(firstName, "First name");
    if (!firstNameValidation.isValid) {
      setFirstNameError(firstNameValidation.message || "Invalid first name");
      hasError = true;
    }

    // Validate last name
    const lastNameValidation = validateName(lastName, "Last name");
    if (!lastNameValidation.isValid) {
      setLastNameError(lastNameValidation.message || "Invalid last name");
      hasError = true;
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.message || "Invalid email");
      hasError = true;
    }

    // Validate password
    const passwordValidation = validatePassword(password, "Password");
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.message || "Invalid password");
      hasError = true;
    }

    // Validate terms acceptance
    const termsValidation = validateCheckbox(
      agreedToTerms,
      "Terms of Service and Privacy Policy"
    );
    if (!termsValidation.isValid) {
      setTermsError(termsValidation.message || "Terms acceptance required");
      hasError = true;
    }

    if (hasError) return;

    // If validation passes, proceed with signup
    setIsLoading(true);
    try {
      // Call your backend API to create the account
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            firstName,
            lastName,
            email,
            password,
          }),
        }
      );

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || "An unexpected error occurred. Please try again.");
      }

      const data = await response.json();

      addToast({
        title: "Account Created",
        description: "Please check your email for the verification code.",
        variant: "success",
        duration: 3000,
      });

      // Store email in sessionStorage for OTP verification
      sessionStorage.setItem("verificationEmail", email);

      // Sign in the user with the token from backend
      if (data.token) {
        const signInResult = await signIn("credentials", {
          token: data.token,
          redirect: false,
        });

        if (!signInResult?.error) {
          // Store token in sessionStorage as well for the OTP page to use
          sessionStorage.setItem("authToken", data.token);

          // Redirect to OTP verification page
          setTimeout(() => {
            router.push("/verify-otp");
          }, 1000);
        } else {
          // If sign in fails, still redirect to OTP but without being logged in
          setTimeout(() => {
            router.push("/verify-otp");
          }, 1000);
        }
      } else {
        // If no token, just redirect to OTP
        setTimeout(() => {
          router.push("/verify-otp");
        }, 1000);
      }
    } catch (error) {
      console.error("Registration error:", error);
      addToast({
        title: "Signup Failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to create account. Please try again.",
        variant: "error",
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Clear error when user starts typing
  const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFirstName(e.target.value);
    if (firstNameError) setFirstNameError("");
  };

  const handleLastNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLastName(e.target.value);
    if (lastNameError) setLastNameError("");
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) setEmailError("");
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (passwordError) setPasswordError("");
  };

  const handleTermsChange = (checked: boolean) => {
    setAgreedToTerms(checked);
    if (termsError) setTermsError("");
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
        title: "Signup Failed",
        description: "Unable to signup with Microsoft. Please try again.",
        variant: "error",
        duration: 4000,
      });
      setIsLoading(false);
    }
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
        title: "Signup Failed",
        description: "Unable to signup with Google. Please try again.",
        variant: "error",
        duration: 4000,
      });
      setIsLoading(false);
    }
  };

  const handlePasskeySetup = async () => {
    try {
      await registerPasskey(email);

      addToast({
        title: "Passkey Registered",
        description: "You can now use your passkey to sign in!",
        variant: "success",
        duration: 3000,
      });

      // Redirect to dashboard
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1000);
    } catch (error) {
      console.error("Passkey registration error:", error);
      addToast({
        title: "Passkey Setup Failed",
        description:
          "Unable to register passkey. You can set it up later from settings.",
        variant: "error",
        duration: 4000,
      });

      // Still redirect to dashboard even if passkey setup fails
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1000);
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
            {showPasskeyOption ? "Set up your Passkey" : "Create account"}
          </h1>
          {showPasskeyOption && (
            <p className="mt-2 text-sm text-muted-foreground">
              Secure your account with biometric authentication
            </p>
          )}
        </div>

        {/* Form or Passkey Setup */}
        <div className="space-y-6">
          {!showPasskeyOption ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Name Inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={handleFirstNameChange}
                    disabled={isLoading}
                    error={!!firstNameError}
                    errorMessage={firstNameError}
                  />
                  <Input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={handleLastNameChange}
                    disabled={isLoading}
                    error={!!lastNameError}
                    errorMessage={lastNameError}
                  />
                </div>

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
                        <Eye className="size-4" suppressHydrationWarning />
                      ) : (
                        <EyeOff className="size-4" suppressHydrationWarning />
                      )}
                    </button>
                  </div>
                </div>

                {/* Terms Checkbox */}
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={termsId}
                      checked={agreedToTerms}
                      onCheckedChange={(checked) =>
                        handleTermsChange(checked === true)
                      }
                      disabled={isLoading}
                      className={termsError ? "border-destructive" : ""}
                    />
                    <label
                      htmlFor={termsId}
                      className={`text-sm leading-tight cursor-pointer ${termsError
                          ? "text-destructive"
                          : "text-muted-foreground"
                        }`}
                    >
                      I agree to BidKore{" "}
                      <TextLinkButton href="/terms" size="sm">
                        Terms of service
                      </TextLinkButton>{" "}
                      and{" "}
                      <TextLinkButton href="/privacy" size="sm">
                        Privacy policy
                      </TextLinkButton>
                    </label>
                  </div>
                  {termsError && (
                    <p className="text-xs text-destructive ml-6">
                      {termsError}
                    </p>
                  )}
                </div>

                {/* Create Account Button */}
                <MainButton
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating Account..." : "Create Account"}
                </MainButton>
              </form>

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

              {/* Social Login Buttons */}
              <div className="space-y-3">
                <SocialLoginButton
                  provider="microsoft"
                  size="lg"
                  onClick={handleMicrosoftLogin}
                  disabled={isLoading}
                />

                <SocialLoginButton
                  provider="google"
                  size="lg"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                />
              </div>

              {/* Login Link */}
              <div className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <TextLinkButton href="/signin">Login</TextLinkButton>
              </div>
            </>
          ) : (
            <>
              {/* Passkey Setup Option */}
              <div className="space-y-4">
                <PasskeyButton onPasskeyAuth={handlePasskeySetup} size="lg">
                  Set up Passkey
                </PasskeyButton>

                <MainButton
                  type="button"
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={() => {
                    router.push("/dashboard");
                    router.refresh();
                  }}
                >
                  Skip for now
                </MainButton>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
