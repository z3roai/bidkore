import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Logo from "@/components/logo"
import MainButton from "@/components/main-button"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo size="md" />
        </div>

        {/* Error Message */}
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-foreground">404</h1>
          <h2 className="text-2xl font-semibold text-foreground">
            Page Not Found
          </h2>
          <p className="text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <MainButton
            asChild
            size="lg"
          >
            <Link href="/">
              <ArrowLeft className="size-4 mr-2" />
              Go to Home
            </Link>
          </MainButton>
          
          <Button
            asChild
            variant="outline"
            size="lg"
          >
            <Link href="/signin">
              Sign In
            </Link>
          </Button>
        </div>

        {/* Help Text */}
        <div className="text-sm text-muted-foreground">
          If you believe this is a mistake, please{" "}
          <Link href="/contact" className="text-primary hover:underline">
            contact support
          </Link>
        </div>
      </div>
    </div>
  )
}

