"use client";

import { useMemo, useState } from "react";
import Breadcrumb from "@/components/dashboard/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FileText,
  BookOpen,
  ShieldCheck,
  PencilLine,
  Upload,
  CheckCircle2,
  Wand2,
  Sparkles,
  Download,
  Building2,
  Calendar,
} from "lucide-react";

type TabKey = "new" | "drafts" | "submitted";

export default function ProposalAssistantPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("new");
  const [activeStep, setActiveStep] = useState(1);
  const savedDrafts = useMemo(
    () => [
      {
        id: "1",
        title: "IT Infrastructure Proposal",
        agency: "Department of Defense",
        lastSaved: "2 days ago",
        due: "June 15, 2023",
      },
      {
        id: "2",
        title: "Cloud Migration Services",
        agency: "Department of Energy",
        lastSaved: "3 days ago",
        due: "July 10, 2023",
      },
      {
        id: "3",
        title: "Network Security Assessment",
        agency: "Department of Health",
        lastSaved: "1 week ago",
        due: "June 30, 2023",
      },
      {
        id: "4",
        title: "Data Analytics Platform",
        agency: "General Services Administration",
        lastSaved: "1 week ago",
        due: "August 5, 2023",
      },
      {
        id: "5",
        title: "Software Development Services",
        agency: "Department of Transportation",
        lastSaved: "2 weeks ago",
        due: "July 22, 2023",
      },
      {
        id: "6",
        title: "IT Infrastructure Proposal",
        agency: "Department of Defense",
        lastSaved: "2 days ago",
        due: "June 15, 2023",
      },
    ],
    []
  );

  return (
    <div className="bg-background h-full flex flex-col p-6">
      {/* Main Content Container with White Background */}
      <div className="bg-card rounded-lg p-6 shadow-sm flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main column */}
        <div className="flex flex-col lg:col-span-8 xl:col-span-9">
          {/* Breadcrumb */}
          <Breadcrumb
            items={[{ label: "Home", href: "/" }, { label: "Proposal Assistant" }]}
            className="mb-6"
          />

          {/* Header */}
          <div className="mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Proposal Assistant</h1>
            <p className="text-muted-foreground mt-1">
              Create, manage, and optimize your proposal documents.
            </p>
          </div>

          {/* Tabs */}
          <div className="mt-4">
            <div className="inline-flex rounded-md border bg-background p-1">
              {[
                { key: "new", label: "New Proposal" },
                { key: "drafts", label: "Saved Drafts" },
                { key: "submitted", label: "Submitted" },
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

          {activeTab === "new" && (
            <>
              {/* Stepper (read-only, with connectors) */}
              <Card className="mt-6">
                <CardContent className="p-5">
                  <div className="flex items-center">
                    {[
                      { step: 1, label: "Document Library", state: "done" as const },
                      { step: 2, label: "Compliance Matrix", state: "done" as const },
                      { step: 3, label: "Write Proposal", state: "current" as const },
                      { step: 4, label: "Review & Export", state: "upcoming" as const },
                    ].map((item, idx, arr) => (
                      <div key={item.label} className="flex items-center flex-1">
                        <div className="flex flex-col items-center gap-2 min-w-0">
                          <div
                            className={cn(
                              "flex size-10 items-center justify-center rounded-full border",
                              item.state === "done" && "bg-foreground text-background border-foreground",
                              item.state === "current" && "bg-accent text-foreground border-transparent",
                              item.state === "upcoming" && "bg-muted text-muted-foreground border-transparent"
                            )}
                          >
                            {item.state === "done" ? (
                              <CheckCircle2 className="size-5" />
                            ) : (
                              <span className="text-sm font-semibold">{item.step}</span>
                            )}
                          </div>
                          <span className="truncate text-xs font-medium text-foreground/90">
                            {item.label}
                          </span>
                        </div>
                        {idx < arr.length - 1 && (
                          <div className="mx-4 hidden sm:block h-px flex-1 bg-muted" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Editor section */}
              <Card className="mt-6 flex-1">
                <CardHeader className="pt-5 pb-2">
                  <CardTitle>Technical Approach - Section 3.1</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 pb-6">
                  <div className="rounded-md border bg-muted/40 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Sparkles className="size-4" /> AI Guidelines
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Include specific technical methodologies, timeline milestones, and past
                      performance examples. Address all compliance requirements from Section 2.
                    </p>
                  </div>

                  <textarea
                    className="min-h-[260px] w-full resize-y rounded-lg border bg-background p-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Write your proposal section here..."
                  />

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button className="gap-2">
                      <Wand2 className="size-4" /> Generate with AI
                    </Button>
                    <Button variant="outline">Improve Writing</Button>
                    <Button variant="outline">Check Compliance</Button>
                    <Button variant="secondary" className="ml-auto gap-2">
                      <CheckCircle2 className="size-4" /> Save Draft
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "drafts" && (
            <Card className="mt-6">
              <CardContent className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {savedDrafts.map((d) => (
                    <div key={d.id} className="rounded-xl border p-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>Last saved: {d.lastSaved}</span>
                      </div>
                      <div className="text-sm font-semibold">{d.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{d.agency}</div>
                      <div className="mt-2 text-xs text-muted-foreground">Due: {d.due}</div>
                      <div className="mt-4 flex gap-3">
                        <Button variant="outline" className="px-4">Edit</Button>
                        <Button className="px-5">Continue</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submitted tab */}
          {activeTab === "submitted" && (
            <Card className="mt-6">
              <CardContent className="p-5">
                <div className="space-y-4">
                  {[
                    {
                      id: "1",
                      title: "Cybersecurity Services Proposal",
                      agency: "Department of Energy",
                      submittedDate: "May 10, 2023",
                      status: "Under Review",
                      statusColor: "bg-orange-50 text-orange-700 border-orange-200",
                    },
                    {
                      id: "2",
                      title: "IT Support Services",
                      agency: "Department of Defense",
                      submittedDate: "April 22, 2023",
                      status: "Accepted",
                      statusColor: "bg-green-50 text-green-700 border-green-200",
                    },
                    {
                      id: "3",
                      title: "Cloud Infrastructure Migration",
                      agency: "General Services Administration",
                      submittedDate: "March 15, 2023",
                      status: "Rejected",
                      statusColor: "bg-red-50 text-red-700 border-red-200",
                    },
                  ].map((proposal) => (
                    <div
                      key={proposal.id}
                      className="flex items-center gap-4 rounded-lg border p-4 hover:bg-accent/30 transition-colors"
                    >
                      {/* Document icon */}
                      <div className="flex size-12 items-center justify-center rounded-md bg-muted">
                        <FileText className="size-6 text-muted-foreground" />
                      </div>

                      {/* Middle section */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground mb-2">{proposal.title}</h3>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Building2 className="size-4" />
                            <span>{proposal.agency}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="size-4" />
                            <span>Submitted: {proposal.submittedDate}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right section */}
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" className="gap-2">
                          <Download className="size-4" />
                          Download
                        </Button>
                        <span
                          className={cn(
                            "rounded-md border px-3 py-1 text-xs font-medium",
                            proposal.statusColor
                          )}
                        >
                          {proposal.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right section on the right for wide screens, below on mobile */}
        <div className="space-y-6 lg:col-span-4 xl:col-span-3">
          <Card>
            <CardHeader className="pt-5 pb-2">
              <CardTitle>Compliance Score</CardTitle>
              <CardDescription>Overall</CardDescription>
            </CardHeader>
            <CardContent className="pb-5">
              <div>
                <div className="h-2 w-full rounded-full bg-muted" />
                <div className="-mt-2 h-2 w-[87%] rounded-full bg-primary" />
                <div className="mt-2 text-sm font-medium">87%</div>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                {[
                  { label: "Technical Requirements", status: "Met" },
                  { label: "Past Performance", status: "Met" },
                  { label: "Pricing Format", status: "Review" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-xs rounded-full border px-2 py-0.5">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pt-5 pb-2">
              <CardTitle>AI Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-5">
              <div className="rounded-md border p-3">
                <div className="text-sm font-medium">Add specific metrics</div>
                <p className="text-xs text-muted-foreground">
                  Include quantified outcomes from past projects
                </p>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-sm font-medium">Strong technical depth</div>
                <p className="text-xs text-muted-foreground">
                  Your approach is well-detailed
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Move Active Proposals to bottom */}
          <Card>
            <CardHeader className="pt-5 pb-2">
              <CardTitle>Active Proposals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-5">
              {[
                { title: "DoD Cloud Modernization", status: "In Progress" },
                { title: "DHS Cybersecurity RFP", status: "Review" },
                { title: "GSA Data Platform", status: "Draft" },
              ].map((p) => (
                <div key={p.title} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="text-sm">{p.title}</span>
                  </div>
                  <span className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground">
                    {p.status}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


