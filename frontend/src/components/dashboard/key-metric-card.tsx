import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  FileText,
  Calendar,
  CircleStar,
  DollarSign,
} from "lucide-react";

interface MetricData {
  icon: string;
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative";
}

interface KeyMetricCardProps {
  metric: MetricData;
  className?: string;
}

const iconMap = {
  "🚀": Sparkles,
  "📄": FileText,
  "📅": Calendar,
  "🎯": CircleStar,
  "💰": DollarSign,
};

export default function KeyMetricCard({
  metric,
  className,
}: KeyMetricCardProps) {
  const IconComponent =
    iconMap[metric.icon as keyof typeof iconMap] || Sparkles;

  return (
    <Card
      className={cn(
        "bg-card",
        "dark:from-[#1A1A1A] dark:to-[#2A2A2A]",
        "border border-border",
        "hover:shadow-md transition-all duration-200",
        "h-fit",
        className,
      )}
    >
      <CardContent className="p-4">
        {/* Icon and Title Row */}
        <div className="flex items-center space-x-3 mb-3">
          <div className="flex-shrink-0 w-10 h-10 bg-muted border border-border rounded-md flex items-center justify-center">
            <IconComponent className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground truncate">
            {metric.title}
          </h3>
        </div>

        {/* Divider Line */}
        <div className="relative mb-4">
          <div
            className="w-full h-1 bg-border opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, currentColor 0px, currentColor 6px, transparent 6px, transparent 12px)",
              backgroundSize: "8px 2px",
              backgroundPosition: "0 0",
              backgroundRepeat: "repeat-x",
            }}
          ></div>
        </div>

        {/* Main Value */}
        <div className="text-3xl font-bold text-foreground mb-2">
          {metric.value}
        </div>

        {/* Change Row */}
        <div className="flex items-center space-x-1 flex-wrap">
          <span
            className={cn(
              "text-sm font-medium",
              metric.changeType === "positive"
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {metric.change.split(" ")[0]}
          </span>
          <span className="text-sm text-muted-foreground">
            {metric.change.split(" ").slice(1).join(" ")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
