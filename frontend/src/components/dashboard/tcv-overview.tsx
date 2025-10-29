"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TimePeriod, tcvOverviewData } from "@/lib/mock-data";
import { BarChart } from "@mui/x-charts/BarChart";
import { ChevronDown } from "lucide-react";

interface TCVOverviewProps {
  className?: string;
}

export default function TCVOverview({ className }: TCVOverviewProps) {
  const [selectedPeriod, setSelectedPeriod] =
    React.useState<TimePeriod>("monthly");
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const data = tcvOverviewData[selectedPeriod];

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);
  const maxValue = Math.max(...data.map((d) => d.value));

  // Calculate total TCV based on selected period
  const getTotalTCV = () => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    switch (selectedPeriod) {
      case "daily":
        return `$${(total * 7).toFixed(1)}M`; // Weekly projection
      case "monthly":
        return `$${total.toFixed(0)}M`;
      case "yearly":
        return `$${(total / 1000).toFixed(1)}B`;
      default:
        return `$${total.toFixed(0)}M`;
    }
  };

  const getSubtitle = () => {
    switch (selectedPeriod) {
      case "daily":
        return "Avg Per Day";
      case "monthly":
        return "Avg Per Month";
      case "yearly":
        return "Avg Per Year";
      default:
        return "Avg Per Month";
    }
  };

  const getValueFormatter = (value: number) => {
    switch (selectedPeriod) {
      case "daily":
        return `$${value.toFixed(1)}M`;
      case "monthly":
        return `$${value.toFixed(0)}M`;
      case "yearly":
        return `$${(value / 1000).toFixed(1)}B`;
      default:
        return `$${value.toFixed(0)}M`;
    }
  };

  return (
    <Card className={cn("bg-card border border-border", className)}>
      <CardHeader className="pt-2 pb-1">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">
              TCV Overview
            </CardTitle>
            <p className="text-sm text-muted-foreground">{getSubtitle()}</p>
          </div>

          {/* Time Period Selector */}
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2 bg-background hover:bg-accent hover:text-accent-foreground"
            >
              <span className="text-sm capitalize">{selectedPeriod}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isDropdownOpen && "rotate-180"
                )}
              />
            </Button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-background border border-border rounded-md shadow-lg z-10">
                {(["daily", "monthly", "yearly"] as TimePeriod[]).map(
                  (period) => (
                    <button
                      key={period}
                      onClick={() => {
                        setSelectedPeriod(period);
                        setIsDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        "first:rounded-t-md last:rounded-b-md",
                        selectedPeriod === period &&
                          "bg-accent text-accent-foreground"
                      )}
                    >
                      <span className="capitalize">{period}</span>
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-3xl font-bold text-foreground">
          {getTotalTCV()}
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="h-56">
          <svg width="0" height="0" style={{ position: "absolute" }}>
            <defs>
              <linearGradient
                id="gradient-normal"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#3183FF" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3183FF" stopOpacity="1" />
              </linearGradient>
              <linearGradient
                id="gradient-highlight"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#262626" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#262626" stopOpacity="1" />
              </linearGradient>
            </defs>
          </svg>
          <BarChart
            height={240}
            dataset={data.map((item) => ({
              period: item.period,
              value: item.value,
            }))}
            series={[
              {
                id: "tcv",
                dataKey: "value",
                valueFormatter: (value: number | null) =>
                  value ? getValueFormatter(value) : "",
                color: "#3183FF",
                highlightScope: {
                  highlight: "series",
                  fade: "global",
                },
              },
            ]}
            xAxis={[
              {
                id: "period",
                scaleType: "band",
                dataKey: "period",
                tickLabelStyle: {
                  fill: "var(--muted-foreground)",
                  fontSize: 12,
                },
              },
            ]}
            yAxis={[
              {
                id: "value",
                min: 0,
                max: maxValue * 1.1,
                tickLabelStyle: {
                  fill: "var(--muted-foreground)",
                  fontSize: 12,
                },
                valueFormatter: (value: number | null) =>
                  value ? getValueFormatter(value) : "",
              },
            ]}
            margin={{ top: 20, right: 20, left: 40, bottom: 40 }}
            colors={["#3183FF"]}
            grid={{ horizontal: true, vertical: false }}
            borderRadius={8}
            slotProps={{
              bar: {
                style: {
                  fill: "#3183FF",
                  filter: "drop-shadow(0 4px 8px rgba(49, 131, 255, 0.15))",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  cursor: "pointer",
                },
                onMouseEnter: (event) => {
                  event.currentTarget.style.filter =
                    "drop-shadow(0 6px 12px rgba(49, 131, 255, 0.25)) brightness(1.1)";
                },
                onMouseLeave: (event) => {
                  event.currentTarget.style.filter =
                    "drop-shadow(0 4px 8px rgba(49, 131, 255, 0.15))";
                },
              },
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
