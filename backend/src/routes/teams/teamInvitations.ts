import { TeamRole } from "@/models/prisma";
import { type Request, type Response, Router } from "express";

import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import { bulkInviteSchema, inviteMembersSchema } from "@/routes/teams/schemas";
import { isTeamAdmin, isTeamMember } from "@/routes/teams/utils";
import loggingService from "@/services/loggingService";
import teamInvitationService from "@/services/teamInvitationService";

const router = Router();

// Helper function to convert string role to TeamRole enum
const mapRoleToEnum = (role: string): TeamRole => {
  const roleMap: Record<string, TeamRole> = {
    owner: TeamRole.OWNER,
    admin: TeamRole.ADMIN,
    editor: TeamRole.MEMBER,
    viewer: TeamRole.MEMBER,
    member: TeamRole.MEMBER,
  };
  return roleMap[role] ?? TeamRole.MEMBER;
};

// Invite team members
router.post(
  "/:id/invite",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const teamId = req.params["id"];
      if (!teamId) {
        res.status(400).json({ error: "Invalid team ID" });
        return;
      }

      // Check if user is team admin
      if (!(await isTeamAdmin(req.user.id, teamId))) {
        res.status(403).json({ error: "Only team admins can invite members" });
        return;
      }

      const result = inviteMembersSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: result.error.issues[0]?.message ?? "Validation error",
        });
        return;
      }
      const value = result.data;

      const { invitations } = value;

      // Map roles to enum values
      const mappedInvitations = invitations.map((inv) => {
        const invitation: {
          email: string;
          role: TeamRole;
          customMessage?: string;
        } = {
          email: inv.email,
          role: mapRoleToEnum(inv.role),
        };
        if (inv.customMessage) {
          invitation.customMessage = inv.customMessage;
        }
        return invitation;
      });

      // Create invitations
      const createdInvitations =
        await teamInvitationService.createBulkInvitations(
          teamId,
          mappedInvitations,
          req.user.id
        );

      // Send invitation emails
      for (const invitation of createdInvitations) {
        try {
          await teamInvitationService.sendInvitationEmail(invitation);
        } catch (emailError: unknown) {
          loggingService.warn("Failed to send invitation email:", {
            invitationId: invitation.id,
            email: invitation.email,
            error:
              emailError instanceof Error
                ? emailError.message
                : String(emailError),
          });
        }
      }

      loggingService.logUserAction(
        "invite_team_members",
        req.user.id,
        req.user.role,
        {
          teamId,
          invitationCount: createdInvitations.length,
        }
      );

      res.status(201).json({
        message: "Invitations sent successfully",
        invitations: createdInvitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          status: inv.status,
          expiresAt: inv.expiresAt,
        })),
      });
    } catch (error: unknown) {
      loggingService.logUserError(
        "invite_team_members",
        req.user?.id ?? "",
        req.user?.role ?? "unknown",
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: "Failed to send invitations" });
    }
  }
);

// Bulk invite with default role
router.post(
  "/:id/invite/bulk",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const teamId = req.params["id"];
      if (!teamId) {
        res.status(400).json({ error: "Invalid team ID" });
        return;
      }

      // Check if user is team admin
      if (!(await isTeamAdmin(req.user.id, teamId))) {
        res.status(403).json({ error: "Only team admins can invite members" });
        return;
      }

      const result = bulkInviteSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: result.error.issues[0]?.message ?? "Validation error",
        });
        return;
      }
      const value = result.data;

      const { emails, defaultRole, customMessage } = value;

      // Convert to invitation format with role mapping
      const invitations = emails.map((email: string) => {
        const invitation: {
          email: string;
          role: TeamRole;
          customMessage?: string;
        } = {
          email,
          role: mapRoleToEnum(defaultRole),
        };
        if (customMessage) {
          invitation.customMessage = customMessage;
        }
        return invitation;
      });

      // Create invitations
      const createdInvitations =
        await teamInvitationService.createBulkInvitations(
          teamId,
          invitations,
          req.user.id
        );

      // Send invitation emails
      for (const invitation of createdInvitations) {
        try {
          await teamInvitationService.sendInvitationEmail(invitation);
        } catch (emailError: unknown) {
          loggingService.warn("Failed to send invitation email:", {
            invitationId: invitation.id,
            email: invitation.email,
            error:
              emailError instanceof Error
                ? emailError.message
                : String(emailError),
          });
        }
      }

      loggingService.logUserAction(
        "bulk_invite_team_members",
        req.user.id,
        req.user.role,
        {
          teamId,
          emailCount: emails.length,
          defaultRole,
        }
      );

      res.status(201).json({
        message: "Bulk invitations sent successfully",
        invitations: createdInvitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          status: inv.status,
          expiresAt: inv.expiresAt,
        })),
      });
    } catch (error: unknown) {
      loggingService.logUserError(
        "bulk_invite_team_members",
        req.user?.id ?? "",
        req.user?.role ?? "unknown",
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: "Failed to send bulk invitations" });
    }
  }
);

