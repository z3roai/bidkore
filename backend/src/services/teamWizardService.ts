import { type TeamMember } from "@prisma/client";
import { TeamRole } from "@/models/prisma";

import { TeamMemberUtils } from "@/models";
import TeamModel, { type Team } from "@/models/Team";
import type { TeamInvitation } from "@/models/TeamInvitation";
import User from "@/models/User";
import emailService from "@/services/emailService";
import loggingService from "@/services/loggingService";
import teamInvitationService from "@/services/teamInvitationService";

export interface TeamWizardData {
  // Step 1: Team Details
  name: string;
  description?: string;
  purpose: string;

  // Step 2: Suggested Roles
  suggestedRoles?: RoleSuggestion[];

  // Step 3: Invite Members
  invitations?: InvitationData[];

  // Step 4: Review & Create
  confirmCreation?: boolean;
}

export interface RoleSuggestion {
  email: string;
  suggestedRole: TeamRole;
  confidence: number;
  reasoning: string;
}

export interface InvitationData {
  email: string;
  role: TeamRole;
  customMessage?: string;
}

export interface TeamTemplate {
  id: string;
  name: string;
  description: string;
  purpose: string;
  defaultRoles: Record<string, TeamRole>;
}

class TeamWizardService {
  private readonly teamTemplates: TeamTemplate[] = [
    {
      id: "government-contracting",
      name: "Government Contracting",
      description:
        "Optimized for government contracting teams with compliance focus",
      purpose: "Bid on government contracts and manage procurement processes",
      defaultRoles: {},
    },
    {
      id: "consulting-firm",
      name: "Consulting Firm",
      description:
        "Designed for consulting firms with project management focus",
      purpose: "Provide consulting services and manage client projects",
      defaultRoles: {},
    },
    {
      id: "construction-company",
      name: "Construction Company",
      description: "Tailored for construction companies with project tracking",
      purpose: "Bid on construction projects and manage building operations",
      defaultRoles: {},
    },
    {
      id: "technology-startup",
      name: "Technology Startup",
      description: "Built for tech startups with agile development focus",
      purpose: "Develop technology solutions and manage software projects",
      defaultRoles: {},
    },
  ];

  /**
   * Create team with wizard data
   */
  async createTeamWithWizard(
    data: TeamWizardData,
    creatorId: string
  ): Promise<{
    team: Team;
    members: TeamMember[];
    invitations: TeamInvitation[];
  }> {
    try {
      // Create the team
      const team = await TeamModel.create({
        name: data.name,
        description: data.description ?? null,
        creator: { connect: { id: creatorId } },
      });

      // Add team creator as owner
      const ownerMember = await TeamMemberUtils.createTeamMember({
        teamId: team.id,
        userId: creatorId,
        role: TeamRole.OWNER,
      });

      const members = [ownerMember];
      const invitations: TeamInvitation[] = [];

      // Step 3: Create invitations if provided
      if (data.invitations && data.invitations.length > 0) {
        const createdInvitations =
          await teamInvitationService.createBulkInvitations(
            team.id,
            data.invitations,
            creatorId
          );

        // Send invitation emails
        for (const invitation of createdInvitations) {
          try {
            await teamInvitationService.sendInvitationEmail(invitation);
          } catch (emailError: unknown) {
            loggingService.warn("Failed to send wizard invitation email:", {
              invitationId: invitation.id,
              email: invitation.email,
              error:
                emailError instanceof Error
                  ? emailError.message
                  : String(emailError),
            });
          }
        }

        invitations.push(...createdInvitations);
      }

      // Send team creation confirmation email to creator
      try {
        const creator = await User.findByPk(creatorId);
        if (creator) {
          await emailService.sendTeamCreationConfirmation({
            to: creator.email,
            teamName: team.name,
            dashboardUrl: `${process.env["FRONTEND_URL"]}/teams/${team.id}`,
          });
        }
      } catch (emailError: unknown) {
        loggingService.warn(
          "Failed to send team creation confirmation:",
          emailError
        );
      }

      loggingService.info("Team created with wizard", {
        teamId: team.id,
        teamName: team.name,
        creatorId,
        invitationCount: invitations.length,
        purpose: data.purpose,
      });

      return { team, members, invitations };
    } catch (error: unknown) {
      loggingService.error("Error creating team with wizard:", error);
      throw error;
    }
  }

