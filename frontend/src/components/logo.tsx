"use client"

import Image from "next/image"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface LogoProps {
  /**
   * Size of the logo
   * @default "md"
   */
  size?: "sm" | "md" | "lg" | "xl"
  
  /**
   * Whether to show the text alongside the logo
   * @default true
   */
  showText?: boolean
  
  /**
   * Whether the sidebar is collapsed (shows only logo icon)
   * @default false
   */
  isCollapsed?: boolean
  
  /**
   * Custom className for the container
   */
  className?: string
  
  /**
   * Custom className for the image
   */
  imageClassName?: string
  
  /**
   * Custom className for the text
   */
  textClassName?: string
}

const sizeConfig = {
  sm: {
    image: { width: 24, height: 24 },
    text: "text-lg",
    spacing: "space-x-2"
  },
  md: {
    image: { width: 40, height: 40 },
    text: "text-2xl",
    spacing: "space-x-3"
  },
  lg: {
    image: { width: 56, height: 56 },
    text: "text-3xl",
    spacing: "space-x-4"
  },
  xl: {
    image: { width: 72, height: 72 },
    text: "text-4xl",
    spacing: "space-x-5"
  }
}

export default function Logo({ 
  size = "md", 
  showText = true, 
  isCollapsed = false,
  className,
  imageClassName,
  textClassName
}: LogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const config = sizeConfig[size]
  
  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Use light logo as default during SSR and until mounted
  const logoSrc = mounted && resolvedTheme === "dark" ? "/logo-dark.png" : "/logo-light.jpg"
  
  // When collapsed, show only the logo icon centered
  if (isCollapsed) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <Image 
          src={logoSrc}
          alt="BidKore Logo" 
          width={32} 
          height={32}
          className={cn("rounded-sm", imageClassName)}
          suppressHydrationWarning
          priority
        />
      </div>
    )
  }
  
  return (
    <div className={cn("flex items-center", config.spacing, className)}>
      <Image 
        src={logoSrc}
        alt="BidKore Logo" 
        width={config.image.width} 
        height={config.image.height}
        className={cn("rounded-sm", imageClassName)}
        suppressHydrationWarning
        priority
      />
      {showText && (
        <h1 className={cn("font-bold text-foreground", config.text, textClassName)}>
          BidKore
        </h1>
      )}
    </div>
  )
}
