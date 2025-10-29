/**
 * Server-side API utility for Next.js Server Components
 *
 * This module provides functions to fetch data from the backend API
 * with proper authentication token forwarding from NextAuth sessions.
 *
 * ⚠️ IMPORTANT: These functions should ONLY be used in Server Components,
 * Server Actions, or Route Handlers. They will not work in Client Components.
 */

import { auth } from "@/lib/auth";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface FetchOptions extends RequestInit {
  requireAuth?: boolean;
}

/**
 * Generic fetch wrapper that handles authentication and error handling
 */
async function fetchFromBackend<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { requireAuth = true, ...fetchOptions } = options;

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Merge existing headers if provided
  if (fetchOptions.headers) {
    const existingHeaders = new Headers(fetchOptions.headers);
    existingHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  // Add authentication token if required
  if (requireAuth) {
    const session = await auth();

    if (!session?.accessToken) {
      throw new Error("Authentication required: No access token found");
    }

    headers["Authorization"] = `Bearer ${session.accessToken}`;
  }

  // Make the request
  const url = `${BACKEND_URL}${path}`;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error ||
          errorData.message ||
          `API Error: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error occurred while fetching from backend");
  }
}

// ============================================================================
// User & Profile API
// ============================================================================

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  avatar?: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getCurrentUser(): Promise<User> {
  const response = await fetchFromBackend<{ user: User }>("/auth/me");
  return response.user;
}

// ============================================================================
// Dashboard Metrics API
// ============================================================================

export interface DashboardMetric {
  value: number;
  change: number;
  changeType: "positive" | "negative";
}

export interface DashboardMetrics {
  newOpportunities: DashboardMetric;
  proposals: DashboardMetric;
  due30Days: DashboardMetric;
  winRate: DashboardMetric;
  tcv: DashboardMetric;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const response = await fetchFromBackend<{ metrics: DashboardMetrics }>(
    "/analytics/dashboard/metrics",
  );
  return response.metrics;
}

// ============================================================================
// Recent Activities API
// ============================================================================

export interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

export async function getRecentActivities(limit = 10): Promise<Activity[]> {
  const response = await fetchFromBackend<{ activities: Activity[] }>(
    `/analytics/dashboard/activities?limit=${limit}`,
  );
  return response.activities;
}

// ============================================================================
// Upcoming Events API
// ============================================================================

export interface Event {
  id: string;
  title: string;
  time: string;
  timestamp: string;
}

export async function getUpcomingEvents(limit = 10): Promise<Event[]> {
  const response = await fetchFromBackend<{ events: Event[] }>(
    `/analytics/dashboard/events?limit=${limit}`,
  );
  return response.events;
}

// ============================================================================
// TCV Data API
// ============================================================================

export interface TCVDataPoint {
  period: string;
  value: number;
  isHighlighted?: boolean;
}

export type TimePeriod = "daily" | "monthly" | "yearly";

export async function getTCVData(
  period: TimePeriod = "monthly",
): Promise<TCVDataPoint[]> {
  const response = await fetchFromBackend<{
    period: string;
    data: TCVDataPoint[];
  }>(`/analytics/dashboard/tcv?period=${period}`);
  return response.data;
}

// ============================================================================
// Opportunities API
// ============================================================================

export interface Opportunity {
  id: string;
  noticeId: string;
  title: string;
  description?: string;
  department?: string;
  location?: string;
  postedDate?: string;
  responseDeadline?: string;
  estimatedValue?: number;
  naicsCode?: string;
  setAside?: string;
  status?: string;
  archived?: boolean;
  attachmentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunitiesResponse {
  opportunities: Opportunity[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface GetOpportunitiesOptions {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  archived?: boolean;
}

export async function getOpportunities(
  options: GetOpportunitiesOptions = {},
): Promise<OpportunitiesResponse> {
  const { page = 1, limit = 10, status, search, archived = false } = options;

  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (status) params.append("status", status);
  if (search) params.append("q", search);
  if (archived) params.append("archived", "true");

  return fetchFromBackend<OpportunitiesResponse>(
    `/opportunities?${params.toString()}`,
  );
}

export async function getOpportunityById(id: string): Promise<Opportunity> {
  const response = await fetchFromBackend<{ opportunity: Opportunity }>(
    `/opportunities/${id}`,
  );
  return response.opportunity;
}

// ============================================================================
// Smart Alerts API
// ============================================================================

export interface SmartAlert {
  id: string;
  contract: string;
  status: "Active" | "Inactive";
  interval: string;
  dueDate: string;
}

export async function getSmartAlerts(): Promise<SmartAlert[]> {
  // TODO: Implement when backend endpoint is ready
  // For now, return empty array
  return [];
}

// ============================================================================
// Pipeline API
// ============================================================================

export interface PipelineCard {
  id: string;
  name: string;
  column: string;
  program?: string;
  dueDate?: string;
  status?: "active" | "inactive";
  location?: string;
  documents?: number;
  department?: string;
  tcv?: number;
}

export async function getPipelineCards(
  filter: "all" | "active" = "all",
): Promise<PipelineCard[]> {
  // TODO: Implement when backend endpoint is ready
  // This will likely be a filtered opportunities query
  const response = await getOpportunities({
    status: filter === "active" ? "active" : undefined,
    limit: 100,
  });

  // Transform opportunities to pipeline cards
  // This is a placeholder - adjust based on actual data structure
  return response.opportunities.map((opp) => ({
    id: opp.id,
    name: opp.title,
    column: "proposal", // TODO: Map from opportunity status
    program: opp.setAside,
    dueDate: opp.responseDeadline,
    status: opp.status as "active" | "inactive",
    location: opp.location,
    documents: opp.attachmentCount,
    department: opp.department,
    tcv: opp.estimatedValue,
  }));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if the user is authenticated (has a valid session)
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await auth();
  return !!session?.accessToken;
}

/**
 * Get the current user's session
 */
export async function getSession() {
  return await auth();
}

/**
 * Make a custom API request with authentication
 * Useful for endpoints not yet wrapped in this utility
 */
export async function apiRequest<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  return fetchFromBackend<T>(path, options);
}
