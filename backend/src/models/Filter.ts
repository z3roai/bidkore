// Filter model

import type { Filter, FilterOpportunity, Opportunity, Prisma, Team, User } from "@prisma/client";

import prisma from "@/config/prisma";

// Re-export Prisma types
export type { Filter };
export type FilterCreateInput = Prisma.FilterCreateInput;
export type FilterUpdateInput = Prisma.FilterUpdateInput;
export type FilterWhereInput = Prisma.FilterWhereInput;
export type FilterWhereUniqueInput = Prisma.FilterWhereUniqueInput;

// Define proper types for Filter with relations
export type FilterWithUser = Filter & {
	user: User;
};

export type FilterWithTeam = Filter & {
	team: Team | null;
};

export type FilterWithUserAndTeam = Filter & {
	user: User;
	team: Team | null;
};

export type FilterOpportunityWithOpportunity = FilterOpportunity & {
	opportunity: Opportunity;
};

export type FilterWithRelations = Filter & {
	user: User;
	team: Team | null;
	filterOpportunities: FilterOpportunityWithOpportunity[];
};

// Define types for filter criteria
interface FilterCriteria {
	keywords?: string[];
	naicsCodes?: string[];
	agencies?: string[];
}

interface SAMSearchParams {
	q?: string;
	naicsCode?: string;
	agency?: string;
}

// Utility functions for Filter operations
export const isActive = (filter: Filter): boolean => {
	return filter.isActive;
};

export const shouldPoll = (filter: Filter): boolean => {
	if (!filter.isActive || !filter.nextPollAt) {return false;}
	return new Date() >= filter.nextPollAt;
};

export const calculateNextPollTime = (intervalMinutes: number): Date => {
	const nextPoll = new Date();
	nextPoll.setMinutes(nextPoll.getMinutes() + intervalMinutes);
	return nextPoll;
};

export const getFilterHash = (filter: Filter): string => {
	// Create a unique hash for this filter to enable deduplication
	const criteria = filter.criteria as FilterCriteria;
	return Buffer.from(JSON.stringify(criteria)).toString("base64");
};

export const toSAMSearchParams = (filter: Filter): SAMSearchParams => {
	const criteria = filter.criteria as FilterCriteria;
	const params: SAMSearchParams = {};

	if (criteria.keywords && criteria.keywords.length > 0) {
		params.q = criteria.keywords.join(" OR ");
	}

	if (criteria.naicsCodes && criteria.naicsCodes.length > 0) {
		params.naicsCode = criteria.naicsCodes.join(",");
	}

	if (criteria.agencies && criteria.agencies.length > 0) {
		params.agency = criteria.agencies.join(",");
	}

	return params;
};

export const toJSON = (filter: Filter): Partial<Filter> => {
	return {
		id: filter.id,
		name: filter.name,
		description: filter.description,
		naturalLanguageDescription: filter.naturalLanguageDescription,
		criteria: filter.criteria,
		isActive: filter.isActive,
		isSaved: filter.isSaved,
		userId: filter.userId,
		teamId: filter.teamId,
		pollingInterval: filter.pollingInterval,
		lastPolledAt: filter.lastPolledAt,
		nextPollAt: filter.nextPollAt,
		searchCount: filter.searchCount,
		opportunityCount: filter.opportunityCount,
		lastSearchAt: filter.lastSearchAt,
		notifyOnNewOpportunities: filter.notifyOnNewOpportunities,
		notifyOnDeadlineReminder: filter.notifyOnDeadlineReminder,
		deadlineReminderDays: filter.deadlineReminderDays,
		createdAt: filter.createdAt,
		updatedAt: filter.updatedAt,
	};
};

// Prisma Filter model operations
export default {
	async findByPk(id: string): Promise<FilterWithRelations | null> {
		return prisma.filter.findUnique({
			where: { id },
			include: {
				user: true,
				team: true,
				filterOpportunities: {
					include: {
						opportunity: true,
					},
				},
			},
		});
	},

	async findAll(options: Prisma.FilterFindManyArgs = {}): Promise<FilterWithRelations[]> {
		return prisma.filter.findMany({
			...options,
			include: {
				user: true,
				team: true,
				filterOpportunities: {
					include: {
						opportunity: true,
					},
				},
			},
		});
	},

	async create(data: FilterCreateInput): Promise<FilterWithUserAndTeam> {
		return prisma.filter.create({
			data: {
				...data,
				nextPollAt: calculateNextPollTime(data.pollingInterval ?? 60),
			},
			include: {
				user: true,
				team: true,
			},
		});
	},

	async update(
		data: FilterUpdateInput,
		options: { where: FilterWhereUniqueInput },
	): Promise<FilterWithUserAndTeam> {
		// Update nextPollAt if pollingInterval changed
		if (data.pollingInterval) {
			data.nextPollAt = calculateNextPollTime(data.pollingInterval as number);
		}

		return prisma.filter.update({
			where: options.where,
			data,
			include: {
				user: true,
				team: true,
			},
		});
	},

	async destroy(options: { where: FilterWhereUniqueInput }): Promise<Filter> {
		return prisma.filter.delete({ where: options.where });
	},

	async findOne(options: { where: FilterWhereInput }): Promise<FilterWithRelations | null> {
		return prisma.filter.findFirst({
			...options,
			include: {
				user: true,
				team: true,
				filterOpportunities: {
					include: {
						opportunity: true,
					},
				},
			},
		});
	},

	async findByUser(userId: string): Promise<FilterWithUserAndTeam[]> {
		return prisma.filter.findMany({
			where: { userId },
			include: {
				user: true,
				team: true,
			},
		});
	},

	async count(options: { where?: FilterWhereInput } = {}): Promise<number> {
		return prisma.filter.count(options);
	},
};
