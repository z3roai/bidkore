import prisma from "@/config/prisma";
import loggingService from "@/services/loggingService";

interface CalendarEventData {
	subject: string;
	start: {
		dateTime: string;
		timeZone: string;
	};
	end: {
		dateTime: string;
		timeZone: string;
	};
	body?: {
		contentType: "HTML" | "Text";
		content: string;
	};
	location:
		| {
				displayName: string;
		  }
		| undefined;
	categories?: string[];
	isReminderOn?: boolean;
	reminderMinutesBeforeStart?: number;
}

interface OpportunityData {
	id: string;
	noticeId: string;
	title: string;
	responseDeadLine?: Date | null;
	fullParentPathName?: string | null;
	uiLink?: string | null;
	description?: string | null;
}

class CalendarSchedulingService {
	/**
	 * Creates a Microsoft Calendar event for an opportunity deadline
	 */
	async createOpportunityDeadlineEvent(
		userId: string,
		opportunity: OpportunityData
	): Promise<{ success: boolean; eventId?: string; error?: string }> {
		try {
			// Check if user has Microsoft integration
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: {
					microsoftAccessToken: true,
					microsoftAccountId: true,
					microsoftTokenExpiry: true,
				},
			});

			if (!user?.microsoftAccessToken || !user.microsoftAccountId) {
				loggingService.info("User does not have Microsoft integration", {
					userId,
					opportunityId: opportunity.id,
				});
				return {
					success: false,
					error: "Microsoft integration not available",
				};
			}

			// Check if opportunity has a deadline
			if (!opportunity.responseDeadLine) {
				loggingService.info("Opportunity has no response deadline", {
					userId,
					opportunityId: opportunity.id,
				});
				return {
					success: false,
					error: "No response deadline available",
				};
			}

			// Get valid access token
			const accessToken = await this.getValidAccessToken(userId);
			if (!accessToken) {
				return {
					success: false,
					error: "Invalid or expired Microsoft token",
				};
			}

			// Prepare calendar event data
			const deadlineDate = new Date(opportunity.responseDeadLine);
			const eventData = this.prepareCalendarEventData(
				opportunity,
				deadlineDate
			);