  /**
   * Get AI-powered role suggestions based on team purpose and member emails
   */
  getRoleSuggestions(
    purpose: string,
    memberEmails: string[],
    teamTemplate?: string
  ): RoleSuggestion[] {
    try {
      // Apply template-based suggestions if provided
      if (teamTemplate) {
        const template = this.teamTemplates.find((t) => t.id === teamTemplate);
        if (template) {
          return this.getTemplateBasedSuggestions(template, memberEmails);
        }
      }

      // Generate AI-powered suggestions based on purpose and email domains
      return this.generateAISuggestions(purpose, memberEmails);
    } catch (error: unknown) {
      loggingService.error("Error generating role suggestions:", error);
      return [];
    }
  }

  /**
   * Get available team templates
   */
  getTeamTemplates(): TeamTemplate[] {
    return this.teamTemplates;
  }

  /**
   * Generate template-based role suggestions
   */
  private getTemplateBasedSuggestions(
    template: TeamTemplate,
    memberEmails: string[]
  ): RoleSuggestion[] {
    const suggestions: RoleSuggestion[] = [];

    for (const email of memberEmails) {
      const username = email.split("@")[0]?.toLowerCase() ?? "";

      let suggestedRole: TeamRole = TeamRole.MEMBER;
      let confidence = 0.7;
      let reasoning = `Based on ${template.name} template`;

      // Role suggestions based on email patterns and templates
      if (template.id === "government-contracting") {
        if (username.includes("admin") || username.includes("manager")) {
          suggestedRole = TeamRole.ADMIN;
          confidence = 0.9;
          reasoning =
            "Email suggests administrative role in government contracting";
        } else if (
          username.includes("procurement") ||
          username.includes("contract")
        ) {
          suggestedRole = TeamRole.MEMBER;
          confidence = 0.85;
          reasoning = "Email suggests procurement/contracting expertise";
        }
      } else if (template.id === "consulting-firm") {
        if (username.includes("partner") || username.includes("principal")) {
          suggestedRole = TeamRole.OWNER;
          confidence = 0.9;
          reasoning = "Email suggests senior consulting role";
        } else if (
          username.includes("manager") ||
          username.includes("director")
        ) {
          suggestedRole = TeamRole.ADMIN;
          confidence = 0.85;
          reasoning = "Email suggests management role in consulting";
        }
      } else if (template.id === "construction-company") {
        if (username.includes("project") || username.includes("supervisor")) {
          suggestedRole = TeamRole.MEMBER;
          confidence = 0.85;
          reasoning = "Email suggests project management role";
        } else if (
          username.includes("safety") ||
          username.includes("compliance")
        ) {
          suggestedRole = TeamRole.MEMBER;
          confidence = 0.8;
          reasoning = "Email suggests oversight/compliance role";
        }
      } else if (template.id === "technology-startup") {
        if (username.includes("cto") || username.includes("tech")) {
          suggestedRole = TeamRole.ADMIN;
          confidence = 0.9;
          reasoning = "Email suggests technical leadership role";
        } else if (username.includes("dev") || username.includes("engineer")) {
          suggestedRole = TeamRole.MEMBER;
          confidence = 0.8;
          reasoning = "Email suggests development role";
        }
      }

      suggestions.push({
        email,
        suggestedRole,
        confidence,
        reasoning,
      });
    }

    return suggestions;
  }

