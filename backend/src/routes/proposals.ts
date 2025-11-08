import { Router } from "express";
import { authenticateToken } from "@/middleware/auth";
import { validateRequest } from "@/middleware/validation";
import proposalGenerationService from "@/services/proposalGenerationService";
import ProposalModel from "@/models/Proposal";
import {
	generateProposalSchema,
	updateProposalSchema,
	generateSectionSchema,
	improveTextSchema,
	extractRequirementsSchema,
	proposalIdSchema,
} from "@/schemas/proposalSchemas";
import loggingService from "@/services/loggingService";

const router = Router();

router.post(
	"/generate",
	authenticateToken,
	validateRequest(generateProposalSchema),
	async (req, res, next) => {
		try {
			const { opportunityId } = req.body;
			const userId = req.user!.id;

			const proposal = await proposalGenerationService.generateProposal({
				opportunityId,
				userId,
			});

			res.status(201).json({
				success: true,
				data: proposal,
				message: "Proposal generated successfully",
			});
		} catch (error) {
			loggingService.error("Generate proposal error", { error });
			next(error);
		}
	}
);

router.get("/", authenticateToken, async (req, res, next) => {
	try {
		const userId = req.user!.id;
		const { status, limit = "50", offset = "0" } = req.query;

		const proposals = await ProposalModel.findByUser(userId, {
			status: status as any,
			limit: parseInt(limit as string),
			offset: parseInt(offset as string),
		});

		const total = await ProposalModel.countByUser(userId, status as any);

		res.json({
			success: true,
			data: proposals,
			pagination: {
				total,
				limit: parseInt(limit as string),
				offset: parseInt(offset as string),
			},
		});
	} catch (error) {
		loggingService.error("Get proposals error", { error });
		next(error);
	}
});

router.get("/:id", authenticateToken, async (req, res, next) => {
	try {
		const { id } = req.params;
		const userId = req.user!.id;

		const proposal = await ProposalModel.findById(id, userId);

		if (!proposal) {
			return res.status(404).json({
				success: false,
				message: "Proposal not found",
			});
		}

		res.json({
			success: true,
			data: proposal,
		});
	} catch (error) {
		loggingService.error("Get proposal error", { error });
		next(error);
	}
});

router.put(
	"/:id",
	authenticateToken,
	validateRequest(updateProposalSchema),
	async (req, res, next) => {
		try {
			const { id } = req.params;
			const userId = req.user!.id;
			const updateData = req.body;

			const exists = await ProposalModel.exists(id, userId);
			if (!exists) {
				return res.status(404).json({
					success: false,
					message: "Proposal not found",
				});
			}

			const proposal = await ProposalModel.update(id, userId, updateData);

			res.json({
				success: true,
				data: proposal,
				message: "Proposal updated successfully",
			});
		} catch (error) {
			loggingService.error("Update proposal error", { error });
			next(error);
		}
	}
);

router.delete("/:id", authenticateToken, async (req, res, next) => {
	try {
		const { id } = req.params;
		const userId = req.user!.id;

		const exists = await ProposalModel.exists(id, userId);
		if (!exists) {
			return res.status(404).json({
				success: false,
				message: "Proposal not found",
			});
		}

		await ProposalModel.delete(id, userId);

		res.json({
			success: true,
			message: "Proposal deleted successfully",
		});
	} catch (error) {
		loggingService.error("Delete proposal error", { error });
		next(error);
	}
});

router.post(
	"/:id/sections",
	authenticateToken,
	validateRequest(generateSectionSchema),
	async (req, res, next) => {
		try {
			const { id } = req.params;
			const userId = req.user!.id;
			const { sectionName, opportunityId, existingContent } = req.body;

			const exists = await ProposalModel.exists(id, userId);
			if (!exists) {
				return res.status(404).json({
					success: false,
					message: "Proposal not found",
				});
			}

			const sectionContent = await proposalGenerationService.generateSection(
				sectionName,
				{
					opportunityId,
					existingContent,
					userId,
				}
			);

			res.json({
				success: true,
				data: {
					sectionName,
					content: sectionContent,
				},
				message: "Section generated successfully",
			});
		} catch (error) {
			loggingService.error("Generate section error", { error });
			next(error);
		}
	}
);

router.post(
	"/:id/improve",
	authenticateToken,
	validateRequest(improveTextSchema),
	async (req, res, next) => {
		try {
			const { id } = req.params;
			const userId = req.user!.id;
			const { text, opportunityId, sectionType } = req.body;

			const exists = await ProposalModel.exists(id, userId);
			if (!exists) {
				return res.status(404).json({
					success: false,
					message: "Proposal not found",
				});
			}

			const improvement = await proposalGenerationService.improveText(text, {
				opportunityId,
				sectionType,
			});

			res.json({
				success: true,
				data: improvement,
				message: "Text improved successfully",
			});
		} catch (error) {
			loggingService.error("Improve text error", { error });
			next(error);
		}
	}
);

router.post(
	"/:id/compliance",
	authenticateToken,
	async (req, res, next) => {
		try {
			const { id } = req.params;
			const userId = req.user!.id;

			const exists = await ProposalModel.exists(id, userId);
			if (!exists) {
				return res.status(404).json({
					success: false,
					message: "Proposal not found",
				});
			}

			const complianceResult =
				await proposalGenerationService.checkCompliance(id);

			res.json({
				success: true,
				data: complianceResult,
				message: "Compliance check completed",
			});
		} catch (error) {
			loggingService.error("Compliance check error", { error });
			next(error);
		}
	}
);

router.post("/:id/submit", authenticateToken, async (req, res, next) => {
	try {
		const { id } = req.params;
		const userId = req.user!.id;

		const exists = await ProposalModel.exists(id, userId);
		if (!exists) {
			return res.status(404).json({
				success: false,
				message: "Proposal not found",
			});
		}

		const proposal = await ProposalModel.updateStatus(id, userId, "SUBMITTED");

		res.json({
			success: true,
			data: proposal,
			message: "Proposal submitted successfully",
		});
	} catch (error) {
		loggingService.error("Submit proposal error", { error });
		next(error);
	}
});

router.get(
	"/extract-requirements/:opportunityId",
	authenticateToken,
	async (req, res, next) => {
		try {
			const { opportunityId } = req.params;

			const requirements =
				await proposalGenerationService.extractRequirements(opportunityId);

			res.json({
				success: true,
				data: requirements,
				message: "Requirements extracted successfully",
			});
		} catch (error) {
			loggingService.error("Extract requirements error", { error });
			next(error);
		}
	}
);

router.get("/:id/export", authenticateToken, async (req, res, next) => {
	try {
		const { id } = req.params;
		const userId = req.user!.id;
		const { format = "json" } = req.query;

		const proposal = await ProposalModel.findById(id, userId);

		if (!proposal) {
			return res.status(404).json({
				success: false,
				message: "Proposal not found",
			});
		}

		if (format === "json") {
			res.json({
				success: true,
				data: proposal,
			});
		} else {
			res.status(400).json({
				success: false,
				message: "Only JSON export is currently supported",
			});
		}
	} catch (error) {
		loggingService.error("Export proposal error", { error });
		next(error);
	}
});

export default router;
