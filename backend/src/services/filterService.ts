import { type Prisma } from "@prisma/client";
import { UserRole } from "@/models/prisma";

import prisma from "@/config/prisma";
import FilterModel from "@/models/Filter";
import FilterOpportunityModel from "@/models/FilterOpportunity";
import OpportunityModel from "@/models/Opportunity";
import TeamModel from "@/models/Team";
import { findTeamMembersByTeamId } from "@/models/TeamMember";
import UserModel from "@/models/User";
import aiFilterValidationService from "@/services/aiFilterValidationService";
import calendarSchedulingService from "@/services/calendarSchedulingService";
import loggingService from "@/services/loggingService";
import notificationService from "@/services/notificationService";
import samGovService from "@/services/samGovService";

export interface FilterSearchParams {
  keywords?: string[];
  naicsCodes?: string[];
  agencies?: string[];
  setAsides?: string[];
  types?: string[];
  locations?: string[];
  postedFrom?: Date | undefined;
  postedTo?: Date | undefined;
  responseDeadlineFrom?: Date | undefined;
  responseDeadlineTo?: Date | undefined;
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  classificationCodes?: string[];
  [key: string]: unknown;
}

export interface OpportunityData {
  noticeId: string;
  title: string;
  solicitationNumber?: string | null; // Changed from string to string | null
  fullParentPathName?: string;
  fullParentPathCode?: string;
  postedDate?: Date | string;
  type?: string;
  baseType?: string;
  archiveType?: string;
  archiveDate?: Date | string;
  typeOfSetAsideDescription?: string;
  typeOfSetAside?: string;
  responseDeadLine?: Date | string;
  naicsCode?: string;
  naicsCodes?: string[];
  classificationCode?: string;
  active?: string; // Changed from boolean to string to match SAMOpportunity
  award?: Prisma.JsonValue;
  pointOfContact?: Prisma.JsonValue;
  description?: string;
  detailedDescription?: string;
  organizationType?: string;
  officeAddress?: unknown;
  placeOfPerformance?: Prisma.JsonValue;
  additionalInfoLink?: string;
  uiLink?: string;
  links?: unknown;
  resourceLinks?: unknown;
}

export interface FilterMatchResult {
  opportunity: OpportunityData;
  matchReason: string;
  matchedCriteria: string[];
}

export interface FilterUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
}

