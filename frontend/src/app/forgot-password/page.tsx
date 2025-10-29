"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail } from "lucide-react"
import Logo from "@/components/logo"
import { Input } from "@/components/ui/input"
import TextLinkButton from "@/components/text-link-button"
import MainButton from "@/components/main-button"
import { useToast } from "@/components/ui/toast"
import { validateEmail } from "@/lib/validation"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [emailError, setEmailError] = useState("")
  const { addToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Reset error
    setEmailError("")

    // Validate email
    const emailValidation = validateEmail(email)
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.message || "Invalid email")
      return
    }

    setIsLoading(true)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))

      addToast({
        title: "Email Sent",
        description: "Check your email for password reset instructions",
        variant: "success",
        duration: 4000
      })

      setIsSubmitted(true)
    } catch {
      addToast({
        title: "Failed to Send Email",
        description: "Unable to send password reset email. Please try again.",
        variant: "error",
        duration: 4000
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Clear error when user starts typing
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    if (emailError) setEmailError("")
  }

  const handleResend = async () => {
    setIsLoading(true)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      addToast({
        title: "Email Resent",
        description: "Password reset instructions have been sent again",
        variant: "success",
        duration: 3000
      })
    } catch {
      addToast({
        title: "Failed to Resend",
        description: "Unable to resend email. Please try again.",
        variant: "error",
        duration: 4000
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <Logo size="md" />
          </div>

          {/* Success Message */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">
              Check your email
            </h1>
            <p className="text-sm text-muted-foreground">
              We&apos;ve sent password reset instructions to{" "}
              <span className="font-medium text-foreground">{email}</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <MainButton
              asChild
              className="w-full"
              size="lg"
            >
              <Link href="/signin">
                <Mail className="size-4 mr-2" />
                Back to Sign In
              </Link>
            </MainButton>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Didn&apos;t receive the email?{" "}
                <TextLinkButton
                  onClick={handleResend}
                  disabled={isLoading}
                >
                  {isLoading ? "Resending..." : "Click to resend"}
                </TextLinkButton>
              </p>
            </div>
          </div>

          {/* Help Text */}
          <div className="text-center text-xs text-muted-foreground">
            Check your spam folder if you don&apos;t see the email
          </div>
        </div>
      </div>
    )
  }

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
            Forgot password?
          </h1>
          <p className="text-sm text-muted-foreground">
            No worries, we&apos;ll send you reset instructions
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Email Input */}
          <div className="space-y-2">
            <label 
              htmlFor="email" 
              className="text-sm font-medium text-foreground"
            >
              Email address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={handleEmailChange}
              disabled={isLoading}
              error={!!emailError}
              errorMessage={emailError}
            />
          </div>

          {/* Submit Button */}
          <MainButton
            type="submit"
            disabled={isLoading}
            className="w-full disabled:opacity-50"
            size="lg"
          >
            {isLoading ? "Sending..." : "Reset Password"}
          </MainButton>
        </form>

        {/* Sign In Link */}
        <div className="text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <TextLinkButton href="/signin">Sign In</TextLinkButton>
        </div>
      </div>
    </div>
  )
}

