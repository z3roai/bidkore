import prisma from "@/config/prisma";
import type { Proposal, ProposalStatus } from "@prisma/client";

export interface ProposalWithRelations extends Proposal {
	user?: {
		id: string;
		email: string;
		firstName: string;
		lastName: string;
	} | null;
	opportunity?: {
		id: string;
		title: string;
		noticeId: string;
		fullParentPathName: string | null;
		responseDeadLine: Date | null;
		description?: string | null;
		naicsCode?: string | null;
		type?: string | null;
		typeOfSetAsideDescription?: string | null;
	} | null;
}

class ProposalModel {
	async findByUser(
		userId: string,
		options?: {
			status?: ProposalStatus;
			limit?: number;
			offset?: number;
		}
	): Promise<ProposalWithRelations[]> {
		const where: any = { userId };

		if (options?.status) {
			where.status = options.status;
		}

		return await prisma.proposal.findMany({
			where,
			include: {
				opportunity: {
					select: {
						id: true,
						title: true,
						noticeId: true,
						fullParentPathName: true,
						responseDeadLine: true,
					},
				},
			},
			orderBy: { createdAt: "desc" },
			take: options?.limit,
			skip: options?.offset,
		});
	}

	async findById(
		id: string,
		userId: string
	): Promise<ProposalWithRelations | null> {
		return await prisma.proposal.findFirst({
			where: { id, userId },
			include: {
				opportunity: {
					select: {
						id: true,
						title: true,
						noticeId: true,
						fullParentPathName: true,
						responseDeadLine: true,
						description: true,
						naicsCode: true,
						type: true,
						typeOfSetAsideDescription: true,
					},
				},
				user: {
					select: {
						id: true,
						email: true,
						firstName: true,
						lastName: true,
					},
				},
			},
		});
	}

	async create(data: {
		userId: string;
		opportunityId?: string;
		title: string;
		sections: any;
		complianceScore?: number;
		aiRecommendations?: any;
		status?: ProposalStatus;
	}): Promise<Proposal> {
		return await prisma.proposal.create({
			data: {
				userId: data.userId,
				opportunityId: data.opportunityId,
				title: data.title,
				sections: data.sections,
				complianceScore: data.complianceScore,
				aiRecommendations: data.aiRecommendations,
				status: data.status || "DRAFT",
			},
		});
	}

	async update(
		id: string,
		userId: string,
		data: {
			title?: string;
			sections?: any;
			status?: ProposalStatus;
			complianceScore?: number;
			aiRecommendations?: any;
		}
	): Promise<Proposal> {
		const updateData: any = {};

		if (data.title !== undefined) updateData.title = data.title;
		if (data.sections !== undefined) updateData.sections = data.sections;
		if (data.status !== undefined) updateData.status = data.status;
		if (data.complianceScore !== undefined)
			updateData.complianceScore = data.complianceScore;
		if (data.aiRecommendations !== undefined)
			updateData.aiRecommendations = data.aiRecommendations;

		return await prisma.proposal.update({
			where: { id, userId },
			data: updateData,
		});
	}

	async delete(id: string, userId: string): Promise<void> {
		await prisma.proposal.delete({
			where: { id, userId },
		});
	}

	async updateStatus(
		id: string,
		userId: string,
		status: ProposalStatus
	): Promise<Proposal> {
		const updateData: any = { status };

		if (status === "SUBMITTED") {
			updateData.submittedAt = new Date();
		}

		return await prisma.proposal.update({
			where: { id, userId },
			data: updateData,
		});
	}

	async countByUser(
		userId: string,
		status?: ProposalStatus
	): Promise<number> {
		const where: any = { userId };
		if (status) where.status = status;

		return await prisma.proposal.count({ where });
	}

	async findByOpportunity(
		opportunityId: string,
		userId: string
	): Promise<Proposal[]> {
		return await prisma.proposal.findMany({
			where: { opportunityId, userId },
			orderBy: { createdAt: "desc" },
		});
	}

	async exists(id: string, userId: string): Promise<boolean> {
		const count = await prisma.proposal.count({
			where: { id, userId },
		});
		return count > 0;
	}
}

export default new ProposalModel();
