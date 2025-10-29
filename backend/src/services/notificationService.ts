import {
	type Filter,
	type Opportunity,
	type Team,
	type User,
	UserRole,
} from "@prisma/client";
import sgMail from "@sendgrid/mail";

import config from "@/config/env";
import FilterModel from "@/models/Filter";
import OpportunityModel from "@/models/Opportunity";
import TeamModel from "@/models/Team";
import { findTeamMembersByTeamId } from "@/models/TeamMember";
import UserModel from "@/models/User";
import loggingService from "@/services/loggingService";

// Initialize SendGrid
if (config.email.sendgridApiKey) {
	sgMail.setApiKey(config.email.sendgridApiKey);
}

export interface NotificationData {
	opportunityId: string;
	userId?: string;
	teamId?: string;
	filterId?: string;
}

export interface EmailError {
	message: string;
	code?: string;
	response?: {
		body?: unknown;
		headers?: Record<string, string>;
	};
}

export interface SlackError {
	message: string;
	code?: string;
	response?: {
		data?: unknown;
		status?: number;
	};
}

export interface OpportunityWithDetails {
	id: number;
	noticeId: string;
	title: string;
	solicitationNumber?: string;
	description?: string;
	postedDate?: Date;
	responseDeadLine?: Date;
	naicsCode?: string;
	type?: string;
	organizationType?: string;
	uiLink?: string;
}

export interface UserWithDetails {
	id: number;
	email: string;
	firstName: string;
	lastName: string;
	role: string;
	isActive: boolean;
	emailVerified: boolean;
	// slackWebhookUrl?: string; // Note: Add to Prisma schema when needed
}

export interface FilterWithDetails {
	id: number;
	name: string;
	description?: string;
	userId?: number;
	teamId?: number;
}

export interface TeamWithDetails {
	id: number;
	name: string;
	description?: string;
	members?: UserWithDetails[];
}

class NotificationService {
	private async sendEmail(
		to: string,
		subject: string,
		html: string
	): Promise<void> {
		if (!config.email.sendgridApiKey) {
			loggingService.warn(
				"SendGrid not configured, skipping email notification"
			);
			return;
		}

		if (!config.email.fromEmail) {
			loggingService.error(
				"FROM_EMAIL not configured. Please set FROM_EMAIL environment variable to a verified sender address."
			);
			throw new Error("FROM_EMAIL not configured");
		}

		try {
			const msg = {
				to,
				from: config.email.fromEmail,
				subject,
				html,
				// Disable click tracking for notification emails to prevent URL rewriting
				trackingSettings: {
					clickTracking: {
						enable: false,
					},
				},
			};

			await sgMail.send(msg);
			loggingService.info(`Email sent to ${to}: ${subject}`);
		} catch (error: unknown) {
			const emailError = error as EmailError;
			loggingService.error("SendGrid error:", error);
			throw new Error(
				`Failed to send email: ${emailError.message ?? "Unknown error"}`
			);
		}
	}