  /**
   * Generate AI-powered role suggestions
   */
  private generateAISuggestions(
    purpose: string,
    memberEmails: string[]
  ): RoleSuggestion[] {
    const suggestions: RoleSuggestion[] = [];

    // Analyze purpose keywords for role suggestions
    const purposeLower = purpose.toLowerCase();
    const isManagement =
      purposeLower.includes("manage") ||
      purposeLower.includes("lead") ||
      purposeLower.includes("direct");
    const isTechnical =
      purposeLower.includes("develop") ||
      purposeLower.includes("technical") ||
      purposeLower.includes("software");
    const isCompliance =
      purposeLower.includes("compliance") ||
      purposeLower.includes("regulatory") ||
      purposeLower.includes("audit");
    const isSales =
      purposeLower.includes("sales") ||
      purposeLower.includes("business") ||
      purposeLower.includes("client");

    for (const email of memberEmails) {
      const emailParts = email.split("@");
      const domain = emailParts[1]?.toLowerCase() ?? "";
      const username = emailParts[0]?.toLowerCase() ?? "";

      let suggestedRole: TeamRole = TeamRole.MEMBER;
      let confidence = 0.6;
      let reasoning = "General team member role";

      // Domain-based suggestions
      if (domain.includes("admin") || domain.includes("management")) {
        suggestedRole = TeamRole.ADMIN;
        confidence = 0.8;
        reasoning = "Domain suggests administrative role";
      } else if (domain.includes("tech") || domain.includes("dev")) {
        suggestedRole = TeamRole.MEMBER;
        confidence = 0.75;
        reasoning = "Domain suggests technical role";
      }

      // Username-based suggestions
      if (
        username.includes("admin") ||
        username.includes("manager") ||
        username.includes("director")
      ) {
        suggestedRole = TeamRole.ADMIN;
        confidence = Math.max(confidence, 0.85);
        reasoning = "Username suggests management role";
      } else if (
        username.includes("editor") ||
        username.includes("writer") ||
        username.includes("content")
      ) {
        suggestedRole = TeamRole.MEMBER;
        confidence = Math.max(confidence, 0.8);
        reasoning = "Username suggests editorial role";
      } else if (
        username.includes("viewer") ||
        username.includes("read") ||
        username.includes("observer")
      ) {
        suggestedRole = TeamRole.MEMBER;
        confidence = Math.max(confidence, 0.8);
        reasoning = "Username suggests viewing role";
      }

      // Purpose-based adjustments
      if (
        isManagement &&
        (username.includes("lead") || username.includes("head"))
      ) {
        suggestedRole = TeamRole.ADMIN;
        confidence = 0.9;
        reasoning = "Purpose and username suggest leadership role";
      } else if (
        isTechnical &&
        (username.includes("dev") || username.includes("engineer"))
      ) {
        suggestedRole = TeamRole.MEMBER;
        confidence = 0.85;
        reasoning = "Purpose and username suggest technical role";
      } else if (
        isCompliance &&
        (username.includes("audit") || username.includes("compliance"))
      ) {
        suggestedRole = TeamRole.MEMBER;
        confidence = 0.8;
        reasoning = "Purpose and username suggest oversight role";
      } else if (
        isSales &&
        (username.includes("sales") || username.includes("business"))
      ) {
        suggestedRole = TeamRole.MEMBER;
        confidence = 0.8;
        reasoning = "Purpose and username suggest business role";
      }

      suggestions.push({
        email,
        suggestedRole,
        confidence,
        reasoning,
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Validate wizard data
   */
  validateWizardData(data: TeamWizardData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate team name
    if (!data.name || data.name.trim().length === 0) {
      errors.push("Team name is required");
    } else if (data.name.length > 100) {
      errors.push("Team name must be 100 characters or less");
    }

    // Validate purpose
    if (!data.purpose || data.purpose.trim().length === 0) {
      errors.push("Team purpose is required");
    } else if (data.purpose.length > 500) {
      errors.push("Team purpose must be 500 characters or less");
    }

    // Validate description if provided
    if (data.description && data.description.length > 500) {
      errors.push("Team description must be 500 characters or less");
    }

    // Validate invitations if provided
    if (data.invitations) {
      if (data.invitations.length > 50) {
        errors.push("Cannot invite more than 50 members at once");
      }

      const emails = new Set();
      for (const invitation of data.invitations) {
        if (!invitation.email.includes("@")) {
          errors.push(`Invalid email: ${invitation.email}`);
        }

        if (emails.has(invitation.email)) {
          errors.push(`Duplicate email: ${invitation.email}`);
        }
        emails.add(invitation.email);

        if (!Object.values(TeamRole).includes(invitation.role)) {
          errors.push(
            `Invalid role for ${invitation.email}: ${invitation.role}`
          );
        }

        if (invitation.customMessage && invitation.customMessage.length > 500) {
          errors.push(`Custom message for ${invitation.email} is too long`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate team URL slug
   */
  generateTeamUrl(teamId: string, teamName: string): string {
    const slug = teamName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return `/teams/${teamId}/${slug}`;
  }
}

export default new TeamWizardService();
