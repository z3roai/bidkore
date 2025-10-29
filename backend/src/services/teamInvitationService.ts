import crypto from "node:crypto";

import { TeamRole } from "@/models/prisma";

import {
  createTeamInvitation,
  findExpiredTeamInvitations,
  findTeamInvitationById,
  findTeamInvitationsByEmail,
  findTeamInvitationsByTeamId,
  InvitationStatus,
  isTeamInvitationExpired,
  type TeamInvitation,
  type TeamInvitationWithRelations,
  updateTeamInvitationStatus,
} from "../models/TeamInvitation";
import {
  createTeamMember,
  findTeamMemberByUserAndTeam,
} from "../models/TeamMember";

import Team from "@/models/Team";
import User from "@/models/User";
import emailService from "@/services/emailService";
import loggingService from "@/services/loggingService";

export interface InvitationData {
  email: string;
  role: TeamRole;
  customMessage?: string;
}

export interface BulkInvitationData {
  emails: string[];
  defaultRole: TeamRole;
  customMessage?: string;
}

interface TeamInvitationCreateData {
  teamId: string;
  email: string;
  invitedBy: string;
  expiresAt: Date;
  status: InvitationStatus;
  token: string;
  role: TeamRole;
  customMessage?: string;
}

interface TeamInvitationEmailData {
  to: string;
  teamName: string;
  inviterName: string;
  invitationUrl: string;
  role: TeamRole;
  expiresAt: Date;
  customMessage?: string;
}

