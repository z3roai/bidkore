"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MainButton from "@/components/main-button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Bookmark,
  Share2,
  FileText,
  Sparkles,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  ExternalLink,
  Building2,
  Tag,
  Award,
  Link as LinkIcon,
  Download,
  File,
  FileType,
} from "lucide-react";
import type { AISearchOpportunity } from "@/lib/mock-data";
import { useApiToken } from "@/lib/client-api";

type TabKey = "overview" | "description" | "attachments" | "ai-summary";

interface ContactInfo {
  name: string;
  email: string;
  phone: string;
}

export default function AIOpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const token = useApiToken();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [opportunity, setOpportunity] = useState<AISearchOpportunity | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const opportunityId = params.id as string;

  useEffect(() => {
    const loadOpportunity = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get opportunity from sessionStorage (passed from list view)
        const stored = sessionStorage.getItem(`opportunity_${opportunityId}`);
        if (stored) {
          setOpportunity(JSON.parse(stored));
        } else {
          setError("Opportunity data not found. Please return to the search list and click an opportunity again.");
        }
      } catch (err) {
        console.error("Failed to load opportunity:", err);
        setError("Failed to load opportunity details");
      } finally {
        setLoading(false);
      }
    };

    if (opportunityId) {
      loadOpportunity();
    }
  }, [opportunityId]);

  if (loading) {
    return (
      <div className="bg-background p-6">
        <div className="bg-card rounded-lg p-6 shadow-sm">
          <div className="text-center py-12 text-muted-foreground">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
            </div>
            <p className="text-lg mt-4">Loading opportunity details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="bg-background p-6">
        <div className="bg-card rounded-lg p-6 shadow-sm">
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg mb-4">
              {error || "Opportunity not found"}
            </p>
            <Link href="/dashboard/ai-search">
              <Button variant="outline">Back to Search</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Extract department and sub-tier from agency string
  const agencyParts = opportunity.agency?.split(" / ") || [];
  const department = agencyParts[0] || opportunity.agency || "N/A";
  const subTier = agencyParts[1] || agencyParts[0] || "N/A";

  // Mock contact information (in real app, this would come from API)
  const contacts: ContactInfo[] = [
    {
      name: "Sydney Fernandez",
      email: "sydney.fernandez@us.af.mil",
      phone: "3216981834",
    },
    {
      name: "Brandon Gilbert",
      email: "brandon.gilbert@us.af.mil",
      phone: "3216981892",
    },
  ];

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

  const formatValue = (value?: number | null) => {
    if (!value) return "N/A";
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "description", label: "Description" },
    { key: "attachments", label: "Attachments" },
    { key: "ai-summary", label: "AI Summary" },
  ];

  return (
    <div className="bg-background p-6">
      <div className="bg-card rounded-lg p-6 shadow-sm">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/ai-search"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Search
          </Link>

          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-foreground">
                  {opportunity.title}
                </h1>
                <span className="px-3 py-1 text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                  Active
                </span>
              </div>
              <p className="text-lg text-muted-foreground">{department}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Bookmark className="h-4 w-4" />
                Save
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <MainButton size="sm" className="gap-2">
                <FileText className="h-4 w-4" />
                Generate Proposal
              </MainButton>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="border-b border-border">
              <nav className="flex space-x-8" aria-label="Tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                      activeTab === tab.key
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Buyer Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Buyer
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Contracting Agency
                        </p>
                        <p className="text-base font-medium">{department}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Sub-tier</p>
                        <p className="text-base font-medium">{subTier}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Office</p>
                        <p className="text-base font-medium">FA8617 CONS CO</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* NAICS Code */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Tag className="h-5 w-5" />
                        NAICS Code
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-base">
                        {opportunity.naicsCode} - Data Processing, Hosting, and
                        Related Services
                      </p>
                    </CardContent>
                  </Card>

                  {/* Product Service Code */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Award className="h-5 w-5" />
                        Product Service Code
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-base">
                        {opportunity.classificationCode} - IT and Telecom - IT
                        and Telecom Services
                      </p>
                    </CardContent>
                  </Card>

                  {/* Set Aside */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Set Aside</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-base">
                        {opportunity.setAside || "Not specified"}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Original Source */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <LinkIcon className="h-5 w-5" />
                        Original Source
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <a
                        href={opportunity.uiLink || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-2"
                      >
                        {opportunity.uiLink || "https://sam.gov/"}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === "description" && (
                <div className="space-y-6">
                  <div className="prose max-w-none">
                    <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
                      {opportunity.description || "No description available"}
                    </p>
                  </div>

                  {/* AI Interaction Section */}
                  <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-center text-center space-y-4">
                        <Sparkles className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                        <h3 className="text-lg font-semibold text-foreground">
                          How can I help you with this contract?
                        </h3>
                        <div className="flex gap-3">
                          <Button variant="outline" className="gap-2">
                            <FileText className="h-4 w-4" />
                            Summarize Contract
                          </Button>
                          <MainButton className="gap-2">
                            <FileText className="h-4 w-4" />
                            Write Proposal
                          </MainButton>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === "attachments" && (
                <div className="space-y-4">
                  {/* Mock attachments */}
                  {[
                    {
                      id: "1",
                      name: "Statement of Work (SOW)",
                      type: "PDF",
                      size: "2.4 MB",
                      uploadedDate: "April 01, 2025",
                      downloadUrl: "#",
                    },
                    {
                      id: "2",
                      name: "Technical Requirements Document",
                      type: "PDF",
                      size: "1.8 MB",
                      uploadedDate: "April 01, 2025",
                      downloadUrl: "#",
                    },
                  ].map((attachment) => (
                    <Card key={attachment.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                            <FileText className="h-6 w-6 text-red-600 dark:text-red-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground mb-1 truncate">
                              {attachment.name}
                            </h4>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{attachment.type}</span>
                              <span>•</span>
                              <span>{attachment.size}</span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {activeTab === "ai-summary" && (
                <div className="space-y-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3 mb-4">
                        <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                        <h3 className="text-xl font-semibold text-foreground">
                          AI-Generated Summary
                        </h3>
                      </div>
                      <p className="text-base leading-relaxed text-foreground">
                        {opportunity.assistantAdvice ||
                          "This opportunity requires specialized expertise and compliance capabilities."}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Date Posted</p>
                  <p className="text-base font-medium">
                    {formatDate(opportunity.postedDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="text-base font-medium">
                    {formatDate(opportunity.responseDeadline)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Estimated Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">
                  {opportunity.estimatedValue ? formatValue(opportunity.estimatedValue) : "N/A"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