export interface FilterData {
  id: string;
  name: string;
  description?: string | null;
  criteria: Prisma.JsonValue;
  isActive: boolean;
  isSaved: boolean;
  nextPollAt: Date | null; // Changed from Date to Date | null
  userId?: string;
  teamId?: string | null;
  pollingInterval: number;
  notifyOnNewOpportunities: boolean;
  notifyOnDeadlineReminder: boolean;
  deadlineReminderDays: Prisma.JsonValue;
  user?: FilterUser;
  searchCount?: number;
  opportunityCount?: number;
  lastPolledAt?: Date | null; // Changed from Date to Date | null
  lastSearchAt?: Date | null; // Changed from Date to Date | null
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateFilterData {
  name: string;
  description?: string;
  naturalLanguageDescription?: string;
  criteria: FilterSearchParams;
  userId?: string;
  teamId?: string;
  pollingInterval?: number;
  notificationSettings?: {
    notifyOnNewOpportunities?: boolean;
    notifyOnDeadlineReminder?: boolean;
    deadlineReminderDays?: number[];
  };
}

export interface CreateFilterResult {
  id: string;
  name: string;
  description?: string | null; // Changed from string to string | null to match Prisma
  naturalLanguageDescription?: string | null;
  criteria: FilterSearchParams;
  keywords: string[];
  naicsCodes: string[];
  agencies: string[];
  setAsides: string[];
  types: string[];
  locations: string[];
  postedFrom: Date | null;
  postedTo: Date | null;
  responseDeadlineFrom: Date | null;
  responseDeadlineTo: Date | null;
  estimatedValueMin: number | null;
  estimatedValueMax: number | null;
  classificationCodes: string[];
  isActive: boolean;
  isSaved: boolean;
  userId?: string;
  teamId?: string;
  pollingInterval: number;
  notifyOnNewOpportunities: boolean;
  notifyOnDeadlineReminder: boolean;
  deadlineReminderDays: number[];
  createdAt: Date;
  updatedAt: Date;
}

class FilterService {
  /**
   * Create a new filter
   */
  async createFilter(data: CreateFilterData): Promise<CreateFilterResult> {
    try {
      // Validate AI-generated filter data
      const isAIGenerated = Boolean(data.naturalLanguageDescription);

      if (isAIGenerated) {
        const validation = aiFilterValidationService.validateAIFilter(
          data.naturalLanguageDescription,
          data.criteria as Record<string, unknown>, // Cast for compatibility with FilterCriteria
          {
            strictMode: true,
            allowEmptyCriteria: false,
            validateConsistency: true,
          }
        );

        if (!validation.isValid) {
          throw new Error(
            `AI Filter validation failed: ${validation.errors.join(", ")}`
          );
        }

        // Log warnings and suggestions
        if (validation.warnings.length > 0) {
          loggingService.warn("AI Filter validation warnings", {
            filterName: data.name,
            warnings: validation.warnings,
          });
        }

        if (validation.suggestions.length > 0) {
          loggingService.info("AI Filter suggestions", {
            filterName: data.name,
            suggestions: validation.suggestions,
          });
        }
      }

      // If only natural language provided, attempt to parse it
      if (
        data.naturalLanguageDescription &&
        !aiFilterValidationService.hasValidCriteria(
          data.criteria as Record<string, unknown>
        )
      ) {
        loggingService.info("Parsing natural language to criteria", {
          filterName: data.name,
          naturalLanguageLength: data.naturalLanguageDescription.length,
        });

        data.criteria =
          aiFilterValidationService.parseNaturalLanguageToCriteria(
            data.naturalLanguageDescription
          ) as FilterSearchParams;
      }

      const filter = await FilterModel.create({
        name: data.name,
        description: data.description ?? null,
        naturalLanguageDescription: data.naturalLanguageDescription ?? null,
        criteria: data.criteria as Prisma.InputJsonValue, // Cast for Prisma JSON compatibility
        isActive: true,
        // isSaved: true, // Commented out as it's not used in the current implementation
        user: { connect: { id: data.userId ?? "" } }, // Connect to user by ID
        ...(data.teamId && {
          team: { connect: { id: data.teamId } },
        }),
        pollingInterval: data.pollingInterval ?? 60,
        notifyOnNewOpportunities:
          data.notificationSettings?.notifyOnNewOpportunities ?? true,
        notifyOnDeadlineReminder:
          data.notificationSettings?.notifyOnDeadlineReminder ?? true,
        deadlineReminderDays: data.notificationSettings
          ?.deadlineReminderDays ?? [7, 3, 1],
      });

      // Set initial polling time
      await this.scheduleNextPoll(filter);

      const criteria = filter.criteria as FilterSearchParams;
      return {
        id: filter.id,
        name: filter.name,
        description: filter.description,
        naturalLanguageDescription: filter.naturalLanguageDescription,
        criteria,
        keywords: criteria.keywords ?? [],
        naicsCodes: criteria.naicsCodes ?? [],
        agencies: criteria.agencies ?? [],
        setAsides: criteria.setAsides ?? [],
        types: criteria.types ?? [],
        locations: criteria.locations ?? [],
        postedFrom: criteria.postedFrom ?? null,
        postedTo: criteria.postedTo ?? null,
        responseDeadlineFrom: criteria.responseDeadlineFrom ?? null,
        responseDeadlineTo: criteria.responseDeadlineTo ?? null,
        estimatedValueMin: criteria.estimatedValueMin ?? null,
        estimatedValueMax: criteria.estimatedValueMax ?? null,
        classificationCodes: criteria.classificationCodes ?? [],
        isActive: filter.isActive,
        isSaved: filter.isSaved ?? false,
        userId: filter.userId,
        teamId: filter.teamId ?? "",
        pollingInterval: filter.pollingInterval,
        notifyOnNewOpportunities: filter.notifyOnNewOpportunities,
        notifyOnDeadlineReminder: filter.notifyOnDeadlineReminder,
        deadlineReminderDays: filter.deadlineReminderDays as number[],
        createdAt: filter.createdAt,
        updatedAt: filter.updatedAt,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      const errorStack = error instanceof Error ? error.stack : undefined;

      loggingService.error("Failed to create AI-generated filter:", {
        filterName: data.name,
        error: errorMessage,
        stack: errorStack,
        isAIGenerated: Boolean(data.naturalLanguageDescription),
      });
      throw new Error(`Failed to create filter: ${errorMessage}`);
    }
  }

  /**
   * Search opportunities using a filter (ad-hoc or saved)
   */
  async searchWithFilter(
    criteria: FilterSearchParams,
    _isSaved = false
  ): Promise<FilterMatchResult[]> {
    // Convert criteria to SAM.gov API parameters
    const samParams = this.convertToSAMParams(criteria);

    // Search SAM.gov
    const opportunities = await samGovService.searchOpportunities(samParams);

    // Match opportunities against criteria
    const matches: FilterMatchResult[] = [];

    for (const opp of opportunities) {
      // Convert SAMOpportunity to OpportunityData format
      const opportunityData: OpportunityData = {
        noticeId: opp.noticeId,
        title: opp.title,
        solicitationNumber: opp.solicitationNumber ?? null,
        fullParentPathName: opp.fullParentPathName ?? "",
        fullParentPathCode: opp.fullParentPathCode ?? "",
        postedDate: opp.postedDate ?? "",
        type: opp.type ?? "",
        baseType: opp.baseType ?? "",
        archiveType: opp.archiveType ?? "",
        archiveDate: opp.archiveDate ?? "",
        typeOfSetAsideDescription: opp.typeOfSetAsideDescription ?? "",
        typeOfSetAside: opp.typeOfSetAside ?? "",
        responseDeadLine: opp.responseDeadLine ?? "",
        naicsCode: opp.naicsCode ?? "",
        naicsCodes: opp.naicsCodes ?? [],
        classificationCode: opp.classificationCode ?? "",
        active: opp.active ?? "",
        award: opp.award ? { value: opp.award.amount } : null,
        pointOfContact: (opp.pointOfContact as Prisma.JsonValue) ?? null,
        description: opp.description ?? "",
        detailedDescription: opp.description ?? "", // Use description as detailedDescription if not available
        organizationType: opp.organizationType ?? "",
        officeAddress: opp.officeAddress,
        placeOfPerformance: opp.placeOfPerformance ?? null,
        additionalInfoLink: opp.additionalInfoLink ?? "",
        uiLink: opp.uiLink ?? "",
        links: opp.links,
        resourceLinks: opp.resourceLinks,
      };

      const matchResult = this.matchOpportunityToCriteria(
        opportunityData,
        criteria
      );
      if (matchResult) {
        matches.push(matchResult);
      }
    }

    return matches;
  }

  /**
   * Get all filters ready for polling - only for premium users
   */
  async getFiltersReadyForPolling(): Promise<FilterData[]> {
    return FilterModel.findAll({
      where: {
        isActive: true,
        isSaved: true,
        nextPollAt: {
          lte: new Date(),
        },
      },
      include: {
        user: true, // Include user data to check premium status
      },
    });
  }

  /**
   * Poll a specific filter and update opportunities
   */
  async pollFilter(
    filterId: string
  ): Promise<{ newOpportunities: number; totalOpportunities: number }> {
    const filter = await FilterModel.findOne({ where: { id: filterId } });
    if (!filter) {
      throw new Error("Filter not found");
    }

    // Search for new opportunities
    const criteria = this.convertFilterToSearchParams(filter);
    const matches = await this.searchWithFilter(criteria, true);

    let newOpportunities = 0;

    for (const match of matches) {
      // Check if opportunity already exists
      let opportunity = await OpportunityModel.findOne({
        where: { noticeId: match.opportunity.noticeId },
      });

      if (!opportunity) {
        // Create new opportunity
        opportunity = await OpportunityModel.create({
          noticeId: match.opportunity.noticeId,
          title: match.opportunity.title,
          solicitationNumber: match.opportunity.solicitationNumber ?? null,
          fullParentPathName: match.opportunity.fullParentPathName ?? null,
          fullParentPathCode: match.opportunity.fullParentPathCode ?? null,
          postedDate: match.opportunity.postedDate
            ? new Date(match.opportunity.postedDate)
            : null,
          type: match.opportunity.type ?? null,
          baseType: match.opportunity.baseType ?? null,
          archiveType: match.opportunity.archiveType ?? null,
          archiveDate: match.opportunity.archiveDate
            ? new Date(match.opportunity.archiveDate)
            : null,
          typeOfSetAsideDescription:
            match.opportunity.typeOfSetAsideDescription ?? null,
          typeOfSetAside: match.opportunity.typeOfSetAside ?? null,
          responseDeadLine: match.opportunity.responseDeadLine
            ? new Date(match.opportunity.responseDeadLine)
            : null,
          naicsCode: match.opportunity.naicsCode ?? null,
          naicsCodes: match.opportunity.naicsCodes ?? [],
          classificationCode: match.opportunity.classificationCode ?? null,
          active: match.opportunity.active
            ? String(match.opportunity.active)
            : null,
          award: match.opportunity.award as Prisma.InputJsonValue,
          ...(match.opportunity.pointOfContact
            ? {
                pointOfContact: match.opportunity
                  .pointOfContact as Prisma.InputJsonValue,
              }
            : {}),
          description: match.opportunity.description ?? null,
          detailedDescription: match.opportunity.detailedDescription ?? null,
          organizationType: match.opportunity.organizationType ?? null,
          ...(match.opportunity.officeAddress
            ? {
                officeAddress: match.opportunity
                  .officeAddress as Prisma.InputJsonValue,
              }
            : {}),
          ...(match.opportunity.placeOfPerformance
            ? {
                placeOfPerformance: match.opportunity
                  .placeOfPerformance as Prisma.InputJsonValue,
              }
            : {}),
          additionalInfoLink: match.opportunity.additionalInfoLink ?? null,
          uiLink: match.opportunity.uiLink ?? null,
          ...(match.opportunity.links
            ? {
                links: match.opportunity.links as Prisma.InputJsonValue,
              }
            : {}),
          ...(match.opportunity.resourceLinks
            ? {
                resourceLinks: match.opportunity
                  .resourceLinks as Prisma.InputJsonValue,
              }
            : {}),
        });

        newOpportunities++;
      }

      // Create or update filter-opportunity association
      const existingAssociation = await FilterOpportunityModel.findOne({
        where: {
          filterId: filter.id,
          opportunityId: opportunity.id,
        },
      });

      if (!existingAssociation) {
        await FilterOpportunityModel.create({
          filter: { connect: { id: filter.id } },
          opportunity: { connect: { id: opportunity.id } },
        });
      }
    }

    // Update filter statistics using Prisma compatibility layer
    await FilterModel.update(
      {
        lastPolledAt: new Date(),
        searchCount: (filter.searchCount ?? 0) + 1,
        opportunityCount: await FilterOpportunityModel.count({
          where: { filterId: filter.id },
        }),
        lastSearchAt: new Date(),
      },
      {
        where: { id: filter.id },
      }
    );

    // Schedule next poll
    await this.scheduleNextPoll(filter);

    // Send notifications for new opportunities if enabled
    if (filter.notifyOnNewOpportunities && newOpportunities > 0) {
      await this.sendNewOpportunityNotifications(filter);
    }

    return {
      newOpportunities,
      totalOpportunities: await FilterOpportunityModel.count({
        where: { filterId: filter.id },
      }),
    };
  }

  /**
   * Get deduplicated filters for batch polling
   */
  async getDeduplicatedFiltersForPolling(
    filters?: FilterData[]
  ): Promise<Map<string, FilterData[]>> {
    const filtersToProcess =
      filters ?? (await this.getFiltersReadyForPolling());
    const deduplicatedMap = new Map<string, FilterData[]>();

    for (const filter of filtersToProcess) {
      const hash = this.getFilterHash(filter);
      if (!deduplicatedMap.has(hash)) {
        deduplicatedMap.set(hash, []);
      }
      deduplicatedMap.get(hash)?.push(filter);
    }

    return deduplicatedMap;
  }

  /**
   * Poll multiple filters with deduplication - only for premium users
   */
  async pollDeduplicatedFilters(): Promise<{
    processedFilters: number;
    newOpportunities: number;
  }> {
    const allFilters = await this.getFiltersReadyForPolling();

    // Filter to only include filters from premium users
    const premiumFilters = allFilters.filter((filter) => {
      const { user } = filter;
      const isPremium =
        user &&
        (user.role === UserRole.PREMIUM ||
          user.role === UserRole.ENTERPRISE ||
          user.role === UserRole.ADMIN);
      const isActive = user?.isActive;
      const isEmailVerified = user?.emailVerified;

      return isPremium && isActive && isEmailVerified;
    });

    loggingService.info(
      `Found ${allFilters.length} total filters, ${premiumFilters.length} premium user filters ready for polling`
    );

    if (premiumFilters.length === 0) {
      loggingService.info("No premium user filters ready for polling");
      return { processedFilters: 0, newOpportunities: 0 };
    }

    const deduplicatedMap = await this.getDeduplicatedFiltersForPolling(
      premiumFilters
    );
    let processedFilters = 0;
    let totalNewOpportunities = 0;

    for (const [hash, filters] of deduplicatedMap) {
      if (filters.length === 0) {
        continue;
      }

      // Use the first filter as the representative for API call
      const representativeFilter = filters[0];
      if (!representativeFilter) {
        continue;
      }
      const criteria = this.convertFilterToSearchParams(representativeFilter);

      try {
        // Search once for all filters with the same criteria
        const matches = await this.searchWithFilter(criteria, true);

        // Process each filter
        for (const filter of filters) {
          const result = await this.processFilterMatches(filter, matches);
          processedFilters++;
          totalNewOpportunities += result.newOpportunities;

          // Update filter statistics
          await FilterModel.update(
            {
              lastPolledAt: new Date(),
              searchCount: (filter.searchCount ?? 0) + 1,
              opportunityCount: await FilterOpportunityModel.count({
                where: { filterId: filter.id },
              }),
              lastSearchAt: new Date(),
            },
            {
              where: { id: filter.id },
            }
          );

          // Schedule next poll
          await this.scheduleNextPoll(filter);

          // Send notifications if enabled
          if (filter.notifyOnNewOpportunities && result.newOpportunities > 0) {
            await this.sendNewOpportunityNotifications(filter);
          }
        }
      } catch (error) {
        loggingService.error(`Error polling filters with hash ${hash}:`, error);
        // Continue with other filters even if one group fails
      }
    }

    return { processedFilters, newOpportunities: totalNewOpportunities };
  }

  /**
   * Manually refresh a filter
   */
  async refreshFilter(
    filterId: string
  ): Promise<{ newOpportunities: number; totalOpportunities: number }> {
    const filter = await FilterModel.findOne({ where: { id: filterId } });
    if (!filter) {
      throw new Error("Filter not found");
    }

    // Force immediate polling by setting nextPollAt to now
    await FilterModel.update(
      {
        nextPollAt: new Date(),
      },
      {
        where: { id: filterId },
      }
    );

    return this.pollFilter(filterId);
  }

  /**
   * Archive old opportunities based on filter settings
   */
  async archiveOldOpportunities(
    filterId: string,
    archiveDaysOld = 90
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - archiveDaysOld);

    // Get opportunity IDs for this filter first
    const filterOpportunities = await FilterOpportunityModel.findAll({
      where: { filterId },
    });
    const opportunityIds = filterOpportunities.map((fo) => fo.opportunityId);

    // Update opportunities to inactive using Prisma updateMany
    await prisma.opportunity.updateMany({
      where: {
        id: { in: opportunityIds },
        createdAt: { lt: cutoffDate },
        isActive: true,
      },
      data: { isActive: false },
    });

    // Count the archived opportunities
    const archivedOpportunityCount = await prisma.opportunity.count({
      where: {
        id: { in: opportunityIds },
        createdAt: { lt: cutoffDate },
        isActive: false,
      },
    });

    return archivedOpportunityCount;
  }

