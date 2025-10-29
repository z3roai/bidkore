import { type Response, Router } from "express";

import {
	createTeamMember,
	findTeamMemberByUserAndTeam,
	removeTeamMemberByUserAndTeam,
} from "../../models/TeamMember";

import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import { TeamRole } from "@/models";
import User from "@/models/User";
import { addMemberSchema } from "@/routes/teams/schemas";
import { isTeamAdmin } from "@/routes/teams/utils";
import loggingService from "@/services/loggingService";

const router = Router();

// Helper function to convert string role to TeamRole enum
const mapRoleToEnum = (role: string): TeamRole => {
	const roleMap: Record<string, TeamRole> = {
		owner: TeamRole.OWNER,
		admin: TeamRole.ADMIN,
		member: TeamRole.MEMBER,
	};
	return roleMap[role.toLowerCase()] ?? TeamRole.MEMBER;
};

// Add team member
router.post(
	"/:id/members",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const teamIdParam = req.params["id"];
			if (!teamIdParam) {
				res.status(400).json({ error: "Team ID is required" });
				return;
			}
			const teamId = parseInt(teamIdParam, 10);
			if (Number.isNaN(teamId)) {
				res.status(400).json({ error: "Invalid team ID" });
				return;
			}

			// Check if user is team admin
			if (!(await isTeamAdmin(req.user.id, teamId.toString()))) {
				res.status(403).json({ error: "Only team admins can add members" });
				return;
			}

			const result = addMemberSchema.safeParse(req.body);
			if (!result.success) {
				res.status(400).json({
					error: result.error.issues[0]?.message ?? "Validation error",
				});
				return;
			}

			const { userId, role = TeamRole.MEMBER } = result.data;

			// Map role to enum value
			const mappedRole = typeof role === "string" ? mapRoleToEnum(role) : role;

			// Check if user exists
			const user = await User.findByPk(userId.toString());
			if (!user) {
				res.status(404).json({ error: "User not found" });
				return;
			}

			// Check if user is already a member
			const existingMember = await findTeamMemberByUserAndTeam(
				userId.toString(),
				teamId.toString()
			);

			if (existingMember) {
				res.status(409).json({ error: "User is already a team member" });
				return;
			}

			const teamMember = await createTeamMember({
				teamId: teamId.toString(),
				userId: userId.toString(),
				role: mappedRole,
			});

			loggingService.logUserAction(
				"add_team_member",
				req.user.id,
				req.user.role,
				{ teamId: teamId.toString(), newMemberId: userId, role }
			);

			res.status(201).json({
				message: "Team member added successfully",
				member: {
					id: teamMember.id,
					teamId: teamMember.teamId,
					userId: teamMember.userId,
					role: teamMember.role,
					joinedAt: teamMember.joinedAt,
					user: {
						id: user.id,
						firstName: user.firstName,
						lastName: user.lastName,
						email: user.email,
					},
				},
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"add_team_member",
				req.user?.id ?? "0",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to add team member" });
		}
	}
);

// Remove team member
router.delete(
	"/:id/members/:userId",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const teamIdParam = req.params["id"];
			const userIdParam = req.params["userId"];

			if (!teamIdParam || !userIdParam) {
				res.status(400).json({ error: "Team ID and user ID are required" });
				return;
			}

			const teamId = parseInt(teamIdParam, 10);
			const userId = parseInt(userIdParam, 10);

			if (Number.isNaN(teamId) || Number.isNaN(userId)) {
				res.status(400).json({ error: "Invalid team ID or user ID" });
				return;
			}

			// Check if user is team admin or removing themselves
			const isAdmin = await isTeamAdmin(req.user.id, teamId.toString());
			const isSelf = req.user.id === userId.toString();

			if (!isAdmin && !isSelf) {
				res.status(403).json({ error: "Only team admins can remove members" });
				return;
			}

			const teamMember = await findTeamMemberByUserAndTeam(
				userId.toString(),
				teamId.toString()
			);

			if (!teamMember) {
				res.status(404).json({ error: "Team member not found" });
				return;
			}

			await removeTeamMemberByUserAndTeam(userId.toString(), teamId.toString());

			loggingService.logUserAction(
				"remove_team_member",
				req.user.id,
				req.user.role,
				{ teamId: teamId.toString(), removedUserId: userId.toString() }
			);

			res.json({
				message: "Team member removed successfully",
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"remove_team_member",
				req.user?.id ?? "0",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to remove team member" });
		}
	}
);

export default router;