class TeamInvitationService {
  /**
   * Create a team invitation
   */
  async createInvitation(
    teamId: string,
    email: string,
    role: TeamRole,
    invitedBy: string,
    customMessage?: string
  ): Promise<TeamInvitation> {
    try {
      // Check if user exists and is already a member
      const user = await User.findOne({ where: { email } });
      if (user) {
        const existingMember = await findTeamMemberByUserAndTeam(
          user.id.toString(),
          teamId
        );

        if (existingMember) {
          throw new Error("User is already a team member");
        }
      }

      // Check if there's already a pending invitation
      const existingInvitations = await findTeamInvitationsByEmail(email);
      const existingInvitation = existingInvitations.find(
        (inv) =>
          inv.teamId === teamId && inv.status === InvitationStatus.PENDING
      );

      if (existingInvitation && !isTeamInvitationExpired(existingInvitation)) {
        throw new Error("Invitation already exists for this email");
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString("hex");

      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invitation using utility method
      const invitationData: TeamInvitationCreateData = {
        teamId,
        email,
        invitedBy,
        expiresAt,
        status: InvitationStatus.PENDING,
        token,
        role,
      };

      if (customMessage) {
        invitationData.customMessage = customMessage;
      }

      const invitation = await createTeamInvitation(invitationData);

      loggingService.info("Team invitation created", {
        invitationId: invitation.id,
        teamId,
        email,
        role,
        invitedBy,
      });

      return invitation;
    } catch (error: unknown) {
      loggingService.error("Error creating team invitation:", error);
      throw error;
    }
  }

  /**
   * Create bulk invitations
   */
  async createBulkInvitations(
    teamId: string,
    invitations: InvitationData[],
    invitedBy: string
  ): Promise<TeamInvitation[]> {
    try {
      const createdInvitations: TeamInvitation[] = [];

      for (const invitationData of invitations) {
        try {
          const invitation = await this.createInvitation(
            teamId,
            invitationData.email,
            invitationData.role,
            invitedBy,
            invitationData.customMessage
          );
          createdInvitations.push(invitation);
        } catch (error: unknown) {
          loggingService.warn("Failed to create invitation for email:", {
            email: invitationData.email,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other invitations
        }
      }

      return createdInvitations;
    } catch (error: unknown) {
      loggingService.error("Error creating bulk invitations:", error);
      throw error;
    }
  }

  /**
   * Send invitation email
   */
  async sendInvitationEmail(
    invitation: TeamInvitationWithRelations
  ): Promise<void> {
    try {
      // Get team and inviter details
      const team = await Team.findByPk(invitation.teamId);
      const inviter = await User.findByPk(invitation.invitedBy);

      if (!team || !inviter) {
        throw new Error("Team or inviter not found");
      }

      // Generate invitation URL
      const invitationUrl = `${
        process.env["FRONTEND_URL"] ?? "https://bidkore.com"
      }/teams/invite/${invitation.token}`;

      // Send email using EmailService
      const emailData: TeamInvitationEmailData = {
        to: invitation.email,
        teamName: team.name,
        inviterName:
          `${inviter.firstName} ${inviter.lastName}`.trim() || inviter.email,
        invitationUrl,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      };

      if (invitation.customMessage) {
        emailData.customMessage = invitation.customMessage;
      }

      await emailService.sendTeamInvitation(emailData);

      loggingService.info("Team invitation email sent successfully", {
        invitationId: invitation.id,
        email: invitation.email,
        teamId: invitation.teamId,
        teamName: team.name,
      });
    } catch (error: unknown) {
      loggingService.error("Error sending invitation email:", error);
      throw error;
    }
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(
    token: string,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
    invitation?: TeamInvitation;
  }> {
    try {
      // Convert token to invitation ID (assuming token is stringified ID)
      const invitationId = parseInt(token, 10);
      if (Number.isNaN(invitationId)) {
        throw new Error("Invalid invitation token");
      }

      const invitation = await findTeamInvitationById(invitationId.toString());

      if (!invitation || invitation.status !== InvitationStatus.PENDING) {
        throw new Error("Invalid or expired invitation");
      }

      // Check if invitation is expired
      if (new Date() > invitation.expiresAt) {
        await updateTeamInvitationStatus(
          invitation.id,
          InvitationStatus.EXPIRED
        );
        throw new Error("Invitation has expired");
      }

      // Get user to verify email matches
      const user = await User.findByPk(userId);
      if (!user || user.email !== invitation.email) {
        throw new Error("Email does not match invitation");
      }

      // Check if user is already a member
      const existingMember = await findTeamMemberByUserAndTeam(
        userId,
        invitation.teamId
      );

      if (existingMember) {
        throw new Error("User is already a team member");
      }

      // Create team membership with default role (could be passed as parameter)
      await createTeamMember({
        teamId: invitation.teamId,
        userId,
        role: TeamRole.MEMBER, // Default role, could be parameterized
      });

      // Update invitation status
      await updateTeamInvitationStatus(
        invitation.id,
        InvitationStatus.ACCEPTED
      );

      loggingService.info("Team invitation accepted", {
        invitationId: invitation.id,
        teamId: invitation.teamId,
        userId,
        role: TeamRole.MEMBER, // Default role used
      });

      return {
        success: true,
        message: "Invitation accepted successfully",
        invitation: invitation as TeamInvitation,
      };
    } catch (error: unknown) {
      loggingService.error("Error accepting invitation:", error);
      throw error;
    }
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(
    invitationId: number,
    cancelledBy: string
  ): Promise<void> {
    try {
      const invitation = await findTeamInvitationById(invitationId.toString());

      if (!invitation) {
        throw new Error("Invitation not found");
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new Error("Can only cancel pending invitations");
      }

      await updateTeamInvitationStatus(
        invitationId.toString(),
        InvitationStatus.CANCELLED
      );

      loggingService.info("Team invitation cancelled", {
        invitationId,
        cancelledBy,
        teamId: invitation.teamId,
      });
    } catch (error: unknown) {
      loggingService.error("Error cancelling invitation:", error);
      throw error;
    }
  }

  /**
   * Get team invitations
   */
  async getTeamInvitations(
    teamId: string
  ): Promise<TeamInvitationWithRelations[]> {
    try {
      return findTeamInvitationsByTeamId(teamId);
    } catch (error: unknown) {
      loggingService.error("Error getting team invitations:", error);
      throw error;
    }
  }

  /**
   * Clean up expired invitations
   */
  async cleanupExpiredInvitations(): Promise<number> {
    try {
      const expiredInvitations = await findExpiredTeamInvitations();

      for (const invitation of expiredInvitations) {
        await updateTeamInvitationStatus(
          invitation.id,
          InvitationStatus.EXPIRED
        );
      }

      loggingService.info("Expired invitations cleaned up", {
        count: expiredInvitations.length,
      });

      return expiredInvitations.length;
    } catch (error: unknown) {
      loggingService.error("Error cleaning up expired invitations:", error);
      throw error;
    }
  }

  /**
   * Resend invitation
   */
  async resendInvitation(invitationId: number): Promise<void> {
    try {
      const invitation = await findTeamInvitationById(invitationId.toString());

      if (!invitation) {
        throw new Error("Invitation not found");
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new Error("Can only resend pending invitations");
      }

      if (isTeamInvitationExpired(invitation)) {
        throw new Error("Invitation has expired");
      }

      await this.sendInvitationEmail(invitation);

      loggingService.info("Team invitation resent", {
        invitationId,
        email: invitation.email,
        teamId: invitation.teamId,
      });
    } catch (error: unknown) {
      loggingService.error("Error resending invitation:", error);
      throw error;
    }
  }
}

export default new TeamInvitationService();