  /**
   * Get opportunities for a specific filter
   */
  async getFilterOpportunities(
    filterId: string,
    options: {
      limit?: number;
      offset?: number;
      includeArchived?: boolean;
    } = {}
  ): Promise<{
    opportunities: {
      id: string;
      noticeId: string;
      title: string;
      solicitationNumber?: string | null;
      description?: string | null;
      detailedDescription?: string | null;
      fullParentPathName?: string | null;
      fullParentPathCode?: string | null;
      placeOfPerformance?: Prisma.JsonValue;
      typeOfSetAside?: string | null;
      baseType?: string | null;
      archiveType?: string | null;
      archiveDate?: Date | null;
      active?: string | null;
      award?: Prisma.JsonValue;
      pointOfContact?: Prisma.JsonValue;
      typeOfSetAsideDescription?: string | null;
      classificationCode?: string | null;
      officeAddress?: Prisma.JsonValue;
      additionalInfoLink?: string | null;
      uiLink?: string | null;
      links?: Prisma.JsonValue;
      resourceLinks?: Prisma.JsonValue;
      postedDate?: Date | null;
      responseDeadLine?: Date | null;
      naicsCode?: string | null;
      type?: string | null;
      organizationType?: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }[];
    total: number;
  }> {
    const { limit = 20, offset = 0, includeArchived = false } = options;

    // Get filter opportunity IDs first
    const filterOpportunities = await prisma.filterOpportunity.findMany({
      where: { filterId },
      select: { opportunityId: true },
      skip: offset,
      take: limit,
    });

    const opportunityIds = filterOpportunities.map((fo) => fo.opportunityId);

    // Get the actual opportunities
    const opportunities = await prisma.opportunity.findMany({
      where: {
        id: { in: opportunityIds },
        ...(includeArchived ? {} : { isActive: true }),
      },
      orderBy: { createdAt: "desc" },
    });

    const total = await prisma.filterOpportunity.count({
      where: { filterId },
    });

    return { opportunities, total };
  }