	async sendOpportunityNotification(data: NotificationData): Promise<void> {
		try {
			const opportunity = await OpportunityModel.findByPk(data.opportunityId);
			if (!opportunity) {
				throw new Error("Opportunity not found");
			}

			let recipients: User[] = [];
			let filter: Filter | null = null;
			let team: Team | null = null;

			// Get recipients based on notification type
			if (data.userId) {
				const user = await UserModel.findByPk(data.userId);
				if (user) {
					recipients = [user];
				}
			} else if (data.teamId) {
				team = await TeamModel.findByPk(data.teamId);
				if (team) {
					// Get team members with their user data included
					const teamMembers = await findTeamMembersByTeamId(data.teamId);
					recipients = teamMembers
						.filter(
							(member): member is NonNullable<typeof member> =>
								member.user !== null
						)
						.map(member => member.user)
						.filter((user): user is NonNullable<typeof user> => user != null);
				}
			}

			if (data.filterId) {
				filter = await FilterModel.findByPk(data.filterId);
			}

			// Filter recipients to only include premium users and active users
			const premiumRecipients = recipients.filter(user => {
				const isPremium =
					user.role === UserRole.PREMIUM ||
					user.role === UserRole.ENTERPRISE ||
					user.role === UserRole.ADMIN;
				const { isActive } = user;
				const isEmailVerified = user.emailVerified;

				loggingService.info(
					`User ${user.id} (${user.email}): premium=${isPremium}, active=${isActive}, verified=${isEmailVerified}`
				);

				return isPremium && isActive && isEmailVerified;
			});

			if (premiumRecipients.length === 0) {
				loggingService.info(
					`No eligible premium users found for opportunity ${data.opportunityId}, skipping notifications`
				);
				return;
			}

			loggingService.info(
				`Sending notifications for opportunity ${data.opportunityId} to ${premiumRecipients.length} premium users`
			);

			// Send notifications to all premium recipients
			for (const user of premiumRecipients) {
				const subject = `New SAM.gov Opportunity: ${opportunity.title}`;
				const html = this.generateEmailHTML(opportunity, filter, team);

				// Persist in-app notification for inbox
				try {
					const NotificationModel = (await import("../models/Notification"))
						.default;
					await NotificationModel.create({
						user: { connect: { id: user.id } },
						type: "opportunity_found",
						title: opportunity.title,
						message: filter ? `Matched filter: ${filter.name}` : null,
						opportunityId: opportunity.id,
						filterId: filter?.id,
						metadata: {
							opportunityNoticeId: opportunity.noticeId,
							uiLink: opportunity.uiLink,
						},
					} as import("@prisma/client").Prisma.NotificationCreateInput);
				} catch (e) {
					loggingService.error("Failed to persist in-app notification", e);
				}

				// Send email notification
				await this.sendEmail(user.email, subject, html);

				// Send Slack notification if webhook is configured
				// Note: Add slackWebhookUrl to User model in Prisma schema when needed
				// if (user.slackWebhookUrl) {
				//   const slackMessage = this.generateSlackMessage(
				//     opportunity,
				//     filter,
				//     team
				//   );
				//   await this.sendSlackNotification(
				//     user.slackWebhookUrl,
				//     slackMessage
				//   );
				// }
			}

			loggingService.info(
				`Notifications sent for opportunity ${data.opportunityId} to ${premiumRecipients.length} premium recipients`
			);
		} catch (error: unknown) {
			loggingService.error("Notification service error:", error);
			throw error;
		}
	}

