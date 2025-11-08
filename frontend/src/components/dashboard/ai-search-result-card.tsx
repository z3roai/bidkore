"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MainButton from "@/components/main-button";
import { cn } from "@/lib/utils";
import { Eye, Bookmark } from "lucide-react";
import type { AISearchOpportunity } from "@/lib/mock-data";

interface AISearchResultCardProps {
  opportunity: AISearchOpportunity;
}

export function AISearchResultCard({
  opportunity,
}: AISearchResultCardProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const getDaysUntilDeadline = (deadline?: string) => {
    if (!deadline) return null;
    try {
      const deadlineDate = new Date(deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      deadlineDate.setHours(0, 0, 0, 0);
      const diffTime = deadlineDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return null;
    }
  };

  const daysUntilDeadline = getDaysUntilDeadline(opportunity.responseDeadline);
  const deadlineDate = formatDate(opportunity.responseDeadline);

  // Extract department and sub-tier from agency string
  const agencyParts = opportunity.agency?.split(" / ") || [];
  const department = agencyParts[0] || opportunity.agency || "N/A";
  const subTier = agencyParts[1] || agencyParts[0] || "N/A";

  // Determine notice type from setAside or use a default
  const noticeType = opportunity.setAside || "RFP";

  return (
    <Card className="border border-border hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3 className="text-xl font-semibold text-foreground mb-3">
              {opportunity.title}
            </h3>

            {/* Due Date */}
            {daysUntilDeadline !== null && (
              <div className="flex items-center gap-2 mb-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">
                    Due in {daysUntilDeadline} day{daysUntilDeadline !== 1 ? "s" : ""} on {deadlineDate}
                  </span>
                </div>
              </div>
            )}

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
              {opportunity.description}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 text-xs font-medium bg-muted rounded-md text-muted-foreground">
                Notice ID: {opportunity.noticeId}
              </span>
              <span className="px-2 py-1 text-xs font-medium bg-muted rounded-md text-muted-foreground">
                Notice: {noticeType}
              </span>
              {opportunity.classificationCode && (
                <span className="px-2 py-1 text-xs font-medium bg-muted rounded-md text-muted-foreground">
                  PSC: {opportunity.classificationCode}
                </span>
              )}
              {opportunity.naicsCode && (
                <span className="px-2 py-1 text-xs font-medium bg-muted rounded-md text-muted-foreground">
                  NAICS: {opportunity.naicsCode}
                </span>
              )}
              <span className="px-2 py-1 text-xs font-medium bg-muted rounded-md text-muted-foreground">
                Dep: {department}
              </span>
              <span className="px-2 py-1 text-xs font-medium bg-muted rounded-md text-muted-foreground">
                Sub-Tier: {subTier}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <MainButton
              size="sm"
              className="gap-2 min-w-[100px]"
              asChild
            >
              <Link href={`/dashboard/ai-search/${opportunity.noticeId}`}>
                <Eye className="h-4 w-4" />
                View
              </Link>
            </MainButton>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 min-w-[100px]"
              onClick={() => {
                // TODO: Implement save functionality
                console.log("Save opportunity:", opportunity.noticeId);
              }}
            >
              <Bookmark className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

