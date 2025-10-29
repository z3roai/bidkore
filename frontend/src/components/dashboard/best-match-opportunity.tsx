"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OpportunityData } from "@/lib/mock-data";
import { ChevronDown, Star, Bookmark, FileText, Calendar } from "lucide-react";

interface BestMatchOpportunityProps {
  opportunity: OpportunityData;
  className?: string;
}

type SortOption = "Recently Added" | "Most Relevant" | "Deadline Soon";

export default function BestMatchOpportunity({
  opportunity,
  className,
}: BestMatchOpportunityProps) {
  const [selectedSort, setSelectedSort] =
    React.useState<SortOption>("Recently Added");
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

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
  return (
    <Card
      className={cn(
        "bg-card",
        "dark:from-[#1A1A1A] dark:to-[#2A2A2A]",
        "border border-border",
        "p-2",
        "relative",
        className
      )}
    >
      {/* Bookmark Icon */}

      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            Best Match Opportunity
          </CardTitle>

          {/* Sort Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2 bg-background hover:bg-accent hover:text-accent-foreground"
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              aria-label="Sort opportunities"
            >
              <span className="text-sm">{selectedSort}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isDropdownOpen && "rotate-180"
                )}
              />
            </Button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-40 bg-background border border-border rounded-md shadow-lg z-10"
                role="listbox"
                aria-label="Sort options"
              >
                {(
                  [
                    "Recently Added",
                    "Most Relevant",
                    "Deadline Soon",
                  ] as SortOption[]
                ).map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setSelectedSort(option);
                      setIsDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "first:rounded-t-md last:rounded-b-md",
                      "focus:outline-none focus:bg-accent focus:text-accent-foreground",
                      selectedSort === option &&
                        "bg-accent text-accent-foreground"
                    )}
                    role="option"
                    aria-selected={selectedSort === option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 border rounded-md border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Star className="h-4 w-4" />
            <span className="text-sm font-medium text-foreground">
              {opportunity.type}
            </span>
          </div>
          <div className="flex items-center justify-end border border-border rounded-full p-1 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors">
            <Bookmark className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
          </div>
        </div>
        <div className="text-lg font-semibold text-foreground">
          {opportunity.title}
        </div>
        <hr className="border-0 border-t border-dashed border-border my-2" />
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
            {opportunity.status}
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {opportunity.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {opportunity.documents}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {opportunity.dueDate}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
