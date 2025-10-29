"use client";

import { useState } from "react";
import Breadcrumb from "@/components/dashboard/breadcrumb";
import SmartAlertsList from "@/components/dashboard/smart-alerts-list";
import CreateAlertModal from "@/components/dashboard/create-alert-modal";
import MainButton from "@/components/main-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  smartAlerts,
  suggestedSmartAlerts,
  smartAlertStats,
} from "@/lib/mock-data";
import { Plus, Lightbulb } from "lucide-react";

export default function SmartAlertsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="bg-background h-full flex flex-col p-6">
      {/* Main Content Container with White Background */}
      <div className="bg-card rounded-lg p-6 shadow-sm flex-1 flex flex-col">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Home", href: "/dashboard" },
            { label: "Smart Alerts" },
          ]}
          className="mb-6"
        />

        {/* Page Title + Create Button */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-4xl font-bold text-foreground">Smart Alerts</h1>
          <MainButton
            className="flex items-center gap-2"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Create New Alert
          </MainButton>
        </div>

        {/* Content Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Alerts List */}
          <div className="lg:col-span-2 min-h-0">
            <SmartAlertsList alerts={smartAlerts} />
          </div>

          {/* Right - Suggestions + Stats */}
          <div className="space-y-6">
            {/* AI Suggested Alerts */}
            <Card>
              <CardHeader className="pt-4">
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  AI Suggested Alerts
                </CardTitle>
                <CardDescription>
                  Based on your profile and history
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 py-4">
                {suggestedSmartAlerts.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border p-4 bg-background"
                  >
                    <div className="text-sm font-medium text-foreground">
                      {s.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {s.subtitle}
                    </div>
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="mt-3 text-xs font-medium text-primary hover:underline"
                    >
                      Create Alert
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Alert Statistics */}
            <Card>
              <CardHeader className="pt-4">
                <CardTitle>Alert Statistics</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3 text-center py-4">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Total Alerts</div>
                  <div className="text-xl font-semibold text-foreground">
                    {smartAlertStats.totalAlerts}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Active</div>
                  <div className="text-xl font-semibold text-foreground">
                    {smartAlertStats.active}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Triggered Today</div>
                  <div className="text-xl font-semibold text-foreground">
                    {smartAlertStats.triggeredToday}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Create Alert Modal */}
      <CreateAlertModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={() => {
          // TODO: Refresh alerts list or show success message
          console.log("Alert created successfully");
        }}
      />
    </div>
  );
}
