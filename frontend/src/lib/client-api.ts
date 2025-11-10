import { useSession } from "next-auth/react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface FetchOptions extends RequestInit {
  token?: string;
}

// Cache management for AI Search results
const CACHE_KEY = "ai_search_cache";
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface CachedData<T> {
  data: T;
  timestamp: number;
}

function getCachedData<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${key}`);
    if (!cached) return null;

    const parsed: CachedData<T> = JSON.parse(cached);
    const isExpired = Date.now() - parsed.timestamp > CACHE_DURATION;

    if (isExpired) {
      localStorage.removeItem(`${CACHE_KEY}_${key}`);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

function setCachedData<T>(key: string, data: T): void {
  try {
    const cacheData: CachedData<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(`${CACHE_KEY}_${key}`, JSON.stringify(cacheData));
  } catch {
    // Silently fail if localStorage is not available
  }
}

async function fetchFromBackend<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (fetchOptions.headers) {
    const existingHeaders = new Headers(fetchOptions.headers);
    existingHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${BACKEND_URL}${path}`;

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
}

export interface ProposalSections {
  executiveSummary: string;
  technicalApproach: string;
  pastPerformance: string;
  keyPersonnel: string;
  managementPlan: string;
}

export interface Proposal {
  id: string;
  userId: string;
  opportunityId?: string;
  title: string;
  sections: ProposalSections;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED";
  complianceScore?: number;
  aiRecommendations?: string[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  opportunity?: {
    id: string;
    title: string;
    noticeId: string;
    fullParentPathName: string | null;
    responseDeadLine: string | null;
  };
}

export interface ProposalsResponse {
  success: boolean;
  data: Proposal[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface GenerateProposalResponse {
  success: boolean;
  data: Proposal;
  message: string;
}

export const clientApi = {
  async generateProposal(
    opportunityId: string,
    token: string,
  ): Promise<GenerateProposalResponse> {
    return fetchFromBackend<GenerateProposalResponse>("/api/proposals/generate", {
      method: "POST",
      body: JSON.stringify({ opportunityId }),
      token,
    });
  },

  async getProposals(
    token: string,
    status?: string,
    limit = 50,
    offset = 0,
  ): Promise<ProposalsResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (status) params.append("status", status);

    return fetchFromBackend<ProposalsResponse>(
      `/api/proposals?${params.toString()}`,
      { token },
    );
  },

  async getProposalById(id: string, token: string): Promise<Proposal> {
    const response = await fetchFromBackend<{
      success: boolean;
      data: Proposal;
    }>(`/api/proposals/${id}`, { token });
    return response.data;
  },

  async updateProposal(
    id: string,
    data: {
      title?: string;
      sections?: Partial<ProposalSections>;
      status?: Proposal["status"];
    },
    token: string,
  ): Promise<Proposal> {
    const response = await fetchFromBackend<{
      success: boolean;
      data: Proposal;
    }>(`/api/proposals/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      token,
    });
    return response.data;
  },

  async deleteProposal(id: string, token: string): Promise<void> {
    await fetchFromBackend<{ success: boolean }>(`/api/proposals/${id}`, {
      method: "DELETE",
      token,
    });
  },

  async generateProposalSection(
    id: string,
    sectionName: keyof ProposalSections,
    token: string,
    context?: string,
  ): Promise<string> {
    const response = await fetchFromBackend<{
      success: boolean;
      data: { section: string };
    }>(`/api/proposals/${id}/sections`, {
      method: "POST",
      body: JSON.stringify({ sectionName, context }),
      token,
    });
    return response.data.section;
  },

  async improveProposalText(
    id: string,
    text: string,
    token: string,
    context?: string,
  ): Promise<{
    improvedText: string;
    changes: string[];
    score: number;
  }> {
    const response = await fetchFromBackend<{
      success: boolean;
      data: {
        improvedText: string;
        changes: string[];
        score: number;
      };
    }>(`/api/proposals/${id}/improve`, {
      method: "POST",
      body: JSON.stringify({ text, context }),
      token,
    });
    return response.data;
  },

  async checkProposalCompliance(
    id: string,
    token: string,
  ): Promise<{
    score: number;
    checks: Array<{
      requirement: string;
      status: "met" | "missing" | "partial";
      details: string;
    }>;
    recommendations: string[];
  }> {
    const response = await fetchFromBackend<{
      success: boolean;
      data: {
        score: number;
        checks: Array<{
          requirement: string;
          status: "met" | "missing" | "partial";
          details: string;
        }>;
        recommendations: string[];
      };
    }>(`/api/proposals/${id}/compliance`, {
      method: "POST",
      token,
    });
    return response.data;
  },

  async submitProposal(id: string, token: string): Promise<Proposal> {
    const response = await fetchFromBackend<{
      success: boolean;
      data: Proposal;
    }>(`/api/proposals/${id}/submit`, {
      method: "POST",
      token,
    });
    return response.data;
  },

  async getOpportunities(
    token: string,
    page = 1,
    limit = 10,
  ): Promise<{
    opportunities: Array<{
      id: string;
      title: string;
      noticeId: string;
      description?: string;
      responseDeadline?: string;
      fullParentPathName?: string;
    }>;
    total: number;
  }> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await fetchFromBackend<{
      opportunities: Array<{
        id: string;
        title: string;
        noticeId: string;
        description?: string;
        responseDeadline?: string;
        fullParentPathName?: string;
      }>;
      total: number;
    }>(`/api/opportunities?${params.toString()}`, { token });

    return response;
  },

  async aiSearch(
    query: string,
    token: string,
    context?: {
      includeRelated?: boolean;
      maxResults?: number;
    },
  ): Promise<{
    success: boolean;
    query: string;
    searchType: string;
    aiServiceAvailable: boolean;
    filterSummary?: {
      keyword?: string;
      naicsCode?: string;
      agency?: string;
      postedFrom?: string;
      postedTo?: string;
      status?: string;
      type?: string;
    };
    opportunities: Array<{
      id: string | null;
      samId: string;
      noticeId: string;
      title: string;
      description: string;
      agency: string;
      naicsCode?: string;
      classificationCode?: string;
      postedDate?: string;
      responseDeadline?: string;
      setAside?: string;
      location: string;
      estimatedValue?: number | null;
      uiLink?: string;
      score?: number;
      whyRanked?: string[];
      probabilityOfSuccess?: number;
      bidability?: string;
      winRate?: number;
      assistantAnalysis?: string[];
      assistantAdvice?: string;
      enhancedData?: unknown;
      historicalAwards?: unknown;
      entityInfo?: unknown;
    }>;
    total: number;
    limit: number;
    offset: number;
    source: string;
    searchedAt: string;
    message?: string;
  }> {
    // Check cache first
    const cacheKey = `${query}_${JSON.stringify(context || {})}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from API if not cached
    const result = await fetchFromBackend(`/api/ai/search`, {
      method: "POST",
      body: JSON.stringify({ query, context }),
      token,
    });

    // Cache the result
    setCachedData(cacheKey, result);

    return result;
  },
};

export function useApiToken() {
  const { data: session } = useSession();
  return session?.accessToken as string | undefined;
}
