import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-foreground mb-6">
            Welcome to BidKore
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            The modern platform for efficient bidding and project management
          </p>
          
          {/* CTA Button */}
          <div className="flex justify-center">
            <Button 
              size="lg" 
              className="px-8 py-3 text-lg"
            >
              Get Started
              <ArrowRight className="h-5 w-5 ml-2" suppressHydrationWarning />
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
