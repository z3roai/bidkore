import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

interface RecentActivityProps {
  activities: Activity[];
  className?: string;
}

export default function RecentActivity({
  activities,
  className,
}: RecentActivityProps) {
  return (
    <Card className={cn("bg-card border border-border", className)}>
      <CardHeader className="pt-2 pb-1">
        <CardTitle className="text-base font-semibold text-foreground">
          Recent Activity
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 px-4 pb-4">
        {activities.length > 0 ? (
          <div className="space-y-1.5">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className={cn(
                  "flex items-start space-x-2 px-3 py-1.5 rounded-md border border-border",
                  "bg-muted/50 hover:bg-muted transition-all duration-200",
                  "hover:shadow-sm",
                )}
              >
                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center mt-0.5">
                  <TrendingUp className="w-3 h-3 text-primary" />
                </div>
                <p className="text-xs text-foreground leading-relaxed">
                  {activity.description}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-8">
            No recent activities
          </div>
        )}
      </CardContent>
    </Card>
  );
}