  // Private helper methods

  private getFilterHash(filter: Pick<FilterData, "criteria">): string {
    // Create a unique hash for this filter to enable deduplication
    let criteria: FilterSearchParams = {};

    if (typeof filter.criteria === "string") {
      criteria = JSON.parse(filter.criteria) as FilterSearchParams;
    } else if (
      filter.criteria &&
      typeof filter.criteria === "object" &&
      !Array.isArray(filter.criteria)
    ) {
      criteria = filter.criteria as FilterSearchParams;
    }

    const hashCriteria = {
      keywords: criteria.keywords?.sort(),
      naicsCodes: criteria.naicsCodes?.sort(),
      agencies: criteria.agencies?.sort(),
      setAsides: criteria.setAsides?.sort(),
      types: criteria.types?.sort(),
      locations: criteria.locations?.sort(),
      postedFrom: criteria.postedFrom,
      postedTo: criteria.postedTo,
      responseDeadlineFrom: criteria.responseDeadlineFrom,
      responseDeadlineTo: criteria.responseDeadlineTo,
      estimatedValueMin: criteria.estimatedValueMin,
      estimatedValueMax: criteria.estimatedValueMax,
      classificationCodes: criteria.classificationCodes?.sort(),
    };

    return Buffer.from(JSON.stringify(hashCriteria)).toString("base64");
  }

