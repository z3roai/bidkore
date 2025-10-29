import type { SearchType } from "@/models/prisma";
import { type Response, Router } from "express";

import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import loggingService from "@/services/loggingService";
import searchHistoryService from "@/services/searchHistoryService";

const router = Router();

// Get user's search history
router.get(
  "/",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const {
        searchType,
        isFavorite,
        tags,
        dateFrom,
        dateTo,
        teamId,
        query,
        limit = 50,
        offset = 0,
      } = req.query;

      const filters = {
        ...(searchType && { searchType: searchType as SearchType }),
        ...(isFavorite !== null &&
          isFavorite !== undefined && { isFavorite: isFavorite === "true" }),
        ...(tags && {
          tags: Array.isArray(tags)
            ? tags.map((tag) => (typeof tag === "string" ? tag : String(tag)))
            : [typeof tags === "string" ? tags : String(tags)],
        }),
        ...(dateFrom && { dateFrom: new Date(dateFrom as string) }),
        ...(dateTo && { dateTo: new Date(dateTo as string) }),
        ...(teamId && { teamId: String(teamId) }),
        ...(query && { query: query as string }),
      };

      const searchHistory = await searchHistoryService.getSearchHistory(
        req.user.id,
        Object.keys(filters).length > 0 ? filters : undefined,
        parseInt(limit as string, 10),
        parseInt(offset as string, 10)
      );

      res.json({
        success: true,
        data: searchHistory,
        pagination: {
          limit: parseInt(limit as string, 10),
          offset: parseInt(offset as string, 10),
          total: searchHistory.length,
        },
      });
    } catch (error) {
      loggingService.error("Failed to get search history", error);
      res.status(500).json({ error: "Failed to get search history" });
    }
  }
);

// Create new search history entry
router.post(
  "/",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const {
        searchType,
        query,
        filters,
        searchParams,
        resultCount,
        name,
        description,
        tags,
        teamId,
      } = req.body as {
        searchType?: string;
        query?: string;
        filters?: Record<string, unknown>;
        searchParams?: Record<string, unknown>;
        resultCount?: number;
        name?: string;
        description?: string;
        tags?: string[];
        teamId?: string;
      };

      if (!searchType || !filters || !searchParams) {
        res.status(400).json({
          error: "searchType, filters, and searchParams are required",
        });
        return;
      }

      const searchHistory = await searchHistoryService.createSearchHistory({
        userId: req.user.id,
        ...(teamId && { teamId: String(teamId) }),
        searchType: searchType as SearchType,
        ...(query && { query }),
        filters: filters || {},
        searchParams: searchParams || {},
        resultCount: resultCount ?? 0,
        ...(name && { name }),
        ...(description && { description }),
        ...(tags && { tags }),
      });

      res.status(201).json({
        success: true,
        data: searchHistory,
      });
    } catch (error) {
      loggingService.error("Failed to create search history", error);
      res.status(500).json({ error: "Failed to create search history" });
    }
  }
);

// Get recent searches
router.get(
  "/recent",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const { limit = 10 } = req.query;

      const recentSearches = await searchHistoryService.getRecentSearches(
        req.user.id,
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: recentSearches,
      });
    } catch (error) {
      loggingService.error("Failed to get recent searches", error);
      res.status(500).json({ error: "Failed to get recent searches" });
    }
  }
);

// Get favorite searches
router.get(
  "/favorites",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const { limit = 20 } = req.query;

      const favoriteSearches = await searchHistoryService.getFavoriteSearches(
        req.user.id,
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: favoriteSearches,
      });
    } catch (error) {
      loggingService.error("Failed to get favorite searches", error);
      res.status(500).json({ error: "Failed to get favorite searches" });
    }
  }
);

// Get team search history
router.get(
  "/team/:teamId",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const { teamId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // Note: Team membership validation should be added here
      const teamSearchHistory = await searchHistoryService.getTeamSearchHistory(
        String(teamId),
        parseInt(limit as string, 10),
        parseInt(offset as string, 10)
      );

      res.json({
        success: true,
        data: teamSearchHistory,
      });
    } catch (error) {
      loggingService.error("Failed to get team search history", error);
      res.status(500).json({ error: "Failed to get team search history" });
    }
  }
);

