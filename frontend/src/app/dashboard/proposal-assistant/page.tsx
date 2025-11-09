"use client";

import { useEffect, useMemo, useState } from "react";
import Breadcrumb from "@/components/dashboard/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FileText,
  Wand2,
  Sparkles,
  Download,
  Building2,
  Calendar,
  CheckCircle2,
  Loader2,
  Search,
} from "lucide-react";
import { clientApi, useApiToken, type Proposal } from "@/lib/client-api";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TabKey = "new" | "drafts" | "submitted";

export default function ProposalAssistantPage() {
  const { data: session } = useSession();
  const token = useApiToken();

  const [activeTab, setActiveTab] = useState<TabKey>("new");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [compliance, setCompliance] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (token) {
      loadProposals();
      loadOpportunities();
    }
  }, [token]);

  const loadProposals = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await clientApi.getProposals(token);
      setProposals(response.data);
    } catch (error) {
      console.error("Failed to load proposals:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadOpportunities = async () => {
    if (!token) return;
    try {
      const response = await clientApi.getOpportunities(token, 1, 50);
      setOpportunities(response.opportunities || []);
    } catch (error) {
      console.error("Failed to load opportunities:", error);
    }
  };

  const handleGenerateProposal = async () => {
    if (!token || !selectedOpportunity) return;
    try {
      setGenerating(true);
      const response = await clientApi.generateProposal(selectedOpportunity, token);
      setSelectedProposal(response.data);
      await loadProposals();
      setActiveTab("drafts");
    } catch (error: any) {
      alert(error.message || "Failed to generate proposal");
    } finally {
      setGenerating(false);
    }
  };

  const handleCheckCompliance = async () => {
    if (!token || !selectedProposal) return;
    try {
      setLoading(true);
      const result = await clientApi.checkProposalCompliance(selectedProposal.id, token);
      setCompliance(result);
    } catch (error) {
      console.error("Failed to check compliance:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProposal = async (sections: any) => {
    if (!token || !selectedProposal) return;
    try {
      await clientApi.updateProposal(selectedProposal.id, { sections }, token);
      await loadProposals();
    } catch (error) {
      console.error("Failed to update proposal:", error);
    }
  };

  const draftProposals = useMemo(
    () => proposals.filter((p) => p.status === "DRAFT"),
    [proposals]
  );

  const submittedProposals = useMemo(
    () => proposals.filter((p) => p.status !== "DRAFT"),
    [proposals]
  );

  const filteredOpportunities = useMemo(() => {
    if (!searchQuery) return opportunities;
    return opportunities.filter((opp) =>
      opp.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [opportunities, searchQuery]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "UNDER_REVIEW":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "ACCEPTED":
        return "bg-green-50 text-green-700 border-green-200";
      case "REJECTED":
        return "bg-red-50 text-red-700 border-red-200";
      case "SUBMITTED":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, " ");
  };

  return (
    <div className="bg-background h-full flex flex-col p-6">
      <div className="bg-card rounded-lg p-6 shadow-sm flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12">
          <Breadcrumb
            items={[{ label: "Home", href: "/" }, { label: "Proposal Assistant" }]}
            className="mb-6"
          />

          <div className="mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Proposal Assistant</h1>
            <p className="text-muted-foreground mt-1">
              Create, manage, and optimize your proposal documents.
            </p>
          </div>

          <div className="mt-4">
            <div className="inline-flex rounded-md border bg-background p-1">
              {[
                { key: "new", label: "New Proposal" },
                { key: "drafts", label: `Saved Drafts (${draftProposals.length})` },
                { key: "submitted", label: `Submitted (${submittedProposals.length})` },
              ].map((tab) => (
                <Button
                  key={tab.key}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "px-4 py-2 rounded-md",
                    activeTab === (tab.key as TabKey) && "bg-card shadow-sm"
                  )}
                  onClick={() => setActiveTab(tab.key as TabKey)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:col-span-8 xl:col-span-9">
          {activeTab === "new" && (
            <>
              <Card>
                <CardHeader className="pt-5 pb-2">
                  <CardTitle>Generate Proposal from Opportunity</CardTitle>
                  <CardDescription>
                    Select an opportunity to automatically generate a proposal with AI
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pb-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Search Opportunities</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by title..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Opportunity</label>
                    <Select value={selectedOpportunity} onValueChange={setSelectedOpportunity}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an opportunity..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredOpportunities.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            {searchQuery ? "No opportunities found" : "No opportunities available"}
                          </div>
                        ) : (
                          filteredOpportunities.slice(0, 20).map((opp) => (
                            <SelectItem key={opp.id} value={opp.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{opp.title}</span>
                                <span className="text-xs text-muted-foreground">
                                  {opp.fullParentPathName || opp.noticeId}
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="gap-2 w-full"
                    size="lg"
                    onClick={handleGenerateProposal}
                    disabled={!selectedOpportunity || generating}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Generating Proposal...
                      </>
                    ) : (
                      <>
                        <Wand2 className="size-4" />
                        Generate Proposal with AI
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader className="pt-5 pb-2">
                  <CardTitle>How It Works</CardTitle>
                </CardHeader>
                <CardContent className="pb-6">
                  <div className="space-y-4">
                    {[
                      {
                        step: 1,
                        title: "Select Opportunity",
                        description: "Choose a government contract opportunity from SAM.gov",
                      },
                      {
                        step: 2,
                        title: "AI Generation",
                        description:
                          "Our AI analyzes requirements and generates a comprehensive proposal",
                      },
                      {
                        step: 3,
                        title: "Review & Edit",
                        description: "Customize the generated content to match your needs",
                      },
                      {
                        step: 4,
                        title: "Check Compliance",
                        description: "Verify your proposal meets all requirements",
                      },
                    ].map((item) => (
                      <div key={item.step} className="flex gap-4">
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold shrink-0">
                          {item.step}
                        </div>
                        <div>
                          <h4 className="font-medium">{item.title}</h4>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "drafts" && (
            <Card>
              <CardContent className="p-5">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  </div>
                ) : draftProposals.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No draft proposals yet</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setActiveTab("new")}
                    >
                      Create Your First Proposal
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {draftProposals.map((proposal) => (
                      <div key={proposal.id} className="rounded-xl border p-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                          <span>Last saved: {formatDate(proposal.updatedAt)}</span>
                        </div>
                        <div className="text-sm font-semibold line-clamp-2">{proposal.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground line-clamp-1">
                          {proposal.opportunity?.fullParentPathName || "No agency"}
                        </div>
                        {proposal.opportunity?.responseDeadLine && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Due: {formatDate(proposal.opportunity.responseDeadLine)}
                          </div>
                        )}
                        {proposal.complianceScore !== undefined && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Compliance</span>
                              <span className="font-medium">{proposal.complianceScore}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted">
                              <div
                                className="h-1.5 rounded-full bg-primary"
                                style={{ width: `${proposal.complianceScore}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <div className="mt-4 flex gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setSelectedProposal(proposal)}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setSelectedProposal(proposal);
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "submitted" && (
            <Card>
              <CardContent className="p-5">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  </div>
                ) : submittedProposals.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No submitted proposals yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {submittedProposals.map((proposal) => (
                      <div
                        key={proposal.id}
                        className="flex items-center gap-4 rounded-lg border p-4 hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex size-12 items-center justify-center rounded-md bg-muted">
                          <FileText className="size-6 text-muted-foreground" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground mb-2 line-clamp-1">
                            {proposal.title}
                          </h3>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Building2 className="size-4" />
                              <span className="line-clamp-1">
                                {proposal.opportunity?.fullParentPathName || "N/A"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="size-4" />
                              <span>Submitted: {formatDate(proposal.submittedAt)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Button variant="outline" size="sm" className="gap-2">
                            <Download className="size-4" />
                            Download
                          </Button>
                          <span
                            className={cn(
                              "rounded-md border px-3 py-1 text-xs font-medium whitespace-nowrap",
                              getStatusColor(proposal.status)
                            )}
                          >
                            {getStatusLabel(proposal.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-4 xl:col-span-3">
          {selectedProposal && (
            <>
              <Card>
                <CardHeader className="pt-5 pb-2">
                  <CardTitle>Compliance Score</CardTitle>
                  <CardDescription>
                    {selectedProposal.opportunity?.title || "Current Proposal"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-5">
                  <div>
                    <div className="h-2 w-full rounded-full bg-muted" />
                    <div
                      className="-mt-2 h-2 rounded-full bg-primary"
                      style={{
                        width: `${selectedProposal.complianceScore || 0}%`,
                      }}
                    />
                    <div className="mt-2 text-sm font-medium">
                      {selectedProposal.complianceScore || 0}%
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full"
                    onClick={handleCheckCompliance}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin mr-2" />
                        Checking...
                      </>
                    ) : (
                      "Check Compliance"
                    )}
                  </Button>

                  {compliance && (
                    <div className="mt-4 space-y-2 text-sm">
                      {compliance.checks.slice(0, 3).map((check: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{check.requirement}</span>
                          <span
                            className={cn(
                              "text-xs rounded-full border px-2 py-0.5",
                              check.status === "met" && "bg-green-50 text-green-700 border-green-200",
                              check.status === "missing" && "bg-red-50 text-red-700 border-red-200",
                              check.status === "partial" &&
                                "bg-orange-50 text-orange-700 border-orange-200"
                            )}
                          >
                            {check.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pt-5 pb-2">
                  <CardTitle>AI Recommendations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pb-5">
                  {selectedProposal.aiRecommendations &&
                  selectedProposal.aiRecommendations.length > 0 ? (
                    selectedProposal.aiRecommendations.slice(0, 3).map((rec, idx) => (
                      <div key={idx} className="rounded-md border p-3">
                        <div className="text-sm font-medium">Recommendation {idx + 1}</div>
                        <p className="text-xs text-muted-foreground mt-1">{rec}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No recommendations available
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader className="pt-5 pb-2">
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Proposals</span>
                <span className="text-sm font-medium">{proposals.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Draft</span>
                <span className="text-sm font-medium">{draftProposals.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Submitted</span>
                <span className="text-sm font-medium">{submittedProposals.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
