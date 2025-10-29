import React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MainButtonProps extends React.ComponentProps<typeof Button> {
  children: React.ReactNode
  className?: string
}

/**
 * Main action button with grey/white color scheme
 * Light mode: Dark grey background with white text
 * Dark mode: White background with black text, hover to grey
 */
export default function MainButton({ 
  children, 
  className,
  ...props 
}: MainButtonProps) {
  return (
    <Button
      className={cn(
        "bg-foreground text-background hover:bg-foreground/90 hover:text-background font-medium transition-all",
        "dark:bg-white dark:text-black dark:hover:bg-gray-300 dark:hover:text-black",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )
}

