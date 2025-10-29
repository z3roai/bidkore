import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getDashboardMetrics,
  getRecentActivities,
  getUpcomingEvents,
} from "@/lib/api";
import Breadcrumb from "@/components/dashboard/breadcrumb";
import KeyMetricCard from "@/components/dashboard/key-metric-card";
import TCVOverview from "@/components/dashboard/tcv-overview";
import RecentActivity from "@/components/dashboard/recent-activity";
import BestMatchOpportunity from "@/components/dashboard/best-match-opportunity";
import UpcomingEvents from "@/components/dashboard/upcoming-events";
import { bestMatchOpportunity } from "@/lib/mock-data";

export default async function DashboardPage() {
  // Fetch session and data in parallel
  const [session, metrics, activities, events] = await Promise.all([
    auth(),
    getDashboardMetrics().catch(() => null),
    getRecentActivities(7).catch(() => []),
    getUpcomingEvents(5).catch(() => []),
  ]);

  // Redirect to sign-in if not authenticated
  if (!session?.user) {
    redirect("/signin");
  }

  // Transform metrics to array format for mapping
  const metricsArray = metrics
    ? [
        {
          icon: "🚀",
          title: "New Opportunities",
          value: metrics.newOpportunities.value.toString(),
          change: `${metrics.newOpportunities.change > 0 ? "+" : ""}${metrics.newOpportunities.change}% vs Last Week`,
          changeType: metrics.newOpportunities.changeType,
        },
        {
          icon: "📄",
          title: "Proposals",
          value: metrics.proposals.value.toString(),
          change: `${metrics.proposals.change > 0 ? "+" : ""}${metrics.proposals.change}% vs Last Week`,
          changeType: metrics.proposals.changeType,
        },
        {
          icon: "📅",
          title: "Due 30+ Days",
          value: metrics.due30Days.value.toString(),
          change: `${metrics.due30Days.change > 0 ? "+" : ""}${metrics.due30Days.change}% vs Last Week`,
          changeType: metrics.due30Days.changeType,
        },
        {
          icon: "🎯",
          title: "Win Rate",
          value: `${metrics.winRate.value}%`,
          change: `${metrics.winRate.change > 0 ? "+" : ""}${metrics.winRate.change}% vs Last Month`,
          changeType: metrics.winRate.changeType,
        },
        {
          icon: "💰",
          title: "TCV",
          value: `${metrics.tcv.value}M`,
          change: `${metrics.tcv.change > 0 ? "+" : ""}${metrics.tcv.change}% vs Last Week`,
          changeType: metrics.tcv.changeType,
        },
      ]
    : [];

  return (
    <div className="bg-background p-6">
      {/* Main Content Container with White Background */}
      <div className="bg-card rounded-lg p-6 shadow-sm">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[{ label: "Home", href: "/" }, { label: "Dashboard" }]}
          className="mb-6"
        />

        {/* Welcome Section */}
        <div className="mb-4">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Welcome {session.user.name || "User"} 👋
          </h1>
          <p className="text-lg text-muted-foreground">
            Find the right opportunities, craft strong submissions, and win
            contracts.
          </p>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          {metricsArray.length > 0 ? (
            metricsArray.map((metric) => (
              <KeyMetricCard key={metric.title} metric={metric} />
            ))
          ) : (
            // Fallback to show loading state or empty state
            <div className="col-span-5 text-center text-muted-foreground">
              Loading metrics...
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="mb-4">
          {/* Left Column */}
          <div className="flex gap-4 mb-4">
            {/* TCV Overview - Remains Client Component */}
            <TCVOverview className="w-20/38" />

            {/* Recent Activity */}
            <RecentActivity
              activities={activities.length > 0 ? activities : []}
              className="w-18/38"
            />
          </div>

          {/* Right Column */}
          <div className="flex gap-5">
            {/* Best Match Opportunity - Using mock data for now */}
            <BestMatchOpportunity
              opportunity={bestMatchOpportunity}
              className="w-23/38"
            />

            {/* Upcoming Events */}
            <UpcomingEvents
              events={events.length > 0 ? events : []}
              className="w-15/38"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
