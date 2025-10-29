import { type Response, Router } from "express";

import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import { requireEnterprisePlan } from "@/middleware/requireEnterprisePlan";
import { Team, TeamRole } from "@/models";
import { createTeamMember } from "@/models/TeamMember";
import { isTeamAdmin, isTeamMember } from "@/routes/teams/utils";
import { createTeamSchema, updateTeamSchema } from "@/schemas/team";
import loggingService from "@/services/loggingService";

// Type definitions
interface TeamWithMembers {
	id: string;
	name: string;
	description: string | null;
	createdBy: string;
	createdAt: Date;
	TeamMembers?: {
		role: string;
	}[];
	filters?: unknown[];
}

const router = Router();

// Create team - requires Enterprise plan
router.post(
	"/",
	authenticateToken,
	requireEnterprisePlan,
	async(req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const result = createTeamSchema.safeParse(req.body);
			if (!result.success) {
				res.status(400).json({ error: result.error.issues[0]?.message ?? "Validation failed" });
				return;
			}

			const { name, description, purpose } = result.data;

			// Check if team name already exists for this user
			const existingTeam = await Team.findOne({
				where: { name, createdBy: req.user.id },
			});

			if (existingTeam) {
				res.status(409).json({ error: "Team with this name already exists" });
				return;
			}

			const team = await Team.create({
				name,
				description: description ?? null,
				purpose,
				creator: { connect: { id: req.user.id } },
			});

			// Add creator as owner
			await createTeamMember({
				teamId: team.id,
				userId: req.user.id,
				role: TeamRole.OWNER,
			});

			loggingService.logUserAction("create_team", req.user.id, req.user.role, {
				teamId: team.id,
				teamName: name,
			});

			res.status(201).json({
				message: "Team created successfully",
				team: {
					id: team.id,
					name: team.name,
					description: team.description,
					purpose: team.purpose,
					createdBy: team.createdBy,
					createdAt: team.createdAt,
				},
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"create_team",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error)),
			);
			res.status(500).json({ error: "Failed to create team" });
		}
	},
);

// Get user's teams
router.get(
	"/",
	authenticateToken,
	async(req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const teams = await Team.findUserTeams(req.user.id);

			res.json({
				teams: teams.map((team: TeamWithMembers) => ({
					id: team.id,
					name: team.name,
					description: team.description,
					createdBy: team.createdBy,
					role: team.TeamMembers?.[0]?.role,
					filterCount: team.filters?.length ?? 0,
					createdAt: team.createdAt,
				})),
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"get_teams",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error)),
			);
			res.status(500).json({ error: "Failed to get teams" });
		}
	},
);

// Get team details
router.get(
	"/:id",
	authenticateToken,
	async(req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const teamId = req.params['id'];
			if (!teamId || typeof teamId !== "string") {
				res.status(400).json({ error: "Invalid team ID" });
				return;
			}

			// Check if user is team member
			if (!(await isTeamMember(req.user.id, teamId))) {
				res.status(403).json({ error: "Access denied" });
				return;
			}

			const teamResult = await Team.findByPkWithDetails(teamId);

			if (!teamResult) {
				res.status(404).json({ error: "Team not found" });
				return;
			}

			// Type guard to ensure we have the expected structure
			if (!("teamMembers" in teamResult) || !("filters" in teamResult)) {
				res.status(500).json({ error: "Invalid team data structure" });
				return;
			}

			res.json({
				team: {
					id: teamResult.id,
					name: teamResult.name,
					description: teamResult.description,
					createdBy: teamResult.createdBy,
					members: teamResult.teamMembers.map((member) => ({
						id: member.id,
						userId: member.userId,
						role: member.role,
						joinedAt: member.joinedAt,
						user: member.user,
					})),
					filters: teamResult.filters,
					createdAt: teamResult.createdAt,
				},
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"get_team_details",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error)),
			);
			res.status(500).json({ error: "Failed to get team details" });
		}
	},
);

// Update team
router.put(
	"/:id",
	authenticateToken,
	async(req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const teamId = req.params['id'];
			if (!teamId || typeof teamId !== "string") {
				res.status(400).json({ error: "Invalid team ID" });
				return;
			}

			// Check if user is team admin
			if (!(await isTeamAdmin(req.user.id, teamId))) {
				res
					.status(403)
					.json({ error: "Only team admins can update team details" });
				return;
			}

			const result = updateTeamSchema.safeParse(req.body);
			if (!result.success) {
				res.status(400).json({ error: result.error.issues[0]?.message ?? "Validation failed" });
				return;
			}

			const team = await Team.findByPk(teamId);
			if (!team) {
				res.status(404).json({ error: "Team not found" });
				return;
			}

			const updateData: Record<string, unknown> = {};
			if (result.data.name !== undefined) {
				updateData['name'] = result.data.name;
			}
			if (result.data.description !== undefined) {
				updateData['description'] = result.data.description;
			}
			await Team.update(updateData, { where: { id: teamId } });

			loggingService.logUserAction("update_team", req.user.id, req.user.role, {
				teamId,
				updates: result.data,
			});

			res.json({
				message: "Team updated successfully",
				team: {
					id: team.id,
					name: team.name,
					description: team.description,
					createdBy: team.createdBy,
					updatedAt: team.updatedAt,
				},
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"update_team",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error)),
			);
			res.status(500).json({ error: "Failed to update team" });
		}
	},
);

// Delete team
router.delete(
	"/:id",
	authenticateToken,
	async(req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const teamId = req.params['id'];
			if (!teamId || typeof teamId !== "string") {
				res.status(400).json({ error: "Invalid team ID" });
				return;
			}

			// Check if user is team admin
			if (!(await isTeamAdmin(req.user.id, teamId))) {
				res.status(403).json({ error: "Only team admins can delete teams" });
				return;
			}

			const team = await Team.findByPk(teamId);
			if (!team) {
				res.status(404).json({ error: "Team not found" });
				return;
			}

			// Soft delete by setting isActive to false
			await Team.update({ isActive: false }, { where: { id: teamId } });

			loggingService.logUserAction("delete_team", req.user.id, req.user.role, {
				teamId,
			});

			res.json({
				message: "Team deleted successfully",
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"delete_team",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error)),
			);
			res.status(500).json({ error: "Failed to delete team" });
		}
	},
);

export default router;
