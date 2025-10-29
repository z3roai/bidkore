import { type Response, Router } from "express";

import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import { requireEnterprisePlan } from "@/middleware/requireEnterprisePlan";
import { InvitationStatus, Team } from "@/models";
import { teamWizardSchema } from "@/routes/teams/schemas";
import loggingService from "@/services/loggingService";
import teamWizardService, {
	type TeamWizardData,
} from "@/services/teamWizardService";

const router = Router();

// Get team templates
router.get(
	"/wizard/templates",
	authenticateToken,
	(_req: AuthRequest, res: Response): void => {
		try {
			const templates = teamWizardService.getTeamTemplates();
			res.json({ templates });
		} catch (error: unknown) {
			loggingService.error("Error getting team templates:", error);
			res.status(500).json({ error: "Failed to get team templates" });
		}
	}
);

// Get role suggestions
router.post(
	"/wizard/suggestions",
	authenticateToken,
	(req: AuthRequest, res: Response): void => {
		try {
			const { purpose, memberEmails, teamTemplate } = req.body as {
				purpose: string;
				memberEmails: string[];
				teamTemplate?: string;
			};

			if (!purpose || !Array.isArray(memberEmails)) {
				res
					.status(400)
					.json({ error: "Purpose and memberEmails array are required" });
				return;
			}

			if (memberEmails.length === 0) {
				res.json({ suggestions: [] });
				return;
			}

			const suggestions = teamWizardService.getRoleSuggestions(
				purpose,
				memberEmails,
				teamTemplate
			);

			res.json({ suggestions });
		} catch (error: unknown) {
			loggingService.error("Error getting role suggestions:", error);
			res.status(500).json({ error: "Failed to get role suggestions" });
		}
	}
);

// Validate wizard data
router.post(
	"/wizard/validate",
	authenticateToken,
	(req: AuthRequest, res: Response): void => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not authenticated" });
				return;
			}

			const result = teamWizardSchema.safeParse(req.body);
			if (!result.success) {
				res.status(400).json({
					error: result.error.issues[0]?.message ?? "Validation failed",
				});
				return;
			}

			const validation = teamWizardService.validateWizardData(
				result.data as TeamWizardData
			);

			res.json({
				isValid: validation.isValid,
				errors: validation.errors,
			});
		} catch (error: unknown) {
			loggingService.error("Error validating wizard data:", error);
			res.status(500).json({ error: "Failed to validate wizard data" });
		}
	}
);

// Create team with wizard
router.post(
	"/wizard/create",
	authenticateToken,
	requireEnterprisePlan,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const result = teamWizardSchema.safeParse(req.body);
			if (!result.success) {
				res.status(400).json({
					error: result.error.issues[0]?.message ?? "Validation failed",
				});
				return;
			}

			// Additional validation
			const validation = teamWizardService.validateWizardData(
				result.data as TeamWizardData
			);
			if (!validation.isValid) {
				res.status(400).json({
					error: "Validation failed",
					details: validation.errors,
				});
				return;
			}

			// Check if team name already exists for this user
			const existingTeam = await Team.findOne({
				where: { name: result.data.name, createdBy: req.user.id },
			});

			if (existingTeam) {
				res.status(409).json({ error: "Team with this name already exists" });
				return;
			}

			// Create team with wizard
			const wizardResult = await teamWizardService.createTeamWithWizard(
				result.data as TeamWizardData,
				req.user.id
			);

			// Generate team URL
			const teamUrl = teamWizardService.generateTeamUrl(
				wizardResult.team.id,
				wizardResult.team.name
			);

			loggingService.logUserAction(
				"create_team_wizard",
				req.user.id,
				req.user.role,
				{
					teamId: wizardResult.team.id,
					teamName: wizardResult.team.name,
					invitationCount: wizardResult.invitations.length,
					purpose: result.data.purpose,
				}
			);

			res.status(201).json({
				message: "Team created successfully with wizard",
				team: {
					id: wizardResult.team.id,
					name: wizardResult.team.name,
					description: wizardResult.team.description,
					createdBy: wizardResult.team.createdBy,
					url: teamUrl,
					createdAt: wizardResult.team.createdAt,
				},
				members: wizardResult.members.map(member => ({
					id: member.id,
					userId: member.userId,
					role: member.role,
					joinedAt: member.joinedAt,
				})),
				invitations: wizardResult.invitations.map(inv => ({
					id: inv.id ?? 0,
					email: inv.email ?? "",
					role: inv.role ?? "MEMBER",
					status: inv.status ?? "PENDING",
					expiresAt: inv.expiresAt ?? new Date(),
				})),
				stats: {
					memberCount: wizardResult.members.length,
					invitationCount: wizardResult.invitations.length,
					pendingInvitations: wizardResult.invitations.filter(
						inv => (inv.status ?? "PENDING") === InvitationStatus.PENDING
					).length,
				},
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"create_team_wizard",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to create team with wizard" });
		}
	}
);

// Preview team creation (without actually creating)
router.post(
	"/wizard/preview",
	authenticateToken,
	requireEnterprisePlan,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not authenticated" });
				return;
			}

			const result = teamWizardSchema.safeParse(req.body);
			if (!result.success) {
				res.status(400).json({
					error: result.error.issues[0]?.message ?? "Validation failed",
				});
				return;
			}

			// Validate data
			const validation = teamWizardService.validateWizardData(
				result.data as TeamWizardData
			);
			if (!validation.isValid) {
				res.status(400).json({
					error: "Validation failed",
					details: validation.errors,
				});
				return;
			}

			// Check if team name already exists for this user
			const existingTeam = await Team.findOne({
				where: { name: result.data.name, createdBy: req.user.id },
			});

			if (existingTeam) {
				res.status(409).json({ error: "Team with this name already exists" });
				return;
			}

			// Generate team URL
			const teamUrl = teamWizardService.generateTeamUrl(
				"preview",
				result.data.name
			); // Use "preview" as placeholder ID

			res.json({
				preview: {
					team: {
						name: result.data.name,
						description: result.data.description,
						purpose: result.data.purpose,
						url: teamUrl,
					},
					invitations: result.data.invitations ?? [],
					stats: {
						invitationCount: result.data.invitations?.length ?? 0,
						roles:
							result.data.invitations?.reduce(
								(acc: Record<string, number>, inv) => {
									acc[inv.role] = (acc[inv.role] ?? 0) + 1;
									return acc;
								},
								{}
							) ?? {},
					},
				},
				validation: {
					isValid: true,
					errors: [],
				},
			});
		} catch (error: unknown) {
			loggingService.error("Error previewing team creation:", error);
			res.status(500).json({ error: "Failed to preview team creation" });
		}
	}
);

export default router;