// Get team invitations
router.get(
  "/:id/invitations",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const teamId = req.params["id"];
      if (!teamId) {
        res.status(400).json({ error: "Invalid team ID" });
        return;
      }

      // Check if user is team member
      if (!(await isTeamMember(req.user.id, teamId))) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const invitations = await teamInvitationService.getTeamInvitations(
        teamId
      );

      res.json({
        invitations: invitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          status: inv.status,
          expiresAt: inv.expiresAt,
          acceptedAt: inv.acceptedAt,
          customMessage: inv.customMessage,
          invitedBy: inv.inviter
            ? {
                id: inv.inviter.id,
                firstName: inv.inviter.firstName,
                lastName: inv.inviter.lastName,
                email: inv.inviter.email,
              }
            : null,
          createdAt: inv.createdAt,
        })),
      });
    } catch (error: unknown) {
      loggingService.logUserError(
        "get_team_invitations",
        req.user?.id ?? "",
        req.user?.role ?? "unknown",
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: "Failed to get team invitations" });
    }
  }
);

// Cancel invitation
router.delete(
  "/:id/invitations/:invitationId",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const teamId = req.params["id"];
      const invitationId = parseInt(req.params["invitationId"] ?? "", 10);

      if (!teamId || Number.isNaN(invitationId)) {
        res.status(400).json({ error: "Invalid team ID or invitation ID" });
        return;
      }

      // Check if user is team admin
      if (!(await isTeamAdmin(req.user.id, teamId))) {
        res
          .status(403)
          .json({ error: "Only team admins can cancel invitations" });
        return;
      }

      await teamInvitationService.cancelInvitation(invitationId, req.user.id);

      loggingService.logUserAction(
        "cancel_team_invitation",
        req.user.id,
        req.user.role,
        {
          teamId,
          invitationId,
        }
      );

      res.json({ message: "Invitation cancelled successfully" });
    } catch (error: unknown) {
      loggingService.logUserError(
        "cancel_team_invitation",
        req.user?.id ?? "",
        req.user?.role ?? "unknown",
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: "Failed to cancel invitation" });
    }
  }
);

// Resend invitation
router.post(
  "/:id/invitations/:invitationId/resend",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const teamId = req.params["id"];
      const invitationId = parseInt(req.params["invitationId"] ?? "", 10);

      if (!teamId || Number.isNaN(invitationId)) {
        res.status(400).json({ error: "Invalid team ID or invitation ID" });
        return;
      }

      // Check if user is team admin
      if (!(await isTeamAdmin(req.user.id, teamId))) {
        res
          .status(403)
          .json({ error: "Only team admins can resend invitations" });
        return;
      }

      await teamInvitationService.resendInvitation(invitationId);

      loggingService.logUserAction(
        "resend_team_invitation",
        req.user.id,
        req.user.role,
        {
          teamId,
          invitationId,
        }
      );

      res.json({ message: "Invitation resent successfully" });
    } catch (error: unknown) {
      loggingService.logUserError(
        "resend_team_invitation",
        req.user?.id ?? "",
        req.user?.role ?? "unknown",
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: "Failed to resend invitation" });
    }
  }
);

// Accept invitation (public endpoint - no auth required)
router.post(
  "/accept-invitation",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, userId } = req.body as { token: string; userId: string };

      if (!token || !userId) {
        res.status(400).json({ error: "Token and userId are required" });
        return;
      }

      const teamMember = await teamInvitationService.acceptInvitation(
        token,
        userId
      );

      res.status(200).json({
        message: "Invitation accepted successfully",
        teamMember: teamMember.invitation
          ? {
              id: teamMember.invitation.id,
              teamId: teamMember.invitation.teamId,
              userId: teamMember.invitation.invitedBy,
              role: teamMember.invitation.role,
              joinedAt: teamMember.invitation.acceptedAt,
            }
          : null,
      });
    } catch (error: unknown) {
      loggingService.error("Accept invitation error:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

export default router;