	private generateEmailHTML(
		opportunity: Opportunity,
		filter?: Filter | null,
		team?: Team | null
	): string {
		const filterInfo = filter
			? `<p><strong>Matched Filter:</strong> ${filter.name}</p>`
			: "";
		const teamInfo = team ? `<p><strong>Team:</strong> ${team.name}</p>` : "";

		return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">New SAM.gov Opportunity Found!</h2>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${opportunity.title}</h3>
          ${filterInfo}
          ${teamInfo}

          <p><strong>Agency:</strong> ${
						opportunity.fullParentPathName ?? "N/A"
					}</p>
          <p><strong>Office:</strong> ${
						opportunity.fullParentPathCode ?? "N/A"
					}</p>
          <p><strong>Location:</strong> ${(() => {
						if (!opportunity.placeOfPerformance) {
							return "N/A";
						}
						if (typeof opportunity.placeOfPerformance === "string") {
							return opportunity.placeOfPerformance;
						}
						if (
							typeof opportunity.placeOfPerformance === "object" &&
							opportunity.placeOfPerformance !== null
						) {
							const perf = opportunity.placeOfPerformance as {
								city?: { name?: string };
								state?: { name?: string };
							};
							return perf.city?.name || perf.state?.name || "N/A";
						}
						return "N/A";
					})()}</p>
          <p><strong>NAICS Code:</strong> ${opportunity.naicsCode ?? "N/A"}</p>
          <p><strong>Response Deadline:</strong> ${
						opportunity.responseDeadLine
							? new Date(opportunity.responseDeadLine).toLocaleDateString()
							: "N/A"
					}</p>
          <p><strong>Estimated Value:</strong> ${
						opportunity.award &&
						typeof opportunity.award === "object" &&
						(opportunity.award as { value?: number }).value
							? `$${(
									opportunity.award as { value: number }
							  ).value.toLocaleString()}`
							: "N/A"
					}</p>
        </div>

        ${
					opportunity.description
						? `
          <div style="margin: 20px 0;">
            <h4>Description:</h4>
            <p style="background-color: #fff; padding: 15px; border-left: 4px solid #1976d2;">
              ${opportunity.description}
            </p>
          </div>
        `
						: ""
				}

        <div style="margin: 20px 0;">
          <a href="${
						opportunity.uiLink ?? `https://sam.gov/opp/${opportunity.noticeId}`
					}"
             style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            View Full Opportunity
          </a>
        </div>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This notification was sent by BidKore. To manage your notification preferences,
          visit your dashboard at <a href="${config.urls.frontend}">${
			config.urls.frontend
		}</a>
        </p>
      </div>
    `;
	}

	async sendBidDeadlineReminder(
		opportunityId: number,
		daysUntilDeadline: number
	): Promise<void> {
		try {
			const opportunity = await OpportunityModel.findByPk(
				opportunityId.toString()
			);
			if (!opportunity?.responseDeadLine) {
				return;
			}

			// Find users who have filters that might match this opportunity
			// Note: Fix deadline reminder query for Prisma when needed
			const filters = await FilterModel.findAll({
				where: {
					// deadlineReminderDays contains daysUntilDeadline
					isActive: true,
				},
			});

			for (const filter of filters) {
				const user = await UserModel.findByPk(filter.userId);
				if (!user?.isActive) {
					continue;
				}

				const subject = `Bid Deadline Reminder: ${opportunity.title} (${daysUntilDeadline} days)`;
				const html = this.generateDeadlineReminderHTML(
					opportunity,
					daysUntilDeadline
				);

				await this.sendEmail(user.email, subject, html);
			}

			loggingService.info(
				`Bid deadline reminders sent for opportunity ${opportunityId}`
			);
		} catch (error: unknown) {
			loggingService.error("Bid deadline reminder error:", error);
			throw error;
		}
	}

	private generateDeadlineReminderHTML(
		opportunity: Opportunity,
		daysUntilDeadline: number
	): string {
		return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">⚠️ Bid Deadline Reminder</h2>

        <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d32f2f;">
          <h3 style="margin-top: 0; color: #d32f2f;">${opportunity.title}</h3>

          <p><strong>Days Until Deadline:</strong> <span style="color: #d32f2f; font-weight: bold;">${daysUntilDeadline}</span></p>
          <p><strong>Response Deadline:</strong> ${
						opportunity.responseDeadLine
							? new Date(opportunity.responseDeadLine).toLocaleDateString()
							: "N/A"
					}</p>
          <p><strong>Agency:</strong> ${
						opportunity.fullParentPathName ?? "N/A"
					}</p>
          <p><strong>Office:</strong> ${
						opportunity.fullParentPathCode ?? "N/A"
					}</p>
        </div>

        <div style="margin: 20px 0;">
          <a href="${
						opportunity.uiLink ?? `https://sam.gov/opp/${opportunity.noticeId}`
					}"
             style="background-color: #d32f2f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            View Full Opportunity
          </a>
        </div>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This reminder was sent by BidKore. To manage your notification preferences,
          visit your dashboard at <a href="${config.urls.frontend}">${
			config.urls.frontend
		}</a>
        </p>
      </div>
    `;
	}

	async sendPasswordChangeReminderEmail(
		userEmail: string,
		daysLeft: number
	): Promise<void> {
		const subject =
			daysLeft > 0
				? `Reminder: Update your BidKore password in ${daysLeft} day${
						daysLeft === 1 ? "" : "s"
				  }`
				: "Your BidKore password is overdue for update";
		const html = `
		  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
		    <h2 style="color: #f59e0b;">Security Reminder</h2>
		    <div style="background-color: #fff7ed; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
		      <p style="margin: 0 0 12px 0;">For your account's security, please update your password ${
						daysLeft > 0
							? `within ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`
							: "as soon as possible."
					}</p>
		      <a href="${
						config.urls.frontend
					}/settings/security" style="background-color: #f59e0b; color: white; padding: 10px 16px; text-decoration: none; border-radius: 6px; display: inline-block;">Update Password</a>
		    </div>
		    <p style="color: #666; font-size: 12px; margin-top: 30px;">If you've recently changed your password, you can ignore this message.</p>
		  </div>
		`;
		await this.sendEmail(userEmail, subject, html);
	}
}

export default new NotificationService();
