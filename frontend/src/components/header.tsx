import { Button } from "@/components/ui/button"
import { LogIn, UserPlus } from "lucide-react"
import Logo from "@/components/logo"
import Link from "next/link"

export default function Header() {
  return (
    <header className="w-full bg-background border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Logo />
          
          {/* Navigation */}
          <nav className="flex items-center space-x-4">
            <Button asChild variant="outline">
              <Link href="/signin">
                <LogIn className="h-4 w-4 mr-2" suppressHydrationWarning />
                Sign In
              </Link>
            </Button>
            <Button asChild>
              <Link href="/signup">
                <UserPlus className="h-4 w-4 mr-2" suppressHydrationWarning />
                Sign Up
              </Link>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  )
}