			// Create the calendar event
			const response = await fetch(
				"https://graph.microsoft.com/v1.0/me/events",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${accessToken}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(eventData),
				}
			);

			if (!response.ok) {
				const errorText = await response.text();
				loggingService.error("Failed to create calendar event", {
					userId,
					opportunityId: opportunity.id,
					status: response.status,
					error: errorText,
				});
				return {
					success: false,
					error: `Failed to create calendar event: ${response.status}`,
				};
			}

			const createdEvent = (await response.json()) as { id: string };

			loggingService.info("Calendar event created successfully", {
				userId,
				opportunityId: opportunity.id,
				eventId: createdEvent.id,
				deadline: deadlineDate.toISOString(),
			});

			return {
				success: true,
				eventId: createdEvent.id,
			};
		} catch (error) {
			loggingService.error("Error creating calendar event", {
				error,
				userId,
				opportunityId: opportunity.id,
			});
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Prepares calendar event data for an opportunity deadline
	 */
	private prepareCalendarEventData(
		opportunity: OpportunityData,
		deadlineDate: Date
	): CalendarEventData {
		// Set event to start 2 hours before deadline and end at deadline
		const startTime = new Date(deadlineDate.getTime() - 2 * 60 * 60 * 1000);
		const endTime = deadlineDate;

		// Prepare event body with opportunity details
		const bodyContent = this.generateEventBodyContent(opportunity);

		return {
			subject: `📋 Proposal Deadline: ${opportunity.title}`,
			start: {
				dateTime: startTime.toISOString(),
				timeZone: "UTC",
			},
			end: {
				dateTime: endTime.toISOString(),
				timeZone: "UTC",
			},
			body: {
				contentType: "HTML",
				content: bodyContent,
			},
			location: opportunity.fullParentPathName
				? {
						displayName: opportunity.fullParentPathName,
				  }
				: undefined,
			categories: ["BidKore", "Government Contract", "Deadline"],
			isReminderOn: true,
			reminderMinutesBeforeStart: 60, // 1 hour reminder
		};
	}

	/**
	 * Generates HTML content for the calendar event body
	 */
	private generateEventBodyContent(opportunity: OpportunityData): string {
		const samGovLink =
			opportunity.uiLink || `https://sam.gov/opp/${opportunity.noticeId}`;

		return `
			<div style="font-family: Arial, sans-serif; line-height: 1.6;">
				<h3 style="color: #2563eb; margin-bottom: 16px;">Government Contract Opportunity Deadline</h3>

				<div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
					<p><strong>Notice ID:</strong> ${opportunity.noticeId}</p>
					<p><strong>Title:</strong> ${opportunity.title}</p>
					${
						opportunity.fullParentPathName
							? `<p><strong>Agency:</strong> ${opportunity.fullParentPathName}</p>`
							: ""
					}
				</div>

				${
					opportunity.description
						? `
					<div style="margin-bottom: 16px;">
						<h4 style="color: #374151; margin-bottom: 8px;">Description:</h4>
						<p style="color: #6b7280;">${opportunity.description.substring(0, 300)}${
								opportunity.description.length > 300 ? "..." : ""
						  }</p>
					</div>
				`
						: ""
				}

				<div style="margin-bottom: 16px;">
					<h4 style="color: #374151; margin-bottom: 8px;">Action Items:</h4>
					<ul style="color: #6b7280;">
						<li>Review opportunity requirements</li>
						<li>Prepare proposal documents</li>
						<li>Submit response before deadline</li>
					</ul>
				</div>

				<div style="text-align: center; margin-top: 24px;">
					<a href="${samGovLink}"
						 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
						View on SAM.gov
					</a>
				</div>

				<p style="font-size: 12px; color: #9ca3af; margin-top: 24px; text-align: center;">
					This event was automatically created by BidKore when you saved this opportunity.
				</p>
			</div>
		`;
	}

	/**
	 * Gets a valid Microsoft access token for the user
	 */
	private async getValidAccessToken(userId: string): Promise<string | null> {
		try {
			// This function should be imported from microsoft routes
			// For now, we'll implement a basic version
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: {
					microsoftAccessToken: true,
					microsoftTokenExpiry: true,
				},
			});

			if (!user?.microsoftAccessToken) {
				return null;
			}

			// Check if token is still valid (with 2-minute buffer)
			if (user.microsoftTokenExpiry) {
				const expiresAt = new Date(
					user.microsoftTokenExpiry as unknown as string
				).getTime();
				if (expiresAt - Date.now() < 2 * 60 * 1000) {
					loggingService.info("Microsoft token expired", { userId });
					return null;
				}
			}

			return user.microsoftAccessToken;
		} catch (error) {
			loggingService.error("Error getting Microsoft access token", {
				error,
				userId,
			});
			return null;
		}
	}

	/**
	 * Checks if a calendar event already exists for an opportunity
	 */
	async checkExistingCalendarEvent(
		userId: string,
		opportunityId: string
	): Promise<boolean> {
		try {
			// For now, we'll use a simple approach without a dedicated table
			// In a production environment, you'd want to create a proper table
			// to track calendar events for opportunities
			loggingService.info("Checking for existing calendar event", {
				userId,
				opportunityId,
			});

			// Always return false for now - we can implement proper tracking later
			return false;
		} catch (error) {
			loggingService.error("Error checking existing calendar event", {
				error,
				userId,
				opportunityId,
			});
			return false;
		}
	}

	/**
	 * Records that a calendar event was created for an opportunity
	 */
	async recordCalendarEvent(
		userId: string,
		opportunityId: string,
		eventId: string
	): Promise<void> {
		try {
			// For now, we'll just log the event creation
			// In a production environment, you'd want to store this in a database table
			loggingService.info("Calendar event recorded", {
				userId,
				opportunityId,
				eventId,
				action: "calendar_event_created",
			});
		} catch (error) {
			loggingService.error("Error recording calendar event", {
				error,
				userId,
				opportunityId,
				eventId,
			});
		}
	}
}

export default new CalendarSchedulingService();
