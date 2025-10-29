"use client";

import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  type ClipboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/logo";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import TextLinkButton from "@/components/text-link-button";
import MainButton from "@/components/main-button";
import { useToast } from "@/components/ui/toast";

export default function VerifyOTPPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState<string>("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Load email from sessionStorage or cookies on mount
  useEffect(() => {
    // First check sessionStorage (for post-registration flow)
    let storedEmail = sessionStorage.getItem("verificationEmail");

    // If not in sessionStorage, check cookies (for logged-in-but-unverified flow)
    if (!storedEmail) {
      const cookies = document.cookie.split(";");
      const emailCookie = cookies.find((c) =>
        c.trim().startsWith("verificationEmail="),
      );
      if (emailCookie) {
        storedEmail = emailCookie.split("=")[1];
      }
    }

    if (storedEmail) {
      setEmail(storedEmail);
    } else {
      // If no email found, redirect to signup
      router.push("/signup");
    }
  }, [router]);

  const handleChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only take the last character
    setOtp(newOtp);

    // Move to next input if value is entered
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    // Move to previous input on backspace if current input is empty
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").trim();

    // Only process if it's 6 digits
    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split("");
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join("");

    if (otpCode.length === 6) {
      setIsVerifying(true);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/verify-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              otp: otpCode,
            }),
          },
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Verification failed");
        }

        addToast({
          title: "Email Verified",
          description: "Your email has been verified successfully.",
          variant: "success",
          duration: 3000,
        });

        // Clear stored data
        sessionStorage.removeItem("verificationEmail");

        // Clear the cookie if it exists
        document.cookie =
          "verificationEmail=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

        // Check if user has auth token (already logged in)
        const authToken = sessionStorage.getItem("authToken");

        if (authToken) {
          // User is already logged in, redirect to dashboard
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 1000);
        } else {
          // User needs to login, redirect to signin
          setTimeout(() => {
            router.push("/signin?verified=true");
          }, 1000);
        }
      } catch (error) {
        console.error("Verification error:", error);
        addToast({
          title: "Verification Failed",
          description:
            error instanceof Error
              ? error.message
              : "Invalid verification code. Please try again.",
          variant: "error",
          duration: 4000,
        });
        // Clear OTP fields on error
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } finally {
        setIsVerifying(false);
      }
    }
  };

  const handleResend = async () => {
    if (!email) {
      addToast({
        title: "Error",
        description: "Email not found. Please sign up again.",
        variant: "error",
        duration: 4000,
      });
      return;
    }

    setIsResending(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/resend-verification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            includeOTP: true,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to resend code");
      }

      addToast({
        title: "Code Resent",
        description: "A new verification code has been sent to your email.",
        variant: "success",
        duration: 3000,
      });

      // Clear current OTP
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (error) {
      console.error("Resend error:", error);
      addToast({
        title: "Resend Failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to resend verification code. Please try again.",
        variant: "error",
        duration: 4000,
      });
    } finally {
      setIsResending(false);
    }
  };

  const isComplete = otp.every((digit) => digit !== "");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Back Button */}
        <Link
          href="/signin"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4 mr-2" />
          Back to sign in
        </Link>

        {/* Logo */}
        <div className="flex justify-center">
          <Logo size="md" />
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Verify your email
          </h1>
          <p className="text-sm text-muted-foreground">
            We sent a verification code to{" "}
            <span className="font-medium text-foreground">
              {email || "your email"}
            </span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* OTP Input Fields */}
          <div className="space-y-2">
            <label
              htmlFor="otp-0"
              className="text-sm font-medium text-foreground"
            >
              Enter verification code
            </label>
            <div className="flex gap-2 justify-center">
              {[0, 1, 2, 3, 4, 5].map((position) => (
                <Input
                  key={`otp-digit-${position}`}
                  id={`otp-${position}`}
                  ref={(el) => {
                    inputRefs.current[position] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={otp[position]}
                  onChange={(e) => handleChange(position, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(position, e)}
                  onPaste={handlePaste}
                  disabled={isVerifying}
                  className={cn(
                    "w-12 h-12 text-center text-lg font-semibold",
                    "transition-all duration-200",
                    otp[position] && "border-foreground bg-accent",
                  )}
                  aria-label={`Digit ${position + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Verify Button */}
          <MainButton
            type="submit"
            disabled={!isComplete || isVerifying}
            className="w-full disabled:opacity-50"
            size="lg"
          >
            {isVerifying ? "Verifying..." : "Verify Email"}
          </MainButton>
        </form>

        {/* Resend Code */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Didn&apos;t receive the code?{" "}
            <TextLinkButton onClick={handleResend} disabled={isResending}>
              {isResending ? "Resending..." : "Resend"}
            </TextLinkButton>
          </p>
        </div>

        {/* Help Text */}
        <div className="text-center text-xs text-muted-foreground">
          Check your spam folder if you don&apos;t see the email
        </div>
      </div>
    </div>
  );
}