  private convertToSAMParams(
    criteria: FilterSearchParams
  ): Record<string, string> {
    const params: Record<string, string> = {};

    if (criteria.keywords && criteria.keywords.length > 0) {
      params["q"] = criteria.keywords.join(" OR ");
    }

    if (criteria.naicsCodes && criteria.naicsCodes.length > 0) {
      params["naicsCode"] = criteria.naicsCodes.join(",");
    }

    if (criteria.agencies && criteria.agencies.length > 0) {
      params["agency"] = criteria.agencies.join(",");
    }

    if (criteria.setAsides && criteria.setAsides.length > 0) {
      params["setAside"] = criteria.setAsides.join(",");
    }

    if (criteria.types && criteria.types.length > 0) {
      params["type"] = criteria.types.join(",");
    }

    if (criteria.postedFrom) {
      params["postedFrom"] =
        criteria.postedFrom.toISOString().split("T")[0] ?? "";
    }

    if (criteria.postedTo) {
      params["postedTo"] = criteria.postedTo.toISOString().split("T")[0] ?? "";
    }

    if (criteria.responseDeadlineFrom) {
      params["responseDeadlineFrom"] =
        criteria.responseDeadlineFrom.toISOString().split("T")[0] ?? "";
    }

    if (criteria.responseDeadlineTo) {
      params["responseDeadlineTo"] =
        criteria.responseDeadlineTo.toISOString().split("T")[0] ?? "";
    }

    return params;
  }

