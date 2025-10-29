"use client";

import React, { useState, useEffect } from "react";
import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isPasskeySupported, isPlatformAuthenticatorAvailable } from "@/lib/webauthn";

interface PasskeyButtonProps extends React.ComponentProps<typeof Button> {
  onPasskeyAuth: () => Promise<void>;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Passkey authentication button component
 * Shows a fingerprint icon and handles passkey authentication
 * Only renders if passkeys are supported in the browser
 */
export default function PasskeyButton({
  onPasskeyAuth,
  children,
  className,
  ...props
}: PasskeyButtonProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      const supported = isPasskeySupported();
      const platformAvailable = await isPlatformAuthenticatorAvailable();
      setIsSupported(supported && platformAvailable);
    };

    checkSupport();
  }, []);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await onPasskeyAuth();
    } catch (error) {
      console.error("Passkey authentication failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render if passkeys are not supported
  if (!isSupported) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("w-full justify-center", className)}
      onClick={handleClick}
      disabled={isLoading || props.disabled}
      {...props}
    >
      <span className="mr-2">
        <Fingerprint className="size-5" />
      </span>
      {children || (isLoading ? "Authenticating..." : "Sign in with Passkey")}
    </Button>
  );
}
