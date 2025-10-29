import React from "react";
import { FaMicrosoft, FaGoogle } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SocialLoginButtonProps extends React.ComponentProps<typeof Button> {
  provider: "microsoft" | "google";
  children?: React.ReactNode;
  className?: string;
}

/**
 * Social login button component with provider-specific icons
 * Supports Microsoft and Google login
 */
export default function SocialLoginButton({
  provider,
  children,
  className,
  ...props
}: SocialLoginButtonProps) {
  const providerConfig = {
    microsoft: {
      icon: <FaMicrosoft className="size-5" suppressHydrationWarning />,
      label: "Continue with Microsoft",
    },
    google: {
      icon: <FaGoogle className="size-5" suppressHydrationWarning />,
      label: "Continue with Google",
    },
  };

  const config = providerConfig[provider];

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("w-full justify-center", className)}
      {...props}
    >
      <span className="mr-2">{config.icon}</span>
      {children || config.label}
    </Button>
  );
}