  private convertFilterToSearchParams(filter: FilterData): FilterSearchParams {
    // The Prisma Filter model stores criteria as JSON
    // If criteria is stored as JSON, parse it; otherwise use the filter directly
    let criteria: FilterSearchParams = {};

    if (typeof filter.criteria === "string") {
      criteria = JSON.parse(filter.criteria) as FilterSearchParams;
    } else if (
      filter.criteria &&
      typeof filter.criteria === "object" &&
      !Array.isArray(filter.criteria)
    ) {
      criteria = filter.criteria as FilterSearchParams;
    }

    return {
      keywords: criteria.keywords ?? [],
      naicsCodes: criteria.naicsCodes ?? [],
      agencies: criteria.agencies ?? [],
      setAsides: criteria.setAsides ?? [],
      types: criteria.types ?? [],
      locations: criteria.locations ?? [],
      postedFrom: criteria.postedFrom
        ? criteria.postedFrom instanceof Date
          ? criteria.postedFrom
          : new Date(criteria.postedFrom as string)
        : undefined,
      postedTo: criteria.postedTo
        ? criteria.postedTo instanceof Date
          ? criteria.postedTo
          : new Date(criteria.postedTo as string)
        : undefined,
      responseDeadlineFrom: criteria.responseDeadlineFrom
        ? criteria.responseDeadlineFrom instanceof Date
          ? criteria.responseDeadlineFrom
          : new Date(criteria.responseDeadlineFrom as string)
        : undefined,
      responseDeadlineTo: criteria.responseDeadlineTo
        ? criteria.responseDeadlineTo instanceof Date
          ? criteria.responseDeadlineTo
          : new Date(criteria.responseDeadlineTo as string)
        : undefined,
      estimatedValueMin: criteria.estimatedValueMin as number,
      estimatedValueMax: criteria.estimatedValueMax as number,
      classificationCodes: criteria.classificationCodes ?? [],
    };
  }

  private matchOpportunityToCriteria(
    opportunity: OpportunityData,
    criteria: FilterSearchParams
  ): FilterMatchResult | null {
    const matchedCriteria: string[] = [];
    let matchReason = "";

    // Check keyword matches
    if (criteria.keywords && criteria.keywords.length > 0) {
      const titleMatch = criteria.keywords.some((keyword) =>
        opportunity.title?.toLowerCase().includes(keyword.toLowerCase())
      );
      const descMatch = criteria.keywords.some((keyword) =>
        opportunity.description?.toLowerCase().includes(keyword.toLowerCase())
      );

      if (titleMatch ?? descMatch) {
        matchedCriteria.push("keywords");
        matchReason += "Keyword match; ";
      }
    }

    // Check NAICS code matches
    if (criteria.naicsCodes && criteria.naicsCodes.length > 0) {
      if (
        opportunity.naicsCode &&
        criteria.naicsCodes.includes(opportunity.naicsCode)
      ) {
        matchedCriteria.push("naics");
        matchReason += "NAICS code match; ";
      }
    }

    // Check agency matches
    if (criteria.agencies && criteria.agencies.length > 0) {
      if (
        criteria.agencies.some((agency) =>
          opportunity.fullParentPathName
            ?.toLowerCase()
            .includes(agency.toLowerCase())
        )
      ) {
        matchedCriteria.push("agency");
        matchReason += "Agency match; ";
      }
    }

    // Check set-aside matches
    if (criteria.setAsides && criteria.setAsides.length > 0) {
      if (
        opportunity.typeOfSetAside &&
        criteria.setAsides.includes(opportunity.typeOfSetAside)
      ) {
        matchedCriteria.push("setAside");
        matchReason += "Set-aside match; ";
      }
    }

    // Check type matches
    if (criteria.types && criteria.types.length > 0) {
      if (opportunity.type && criteria.types.includes(opportunity.type)) {
        matchedCriteria.push("type");
        matchReason += "Type match; ";
      }
    }

    // Check date range matches
    if (criteria.postedFrom && opportunity.postedDate) {
      const postedDate = new Date(opportunity.postedDate);
      if (postedDate >= criteria.postedFrom) {
        matchedCriteria.push("postedFrom");
        matchReason += "Posted date range match; ";
      }
    }

    if (criteria.postedTo && opportunity.postedDate) {
      const postedDate = new Date(opportunity.postedDate);
      if (postedDate <= criteria.postedTo) {
        matchedCriteria.push("postedTo");
        matchReason += "Posted date range match; ";
      }
    }

    // Check response deadline matches
    if (criteria.responseDeadlineFrom && opportunity.responseDeadLine) {
      const deadline = new Date(opportunity.responseDeadLine);
      if (deadline >= criteria.responseDeadlineFrom) {
        matchedCriteria.push("responseDeadlineFrom");
        matchReason += "Response deadline range match; ";
      }
    }

    if (criteria.responseDeadlineTo && opportunity.responseDeadLine) {
      const deadline = new Date(opportunity.responseDeadLine);
      if (deadline <= criteria.responseDeadlineTo) {
        matchedCriteria.push("responseDeadlineTo");
        matchReason += "Response deadline range match; ";
      }
    }

    // Check estimated value matches
    if (
      criteria.estimatedValueMin &&
      opportunity.award &&
      typeof opportunity.award === "object" &&
      opportunity.award !== null &&
      "value" in opportunity.award
    ) {
      const awardValue = (opportunity.award as { value: number }).value;
      if (awardValue >= criteria.estimatedValueMin) {
        matchedCriteria.push("estimatedValueMin");
        matchReason += "Estimated value range match; ";
      }
    }

    if (
      criteria.estimatedValueMax &&
      opportunity.award &&
      typeof opportunity.award === "object" &&
      opportunity.award !== null &&
      "value" in opportunity.award
    ) {
      const awardValue = (opportunity.award as { value: number }).value;
      if (awardValue <= criteria.estimatedValueMax) {
        matchedCriteria.push("estimatedValueMax");
        matchReason += "Estimated value range match; ";
      }
    }

    // Check classification code matches
    if (
      criteria.classificationCodes &&
      criteria.classificationCodes.length > 0
    ) {
      if (
        opportunity.classificationCode &&
        criteria.classificationCodes.includes(opportunity.classificationCode)
      ) {
        matchedCriteria.push("classification");
        matchReason += "Classification code match; ";
      }
    }

    // Return match if at least one criteria matched
    if (matchedCriteria.length > 0) {
      return {
        opportunity,
        matchReason: matchReason.trim().replace(/; $/, ""),
        matchedCriteria,
      };
    }

    return null;
  }

