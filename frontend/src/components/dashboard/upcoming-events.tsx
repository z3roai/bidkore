import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

interface Event {
  id: string;
  title: string;
  time: string;
  timestamp: string;
}

interface UpcomingEventsProps {
  events: Event[];
  className?: string;
}

export default function UpcomingEvents({
  events,

  className,
}: UpcomingEventsProps) {
  return (
    <Card
      className={cn(
        "bg-card",
        "dark:from-[#1A1A1A] dark:to-[#2A2A2A]",
        "border border-border",
        "p-2",
        className,
      )}
    >
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Upcoming Events
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        {events.length > 0 ? (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-center space-x-3 border border-border rounded-md p-2"
            >
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex justify-between min-w-0 w-full">
                <p className="text-sm font-medium text-foreground truncate">
                  {event.title}
                </p>
                <p className="text-sm text-muted-foreground">{event.time}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-sm text-muted-foreground py-8">
            No upcoming events
          </div>
        )}
      </CardContent>
    </Card>
  );
}
