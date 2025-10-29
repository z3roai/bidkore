"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SmartAlert } from "@/lib/mock-data";
import {
  Bell,
  Clock,
  Search as SearchIcon,
} from "lucide-react";

interface SmartAlertsListProps {
  alerts: SmartAlert[];
}

export default function SmartAlertsList({ alerts }: SmartAlertsListProps) {
  const [query, setQuery] = useState("");
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const a of alerts) initial[a.id] = a.status === "Active";
    return initial;
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return alerts;
    return alerts.filter((a) =>
      [
        a.contract,
        a.interval,
        ...(a.tags ?? []),
        a.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [alerts, query]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Search */}
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search alerts"
          className="pl-10"
        />
      </div>

      {/* Alerts */}
      <div className="flex-1 overflow-auto space-y-3">
        {filtered.map((a) => {
          const isActive = !!activeMap[a.id];
          return (
            <Card key={a.id} className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-full bg-accent/40 flex items-center justify-center">
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate text-foreground">{a.contract}</p>
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full",
                            isActive
                              ? "bg-emerald-600 text-white dark:bg-emerald-300 dark:text-black"
                              : "bg-gray-600 text-white dark:bg-gray-300 dark:text-black",
                          )}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {/* Meta */}
                      <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <SearchIcon className="h-3.5 w-3.5" />
                          <span>{a.interval}</span>
                        </div>
                        {a.lastTriggered && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Last triggered: {a.lastTriggered}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <Button variant="ghost" className="h-8 px-3">
                      Edit
                    </Button>
                    <Switch
                      checked={isActive}
                      onCheckedChange={(checked) =>
                        setActiveMap((m) => ({ ...m, [a.id]: checked }))
                      }
                      aria-label={isActive ? "Disable alert" : "Enable alert"}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}