  private async processFilterMatches(
    filter: FilterData,
    matches: FilterMatchResult[]
  ): Promise<{ newOpportunities: number }> {
    let newOpportunities = 0;

    for (const match of matches) {
      // Check if opportunity already exists
      let opportunity = await OpportunityModel.findOne({
        where: { noticeId: match.opportunity.noticeId },
      });

      let isNewOpportunity = false;
      if (!opportunity) {
        // Create new opportunity
        opportunity = await OpportunityModel.create({
          noticeId: match.opportunity.noticeId,
          title: match.opportunity.title,
          solicitationNumber: match.opportunity.solicitationNumber ?? null,
          fullParentPathName: match.opportunity.fullParentPathName ?? null,
          fullParentPathCode: match.opportunity.fullParentPathCode ?? null,
          postedDate: match.opportunity.postedDate
            ? new Date(match.opportunity.postedDate)
            : null,
          type: match.opportunity.type ?? null,
          baseType: match.opportunity.baseType ?? null,
          archiveType: match.opportunity.archiveType ?? null,
          archiveDate: match.opportunity.archiveDate
            ? new Date(match.opportunity.archiveDate)
            : null,
          typeOfSetAsideDescription:
            match.opportunity.typeOfSetAsideDescription ?? null,
          typeOfSetAside: match.opportunity.typeOfSetAside ?? null,
          responseDeadLine: match.opportunity.responseDeadLine
            ? new Date(match.opportunity.responseDeadLine)
            : null,
          naicsCode: match.opportunity.naicsCode ?? null,
          naicsCodes: match.opportunity.naicsCodes ?? [],
          classificationCode: match.opportunity.classificationCode ?? null,
          active: match.opportunity.active
            ? String(match.opportunity.active)
            : null,
          award: match.opportunity.award as Prisma.InputJsonValue,
          ...(match.opportunity.pointOfContact
            ? {
                pointOfContact: match.opportunity
                  .pointOfContact as Prisma.InputJsonValue,
              }
            : {}),
          description: match.opportunity.description ?? null,
          detailedDescription: match.opportunity.detailedDescription ?? null,
          organizationType: match.opportunity.organizationType ?? null,
          ...(match.opportunity.officeAddress
            ? {
                officeAddress: match.opportunity
                  .officeAddress as Prisma.InputJsonValue,
              }
            : {}),
          ...(match.opportunity.placeOfPerformance
            ? {
                placeOfPerformance: match.opportunity
                  .placeOfPerformance as Prisma.InputJsonValue,
              }
            : {}),
          additionalInfoLink: match.opportunity.additionalInfoLink ?? null,
          uiLink: match.opportunity.uiLink ?? null,
          ...(match.opportunity.links
            ? {
                links: match.opportunity.links as Prisma.InputJsonValue,
              }
            : {}),
          ...(match.opportunity.resourceLinks
            ? {
                resourceLinks: match.opportunity
                  .resourceLinks as Prisma.InputJsonValue,
              }
            : {}),
        });

        newOpportunities++;
        isNewOpportunity = true;
      }

      // Create or update filter-opportunity association
      const existingAssociation = await FilterOpportunityModel.findOne({
        where: {
          filterId: filter.id,
          opportunityId: opportunity.id,
        },
      });

      if (!existingAssociation) {
        await FilterOpportunityModel.create({
          filter: { connect: { id: filter.id } },
          opportunity: { connect: { id: opportunity.id } },
        });
      }

      // Auto-schedule calendar event for new opportunities with deadlines
      if (isNewOpportunity && filter.userId && opportunity.responseDeadLine) {
        try {
          const opportunityForCalendar = {
            id: opportunity.id,
            noticeId: opportunity.noticeId,
            title: opportunity.title,
            responseDeadLine: opportunity.responseDeadLine,
            fullParentPathName: opportunity.fullParentPathName,
            uiLink: opportunity.uiLink,
            description: opportunity.description,
          };

          const calendarResult =
            await calendarSchedulingService.createOpportunityDeadlineEvent(
              filter.userId,
              opportunityForCalendar
            );

          if (calendarResult.success && calendarResult.eventId) {
            await calendarSchedulingService.recordCalendarEvent(
              filter.userId,
              opportunity.id,
              calendarResult.eventId
            );

            loggingService.info(
              "Calendar event created for filter-discovered opportunity",
              {
                userId: filter.userId,
                filterId: filter.id,
                opportunityId: opportunity.id,
                eventId: calendarResult.eventId,
              }
            );
          } else {
            loggingService.info(
              "Calendar event not created for filter-discovered opportunity",
              {
                userId: filter.userId,
                filterId: filter.id,
                opportunityId: opportunity.id,
                reason: calendarResult.error,
              }
            );
          }
        } catch (calendarError) {
          // Don't fail the filter processing if calendar creation fails
          loggingService.error(
            "Error creating calendar event for filter-discovered opportunity",
            {
              error: calendarError,
              userId: filter.userId,
              filterId: filter.id,
              opportunityId: opportunity.id,
            }
          );
        }
      }
    }

    return { newOpportunities };
  }

