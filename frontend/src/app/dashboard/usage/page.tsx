"use client";

import Breadcrumb from "@/components/dashboard/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Download, CreditCard, TrendingUp } from "lucide-react";

// Simple horizontal progress bar
function UsageBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">{value}%</span>
      </div>
      <div className="h-2 bg-muted rounded-md">
        <div
          className="h-2 bg-foreground rounded-md"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

// Tiny column chart placeholder (pure CSS) – keeps dependencies light
function MiniMonthlyActivity() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const values = [78, 72, 69, 54, 80, 76];

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="pt-5 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Monthly Activity</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Last 6 Months</span>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>Usage trends over time</CardDescription>
      </CardHeader>
      <CardContent className="py-5">
        <div className="grid grid-cols-6 gap-3 h-32 items-end">
          {values.map((v, i) => (
            <div key={months[i]} className="flex flex-col items-center gap-1">
              <div
                className="w-6 md:w-8 bg-muted rounded-sm border border-border"
                style={{ height: `${v}%` }}
                title={`${months[i]}: ${v}`}
              />
              <span className="text-[10px] text-muted-foreground">
                {months[i]}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-muted border border-border" /> Searches</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-muted border border-border" /> Proposals</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-muted border border-border" /> Documents</span>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  title,
  value,
  change,
}: {
  title: string;
  value: string | number;
  change: string;
}) {
  const isPositive = change.trim().startsWith("+");
  return (
    <Card className="bg-card border border-border">
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground mb-2">{title}</div>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        <div
          className={cn(
            "text-xs mt-1",
            isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
          )}
        >
          {change} vs last month
        </div>
      </CardContent>
    </Card>
  );
}

export default function UsagePage() {
  return (
    <div className="bg-background h-full flex flex-col p-6">
      <div className="bg-card rounded-lg p-6 shadow-sm flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Header row spanning full width */}
        <div className="lg:col-span-12">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Usage" }]} className="mb-6" />

          <div className="mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Usage</h1>
            <p className="text-muted-foreground mt-1">Track your platform usage and subscription details.</p>
          </div>
        </div>

        <div className="flex flex-col lg:col-span-8 xl:col-span-9">

          {/* Top stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Total Searches" value={156} change={"+12%"} />
            <StatCard title="Proposals Generated" value={23} change={"+8%"} />
            <StatCard title="Documents Uploaded" value={48} change={"-3%"} />
            <Card className="bg-card border border-border">
              <CardContent className="p-5">
                <div className="text-sm text-muted-foreground mb-2">AI Credits Left</div>
                <div className="text-3xl font-bold text-foreground">742</div>
                <div className="text-xs text-muted-foreground mt-1">Renews on Jun 1, 2025</div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6">
            <MiniMonthlyActivity />

            {/* Recent Activity */}
            <Card className="bg-card border border-border">
              <CardHeader className="pt-5 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Recent Activity</CardTitle>
                  <Button size="sm" variant="outline">View All</Button>
                </div>
              </CardHeader>
              <CardContent className="py-5">
                <div className="space-y-3">
                  {[
                    "Searched for \"Cybersecurity RFP\"",
                    "Generated proposal for DoD IT Infrastructure",
                    "Uploaded Technical Requirements.docx",
                    "Used AI to analyze competitor proposal",
                    "Added new opportunity deadline",
                  ].map((text, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <TrendingUp className="mt-0.5 h-4 w-4 text-primary" />
                      <span className="text-foreground">{text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col lg:col-span-4 xl:col-span-3 gap-6">
          {/* Usage by Category */}
            <Card className="bg-card border border-border">
              <CardHeader className="pt-5 pb-2">
              <CardTitle className="text-base">Usage by Category</CardTitle>
            </CardHeader>
              <CardContent className="space-y-4 py-5">
              <UsageBar label="AI Search" value={42} />
              <UsageBar label="Proposal Generation" value={28} />
              <UsageBar label="Document Analysis" value={18} />
              <UsageBar label="Email Assistance" value={12} />
            </CardContent>
          </Card>

          {/* Current Plan */}
            <Card className="bg-card border border-border">
              <CardHeader className="pt-5 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                Current Plan <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">Professional</span>
              </CardTitle>
            </CardHeader>
              <CardContent className="text-sm space-y-2 py-5">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Monthly Price</span><span className="text-foreground font-medium">$99 / month</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Billing Cycle</span><span className="text-foreground">Monthly</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Next Billing Date</span><span className="text-foreground">June 1, 2025</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">AI Credits</span><span className="text-foreground">1,000 / month</span></div>
              <div className="flex items-center gap-2 pt-3">
                <Button variant="outline" size="sm" className="gap-1"><CreditCard className="h-4 w-4" /> Manage Payment</Button>
                <Button size="sm" className="gap-1">Upgrade Plan</Button>
              </div>
            </CardContent>
          </Card>

          {/* Top Searches */}
            <Card className="bg-card border border-border">
              <CardHeader className="pt-5 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Top Searches</CardTitle>
                <span className="text-xs text-muted-foreground">Last 30 days</span>
              </div>
            </CardHeader>
              <CardContent className="py-5">
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>IT Infrastructure <span className="text-muted-foreground">— 24 searches</span></li>
                <li>Cybersecurity Services <span className="text-muted-foreground">— 18 searches</span></li>
                <li>Cloud Migration <span className="text-muted-foreground">— 15 searches</span></li>
                <li>Federal RFP <span className="text-muted-foreground">— 12 searches</span></li>
                <li>DoD Contracts <span className="text-muted-foreground">— 10 searches</span></li>
              </ol>
              <Button variant="ghost" size="sm" className="mt-3 gap-1"><Download className="h-4 w-4" /> Export</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


