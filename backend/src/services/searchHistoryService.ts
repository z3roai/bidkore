import type { Prisma } from "@prisma/client";
import { SearchType } from "@/models/prisma";

import prisma from "@/config/prisma";
import loggingService from "@/services/loggingService";

export interface CreateSearchHistoryData {
  userId: string;
  teamId?: string;
  searchType: SearchType;
  query?: string;
  filters: Record<string, unknown>;
  searchParams: Record<string, unknown>;
  resultCount: number;
  name?: string;
  description?: string;
  tags?: string[];
}

export interface UpdateSearchHistoryData {
  name?: string;
  description?: string;
  tags?: string[];
  isFavorite?: boolean;
}

export interface SearchHistoryFilters {
  searchType?: SearchType;
  isFavorite?: boolean;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  teamId?: string;
  query?: string;
}

export interface SearchHistoryResult {
  id: string;
  userId: string;
  teamId?: string;
  searchType: SearchType;
  query?: string;
  filters: Record<string, unknown>;
  searchParams: Record<string, unknown>;
  resultCount: number;
  isFavorite: boolean;
  tags: string[];
  name?: string;
  description?: string;
  createdAt: Date;
  lastExecutedAt?: Date;
  executionCount: number;
}

class SearchHistoryService {
  /**
   * Create a new search history entry
   */
  async createSearchHistory(
    data: CreateSearchHistoryData
  ): Promise<SearchHistoryResult> {
    try {
      // Check for duplicate searches within the last 5 minutes
      const recentSearch = await prisma.searchHistory.findFirst({
        where: {
          userId: data.userId,
          searchType: data.searchType,
          query: data.query ?? null,
          filters: data.filters,
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          },
        },
      });

      if (recentSearch) {
        // Update existing search instead of creating duplicate
        return this.updateSearchHistory(recentSearch.id, {
          lastExecutedAt: new Date(),
          executionCount: recentSearch.executionCount + 1,
          resultCount: data.resultCount,
        });
      }

      const searchHistory = await prisma.searchHistory.create({
        data: {
          userId: data.userId,
          teamId: data.teamId ?? null,
          searchType: data.searchType,
          query: data.query ?? null,
          filters: data.filters as Prisma.InputJsonValue,
          searchParams: data.searchParams as Prisma.InputJsonValue,
          resultCount: data.resultCount,
          name: data.name ?? null,
          description: data.description ?? null,
          tags: data.tags ?? [],
          lastExecutedAt: new Date(),
        },
      });

      loggingService.info(`Search history created for user ${data.userId}`, {
        searchHistoryId: searchHistory.id,
        searchType: data.searchType,
      });

      return this.mapToResult(searchHistory);
    } catch (error) {
      loggingService.error("Failed to create search history", error);
      throw new Error("Failed to create search history");
    }
  }

  /**
   * Get search history for a user with optional filters
   */
  async getSearchHistory(
    userId: string,
    filters?: SearchHistoryFilters,
    limit = 50,
    offset = 0
  ): Promise<SearchHistoryResult[]> {
    try {
      const whereClause: Prisma.SearchHistoryWhereInput = {
        userId,
        ...(filters?.teamId && { teamId: filters.teamId }),
        ...(filters?.searchType && { searchType: filters.searchType }),
        ...(filters &&
          filters.isFavorite !== null && {
            isFavorite: filters.isFavorite,
          }),
        ...(filters?.tags && {
          tags: {
            hasSome: filters.tags,
          },
        }),
        ...(filters?.dateFrom && {
          createdAt: {
            gte: filters.dateFrom,
          },
        }),
        ...(filters?.dateTo && {
          createdAt: {
            lte: filters.dateTo,
          },
        }),
        ...(filters?.query && {
          OR: [
            { query: { contains: filters.query, mode: "insensitive" } },
            { name: { contains: filters.query, mode: "insensitive" } },
            { description: { contains: filters.query, mode: "insensitive" } },
          ],
        }),
      };

      const searchHistory = await prisma.searchHistory.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      });

      return searchHistory.map(this.mapToResult);
    } catch (error) {
      loggingService.error("Failed to get search history", error);
      throw new Error("Failed to get search history");
    }
  }

  /**
   * Update search history entry
   */
  async updateSearchHistory(
    id: string,
    data: UpdateSearchHistoryData & {
      lastExecutedAt?: Date;
      executionCount?: number;
      resultCount?: number;
    }
  ): Promise<SearchHistoryResult> {
    try {
      const searchHistory = await prisma.searchHistory.update({
        where: { id },
        data: {
          ...(data.name !== null && { name: data.name }),
          ...(data.description !== null && {
            description: data.description,
          }),
          ...(data.tags !== null && { tags: data.tags }),
          ...(data.isFavorite !== null && { isFavorite: data.isFavorite }),
          ...(data.lastExecutedAt && { lastExecutedAt: data.lastExecutedAt }),
          ...(data.executionCount !== null && {
            executionCount: data.executionCount,
          }),
          ...(data.resultCount !== null && {
            resultCount: data.resultCount,
          }),
        },
      });

      loggingService.info("Search history updated", { searchHistoryId: id });

      return this.mapToResult(searchHistory);
    } catch (error) {
      loggingService.error("Failed to update search history", error);
      throw new Error("Failed to update search history");
    }
  }

  /**
   * Delete search history entry
   */
  async deleteSearchHistory(id: string): Promise<void> {
    try {
      await prisma.searchHistory.delete({
        where: { id },
      });

      loggingService.info("Search history deleted", { searchHistoryId: id });
    } catch (error) {
      loggingService.error("Failed to delete search history", error);
      throw new Error("Failed to delete search history");
    }
  }

  /**
   * Get recent searches for a user
   */
  async getRecentSearches(
    userId: string,
    limit = 10
  ): Promise<SearchHistoryResult[]> {
    try {
      const searchHistory = await prisma.searchHistory.findMany({
        where: { userId },
        orderBy: { lastExecutedAt: "desc" },
        take: limit,
      });

      return searchHistory.map(this.mapToResult);
    } catch (error) {
      loggingService.error("Failed to get recent searches", error);
      throw new Error("Failed to get recent searches");
    }
  }

  /**
   * Get favorite searches for a user
   */
  async getFavoriteSearches(
    userId: string,
    limit = 20
  ): Promise<SearchHistoryResult[]> {
    try {
      const searchHistory = await prisma.searchHistory.findMany({
        where: { userId, isFavorite: true },
        orderBy: { lastExecutedAt: "desc" },
        take: limit,
      });

      return searchHistory.map(this.mapToResult);
    } catch (error) {
      loggingService.error("Failed to get favorite searches", error);
      throw new Error("Failed to get favorite searches");
    }
  }

  /**
   * Toggle favorite status for a search
   */
  async toggleFavorite(id: string): Promise<SearchHistoryResult> {
    try {
      const searchHistory = await prisma.searchHistory.findUnique({
        where: { id },
      });

      if (!searchHistory) {
        throw new Error("Search history not found");
      }

      return this.updateSearchHistory(id, {
        isFavorite: !searchHistory.isFavorite,
      });
    } catch (error) {
      loggingService.error("Failed to toggle favorite", error);
      throw new Error("Failed to toggle favorite");
    }
  }

  /**
   * Add tags to a search
   */
  async addTags(id: string, tags: string[]): Promise<SearchHistoryResult> {
    try {
      const searchHistory = await prisma.searchHistory.findUnique({
        where: { id },
      });

      if (!searchHistory) {
        throw new Error("Search history not found");
      }

      const existingTags = searchHistory.tags;
      const newTags = [...new Set([...existingTags, ...tags])]; // Remove duplicates

      return this.updateSearchHistory(id, { tags: newTags });
    } catch (error) {
      loggingService.error("Failed to add tags", error);
      throw new Error("Failed to add tags");
    }
  }

  /**
   * Remove tags from a search
   */
  async removeTags(
    id: string,
    tagsToRemove: string[]
  ): Promise<SearchHistoryResult> {
    try {
      const searchHistory = await prisma.searchHistory.findUnique({
        where: { id },
      });

      if (!searchHistory) {
        throw new Error("Search history not found");
      }

      const filteredTags = searchHistory.tags.filter(
        (tag) => !tagsToRemove.includes(tag)
      );

      return this.updateSearchHistory(id, { tags: filteredTags });
    } catch (error) {
      loggingService.error("Failed to remove tags", error);
      throw new Error("Failed to remove tags");
    }
  }

  /**
   * Get team search history
   */
  async getTeamSearchHistory(
    teamId: string,
    limit = 50,
    offset = 0
  ): Promise<SearchHistoryResult[]> {
    try {
      const searchHistory = await prisma.searchHistory.findMany({
        where: { teamId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      });

      return searchHistory.map(this.mapToResult);
    } catch (error) {
      loggingService.error("Failed to get team search history", error);
      throw new Error("Failed to get team search history");
    }
  }

  /**
   * Search within search history
   */
  async searchInHistory(
    userId: string,
    query: string,
    limit = 20
  ): Promise<SearchHistoryResult[]> {
    try {
      const searchHistory = await prisma.searchHistory.findMany({
        where: {
          userId,
          OR: [
            { query: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { tags: { hasSome: [query] } },
          ],
        },
        orderBy: { lastExecutedAt: "desc" },
        take: limit,
      });

      return searchHistory.map(this.mapToResult);
    } catch (error) {
      loggingService.error("Failed to search in history", error);
      throw new Error("Failed to search in history");
    }
  }

  /**
   * Get search statistics for a user
   */
  async getSearchStatistics(userId: string): Promise<{
    totalSearches: number;
    favoriteSearches: number;
    mostUsedSearchType: SearchType | null;
    recentActivity: { date: string; count: number }[];
  }> {
    try {
      const [totalSearches, favoriteSearches, searchTypeStats, recentActivity] =
        await Promise.all([
          prisma.searchHistory.count({ where: { userId } }),
          prisma.searchHistory.count({ where: { userId, isFavorite: true } }),
          prisma.searchHistory.groupBy({
            by: ["searchType"],
            where: { userId },
            _count: { searchType: true },
            orderBy: { _count: { searchType: "desc" } },
            take: 1,
          }),
          prisma.$queryRaw<{ date: string; count: number }[]>`
					SELECT
						DATE(created_at) as date,
						COUNT(*) as count
					FROM search_history
					WHERE user_id = ${userId}
						AND created_at >= NOW() - INTERVAL '30 days'
					GROUP BY DATE(created_at)
					ORDER BY date DESC
				`,
        ]);

      return {
        totalSearches,
        favoriteSearches,
        mostUsedSearchType: searchTypeStats[0]?.searchType ?? null,
        recentActivity: recentActivity.map((item) => ({
          date: item.date,
          count: Number(item.count),
        })),
      };
    } catch (error) {
      loggingService.error("Failed to get search statistics", error);
      throw new Error("Failed to get search statistics");
    }
  }

  /**
   * Clean up old search history entries
   */
  async cleanupOldSearches(userId: string, daysToKeep = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.searchHistory.deleteMany({
        where: {
          userId,
          createdAt: { lt: cutoffDate },
          isFavorite: false, // Keep favorites
        },
      });

      loggingService.info(
        `Cleaned up ${result.count} old search history entries for user ${userId}`
      );

      return result.count;
    } catch (error) {
      loggingService.error("Failed to cleanup old searches", error);
      throw new Error("Failed to cleanup old searches");
    }
  }

  /**
   * Map Prisma model to result interface
   */
  private mapToResult(searchHistory: {
    id: string;
    userId: string;
    teamId: string | null;
    searchType: SearchType;
    query: string | null;
    filters: Prisma.JsonValue;
    searchParams: Prisma.JsonValue;
    resultCount: number;
    isFavorite: boolean;
    tags: string[];
    name: string | null;
    description: string | null;
    createdAt: Date;
    lastExecutedAt: Date | null;
    executionCount: number;
  }): SearchHistoryResult {
    return {
      id: searchHistory.id,
      userId: searchHistory.userId,
      ...(searchHistory.teamId && { teamId: searchHistory.teamId }),
      searchType: searchHistory.searchType,
      ...(searchHistory.query && { query: searchHistory.query }),
      filters: searchHistory.filters as Record<string, unknown>,
      searchParams: searchHistory.searchParams as Record<string, unknown>,
      resultCount: searchHistory.resultCount,
      isFavorite: searchHistory.isFavorite,
      tags: searchHistory.tags,
      ...(searchHistory.name && { name: searchHistory.name }),
      ...(searchHistory.description && {
        description: searchHistory.description,
      }),
      createdAt: searchHistory.createdAt,
      ...(searchHistory.lastExecutedAt && {
        lastExecutedAt: searchHistory.lastExecutedAt,
      }),
      executionCount: searchHistory.executionCount,
    };
  }
}

export default new SearchHistoryService();
