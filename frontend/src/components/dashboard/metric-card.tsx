import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}

export default function MetricCard({ title, subtitle, children, className }: MetricCardProps) {
  return (
    <Card 
      className={cn(
        "bg-background",
        "border border-border",
        "overflow-hidden",
        className
      )}
    >
      <CardHeader>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="pt-4 overflow-hidden">
        {children}
      </CardContent>
    </Card>
  )
}

