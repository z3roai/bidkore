import Link from "next/link"
import { cn } from "@/lib/utils"

interface TextLinkButtonProps {
  href?: string
  onClick?: () => void
  children: React.ReactNode
  className?: string
  size?: "sm" | "md" | "lg"
  underline?: "none" | "hover" | "always"
  disabled?: boolean
}

export default function TextLinkButton({
  href,
  onClick,
  children,
  className,
  size = "md",
  underline = "hover",
  disabled = false,
}: TextLinkButtonProps) {
  const baseStyles = cn(
    "text-primary font-medium transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:pointer-events-none",
    {
      // Size variants
      "text-xs": size === "sm",
      "text-sm": size === "md",
      "text-base": size === "lg",
      // Underline variants
      "no-underline": underline === "none",
      "hover:underline": underline === "hover",
      "underline": underline === "always",
      // Hover state
      "hover:text-primary/80": !disabled,
    },
    className
  )

  // If href is provided, render as Link
  if (href && !disabled) {
    return (
      <Link href={href} className={baseStyles}>
        {children}
      </Link>
    )
  }

  // Otherwise render as button
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={baseStyles}
    >
      {children}
    </button>
  )
}