// Search within search history
router.get(
  "/search",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const { q, limit = 20 } = req.query;

      if (!q) {
        res.status(400).json({ error: "Query parameter 'q' is required" });
        return;
      }

      const searchResults = await searchHistoryService.searchInHistory(
        req.user.id,
        q as string,
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: searchResults,
      });
    } catch (error) {
      loggingService.error("Failed to search in history", error);
      res.status(500).json({ error: "Failed to search in history" });
    }
  }
);

// Get search statistics
router.get(
  "/statistics",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const statistics = await searchHistoryService.getSearchStatistics(
        req.user.id
      );

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      loggingService.error("Failed to get search statistics", error);
      res.status(500).json({ error: "Failed to get search statistics" });
    }
  }
);

// Update search history entry
router.put(
  "/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const { id } = req.params;
      const { name, description, tags, isFavorite } = req.body as {
        name?: string;
        description?: string;
        tags?: string[];
        isFavorite?: boolean;
      };

      const searchHistory = await searchHistoryService.updateSearchHistory(
        String(id),
        {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(tags !== undefined && { tags }),
          ...(isFavorite !== undefined && { isFavorite }),
        }
      );

      res.json({
        success: true,
        data: searchHistory,
      });
    } catch (error) {
      loggingService.error("Failed to update search history", error);
      res.status(500).json({ error: "Failed to update search history" });
    }
  }
);

// Delete search history entry
router.delete(
  "/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const { id } = req.params;

      await searchHistoryService.deleteSearchHistory(String(id));

      res.json({
        success: true,
        message: "Search history deleted successfully",
      });
    } catch (error) {
      loggingService.error("Failed to delete search history", error);
      res.status(500).json({ error: "Failed to delete search history" });
    }
  }
);

// Toggle favorite status
router.put(
  "/:id/favorite",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const { id } = req.params;

      const searchHistory = await searchHistoryService.toggleFavorite(
        String(id)
      );

      res.json({
        success: true,
        data: searchHistory,
      });
    } catch (error) {
      loggingService.error("Failed to toggle favorite", error);
      res.status(500).json({ error: "Failed to toggle favorite" });
    }
  }
);

// Add tags to search
router.post(
  "/:id/tags",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const { id } = req.params;
      const { tags } = req.body as {
        tags?: string[];
      };

      if (!tags || !Array.isArray(tags)) {
        res.status(400).json({ error: "Tags array is required" });
        return;
      }

      const searchHistory = await searchHistoryService.addTags(
        String(id),
        tags
      );

      res.json({
        success: true,
        data: searchHistory,
      });
    } catch (error) {
      loggingService.error("Failed to add tags", error);
      res.status(500).json({ error: "Failed to add tags" });
    }
  }
);

// Remove tags from search
router.delete(
  "/:id/tags",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const { id } = req.params;
      const { tags } = req.body as {
        tags?: string[];
      };

      if (!tags || !Array.isArray(tags)) {
        res.status(400).json({ error: "Tags array is required" });
        return;
      }

      const searchHistory = await searchHistoryService.removeTags(
        String(id),
        tags
      );

      res.json({
        success: true,
        data: searchHistory,
      });
    } catch (error) {
      loggingService.error("Failed to remove tags", error);
      res.status(500).json({ error: "Failed to remove tags" });
    }
  }
);

// Cleanup old searches
router.post(
  "/cleanup",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const { daysToKeep = 90 } = req.body as {
        daysToKeep?: number;
      };

      const deletedCount = await searchHistoryService.cleanupOldSearches(
        req.user.id,
        daysToKeep
      );

      res.json({
        success: true,
        message: `Cleaned up ${deletedCount} old search history entries`,
        deletedCount,
      });
    } catch (error) {
      loggingService.error("Failed to cleanup old searches", error);
      res.status(500).json({ error: "Failed to cleanup old searches" });
    }
  }
);

export default router;