  private async scheduleNextPoll(filter: FilterData): Promise<void> {
    const nextPollAt = new Date();
    nextPollAt.setMinutes(
      nextPollAt.getMinutes() + (filter.pollingInterval ?? 60)
    );

    await FilterModel.update(
      {
        nextPollAt,
      },
      {
        where: { id: filter.id },
      }
    );
  }

  private async sendNewOpportunityNotifications(
    filter: FilterData
  ): Promise<void> {
    try {
      let recipients: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        isActive: boolean;
        emailVerified: boolean;
      }[] = [];

      if (filter.userId) {
        const user = await UserModel.findOne({ where: { id: filter.userId } });
        if (user) {
          recipients = [
            {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role.toString(),
              isActive: user.isActive,
              emailVerified: user.emailVerified,
            },
          ];
        }
      } else if (filter.teamId) {
        const team = await TeamModel.findOne({ where: { id: filter.teamId } });
        if (team) {
          // Get team members with their user data included
          const teamMembers = await findTeamMembersByTeamId(filter.teamId);

          recipients = teamMembers
            .filter(
              (
                member
              ): member is NonNullable<typeof member> & {
                user: NonNullable<typeof member.user>;
              } => member.user !== null
            )
            .map((member) => ({
              id: member.user.id,
              email: member.user.email,
              firstName: member.user.firstName,
              lastName: member.user.lastName,
              role: member.user.role.toString(),
              isActive: member.user.isActive,
              emailVerified: member.user.emailVerified,
            }));
        }
      }

      // Filter recipients to only include premium users and active users
      const premiumRecipients = recipients.filter((user) => {
        return (
          user.isActive &&
          (user.role === UserRole.PREMIUM ||
            user.role === UserRole.ENTERPRISE ||
            user.role === UserRole.ADMIN)
        );
      });

      if (premiumRecipients.length === 0) {
        loggingService.info(
          `No premium users found for filter ${filter.id}, skipping notifications`
        );
        return;
      }

      loggingService.info(
        `Sending notifications to ${premiumRecipients.length} premium users for filter ${filter.id}`
      );

      for (const user of premiumRecipients) {
        // Get the latest opportunities for this filter to use in the notification
        const filterOpportunities = await FilterOpportunityModel.findAll({
          where: { filterId: filter.id },
          orderBy: { createdAt: "desc" },
          take: 5, // Get the 5 most recent opportunities
        });

        if (filterOpportunities.length > 0) {
          // Send notification for each new opportunity
          for (const filterOpp of filterOpportunities) {
            await notificationService.sendOpportunityNotification({
              opportunityId: filterOpp.opportunityId,
              userId: user.id,
              filterId: filter.id,
            });
          }
        }
      }
    } catch (error) {
      loggingService.error(
        "Error sending new opportunity notifications:",
        error
      );
    }
  }
}

export default new FilterService();
