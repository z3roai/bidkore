import sgMail from "@sendgrid/mail";

import config from "@/config/env";
import loggingService from "@/services/loggingService";

// Initialize SendGrid
if (config.email.sendgridApiKey) {
	sgMail.setApiKey(config.email.sendgridApiKey);
}

export interface TeamInvitationEmailData {
	to: string;
	teamName: string;
	inviterName: string;
	invitationUrl: string;
	role: string;
	customMessage?: string;
	expiresAt: Date;
}

export interface WelcomeEmailData {
	to: string;
	firstName: string;
	lastName: string;
	teamName: string;
	dashboardUrl: string;
}

export interface GeneralWelcomeEmailData {
	to: string;
	firstName: string;
	lastName: string;
	dashboardUrl: string;
}

export interface SubscriptionUpgradeEmailData {
	to: string;
	firstName: string;
	lastName: string;
	oldPlan: string;
	newPlan: string;
	features: string[];
	dashboardUrl: string;
}

export interface GenericEmailData {
	to: string;
	subject: string;
	html: string;
	text?: string;
}

class EmailService {
	private async sendEmail(
		to: string,
		subject: string,
		html: string
	): Promise<void> {
		if (!config.email.sendgridApiKey) {
			loggingService.warn("SendGrid not configured, skipping email");
			return;
		}

		if (!config.email.fromEmail) {
			loggingService.warn(
				"FROM_EMAIL not configured. Skipping email send. Please configure a verified sender address."
			);
			return; // Changed from throw to return for development
		}

		try {
			const msg = {
				to,
				from: config.email.fromEmail,
				subject,
				html,
				// Disable click tracking for action emails to prevent URL rewriting
				trackingSettings: {
					clickTracking: {
						enable: false,
					},
				},
			};

			loggingService.info(
				`Sending email from sender: ${config.email.fromEmail} to: ${to} subject: ${subject}`
			);
			await sgMail.send(msg);
			loggingService.info(
				`Email sent successfully from ${config.email.fromEmail} to ${to}: ${subject}`
			);
		} catch (error: unknown) {
			loggingService.error("SendGrid error:", error);
			throw new Error(
				`Failed to send email: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	/**
	 */
	private getSharedStyles(): string {
		return `
			*{box-sizing:border-box}
			body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;line-height:1.6;color:#ffffff;background:#1a1a1a}
			.container{max-width:600px;margin:0 auto;background:#2d2d2d;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.3);border:1px solid #404040}
			.header{background:#000000;padding:32px 24px;text-align:center;border-bottom:1px solid #333333}
			.logo{font-size:24px;font-weight:700;color:#ffffff;margin-bottom:8px;letter-spacing:-.025em}
			.header h1{font-size:20px;font-weight:600;color:#ffffff;margin:0;letter-spacing:-.025em}
			.content{padding:32px 24px;color:#e5e5e5}
			.content h2{font-size:18px;font-weight:600;color:#ffffff;margin:0 0 16px}
			.content p{font-size:16px;line-height:1.6;margin:0 0 16px;color:#cccccc}
			.button{display:inline-block;padding:12px 24px;background:#ffffff;color:#000000;text-decoration:none;border-radius:6px;font-weight:500;font-size:14px;margin:24px 0;border:1px solid #ffffff;transition:all .2s ease}
			.button:hover{background:#f0f0f0;border-color:#f0f0f0}
			.footer{background:#1a1a1a;padding:24px;border-top:1px solid #404040;font-size:14px;color:#999999;text-align:center}
			.role-badge{display:inline-block;padding:4px 8px;background:#404040;color:#ffffff;border-radius:4px;font-size:12px;font-weight:500;text-transform:capitalize;border:1px solid #666666}
			.otp-code{background:#1a1a1a;border:2px solid #404040;border-radius:8px;padding:24px;margin:24px 0;text-align:center}
			.otp-code-label{font-size:14px;font-weight:500;color:#999999;margin-bottom:12px}
			.otp-code-value{font-size:32px;font-weight:700;color:#ffffff;letter-spacing:8px;font-family:'Courier New',monospace;margin:0}
			.otp-code-expiry{font-size:12px;color:#666666;margin-top:8px}
			@media (max-width:600px){
				.container{margin:0;border-radius:0;border-left:none;border-right:none}
				.header,.content,.footer{padding:24px 16px}
				.otp-code-value{font-size:24px;letter-spacing:4px}
			}
		`;
	}

	private generateEmailTemplate(
		title: string,
		content: string,
		buttonText?: string,
		buttonUrl?: string
	): string {
		return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${this.getSharedStyles()}</style></head><body><div class="container"><div class="header"><div class="logo">BidKore</div><h1>${title}</h1></div><div class="content">${content}${buttonText && buttonUrl ? `<div style="text-align:center;margin:24px 0"><a href="${buttonUrl}" class="button">${buttonText}</a></div>` : ""}</div><div class="footer"><p>This email was sent from BidKore. If you have any questions, please contact our support team.</p><p>© ${new Date().getFullYear()} BidKore. All rights reserved.</p></div></div></body></html>`;
	}

	/**
	 * Send generic email with custom content
	 */
	async sendGenericEmail(data: GenericEmailData): Promise<void> {
		await this.sendEmail(data.to, data.subject, data.html);
	}

	/**
	 * Send password reset email with OTP code
	 */
	async sendPasswordResetEmail(
		to: string,
		firstName: string,
		lastName: string,
		resetUrl: string
	): Promise<void> {
		const subject = "Reset Your Password - BidKore";

		const content = `
			<p>Hi ${firstName} ${lastName},</p>
			<p>You requested to reset your password for your BidKore account. Click the button below to create a new password and regain access to your government contracting opportunities.</p>

			<div style="text-align: center; margin: 32px 0;">
				<a href="${resetUrl}" class="button">Reset My Password</a>
			</div>

			<p>If the button doesn't work, you can copy and paste this link into your browser:</p>
			<p style="word-break: break-all; color: #666; font-size: 14px;">${resetUrl}</p>

			<p><strong>This link will expire in 15 minutes for security.</strong></p>

			<p>If you didn't request this password reset, please ignore this email. Your account remains secure.</p>
		`;

		const html = this.generateEmailTemplate("Reset Your Password", content);
		await this.sendEmail(to, subject, html);
	}

	/**
	 * Send team invitation email
	 */
	async sendTeamInvitation(data: TeamInvitationEmailData): Promise<void> {
		const subject = `You're invited to join ${data.teamName} on BidKore`;

		const content = `
      <p>Hello!</p>
      <p><strong>${
				data.inviterName
			}</strong> has invited you to join the <strong>${
			data.teamName
		}</strong> team on BidKore.</p>

      ${
				data.customMessage
					? `
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
          <p style="margin: 0; font-style: italic;">"${data.customMessage}"</p>
        </div>
      `
					: ""
			}

      <p>Your role: <span class="role-badge">${data.role}</span></p>

      <p>Click the button below to accept the invitation and start collaborating with your team:</p>

      <p><strong>Important:</strong> This invitation will expire on ${data.expiresAt.toLocaleDateString()} at ${data.expiresAt.toLocaleTimeString()}.</p>
    `;

		const html = this.generateEmailTemplate(
			"Team Invitation",
			content,
			"Accept Invitation",
			data.invitationUrl
		);

		await this.sendEmail(data.to, subject, html);
	}

	/**
	 * Send welcome email for new team members
	 */
	async sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
		const subject = `Welcome to ${data.teamName} on BidKore`;

		const html = this.generateWelcomeEmailHTML(data);

		await this.sendEmail(data.to, subject, html);
	}

	/**
	 * Send general welcome email for new users
	 */
	async sendGeneralWelcomeEmail(data: GeneralWelcomeEmailData): Promise<void> {
		const subject = "Welcome to BidKore - Let's Win More Government Contracts!";

		const html = this.generateGeneralWelcomeEmailHTML(data);

		await this.sendEmail(data.to, subject, html);
	}

	/**
	 * Send subscription upgrade confirmation email
	 */
	async sendSubscriptionUpgradeEmail(
		data: SubscriptionUpgradeEmailData
	): Promise<void> {
		const subject = `🎉 Subscription Upgraded to ${data.newPlan} - Welcome to Premium BidKore!`;

		const html = this.generateSubscriptionUpgradeEmailHTML(data);

		await this.sendEmail(data.to, subject, html);
	}

	/**
	 * Generate optimized welcome email HTML template
	 */
	private generateWelcomeEmailHTML(data: WelcomeEmailData): string {
		const styles = this.getSharedStyles() + `
			.header{background:#000000;padding:24px;text-align:center;color:#fff;border-radius:0 0 12px 12px;box-shadow:0 4px 12px rgba(0,0,0,.3)}
			.header h1{font-size:28px;font-weight:700;margin:0 0 8px;text-shadow:0 2px 4px rgba(0,0,0,.3)}
			.header .subtitle{font-size:16px;opacity:.9;margin:0 0 16px;font-weight:300;color:#cccccc}
			.verification-section{padding:32px 24px;text-align:center;background:#2d2d2d}
			.verification-section h2{font-size:22px;color:#ffffff;margin:0 0 12px;font-weight:600}
			.verification-section p{font-size:15px;color:#cccccc;margin:0 0 16px;max-width:400px;margin-left:auto;margin-right:auto}
			.verify-button{display:inline-block;background:#ffffff;color:#000000;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;box-shadow:0 3px 6px rgba(0,0,0,.2);transition:transform .2s ease}
			.verify-button:hover{transform:translateY(-1px);box-shadow:0 6px 12px rgba(0,0,0,.3);background:#f0f0f0}
			.features-section{background:#1a1a1a;padding:32px 24px;color:#fff}
			.features-section h2{font-size:22px;text-align:center;margin:0 0 24px;font-weight:600}
			.feature-list{list-style:none;padding:0;margin:0}
			.feature-list li{padding:12px 0;border-bottom:1px solid #404040;font-size:15px;position:relative;padding-left:24px}
			.feature-list li:last-child{border-bottom:none}
			.feature-list li:before{content:"✓";position:absolute;left:0;color:#ffffff;font-weight:bold;font-size:16px}
			.bonus-features{background:#404040;color:#fff;padding:16px;border-radius:6px;margin:16px 0;text-align:center;font-weight:600;font-size:16px}
			.support-section{text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #404040}
			.support-section p{margin:0;font-size:15px;color:#cccccc}
			.footer{background:#1a1a1a;padding:24px;text-align:center;border-top:1px solid #404040}
			.footer-links{margin-bottom:16px}
			.footer-links a{color:#ffffff;text-decoration:none;margin:0 8px;font-size:13px}
			.footer-links a:hover{text-decoration:underline}
			.footer-brand{font-size:11px;color:#999999;margin-top:16px}
			.trust-indicators{display:flex;justify-content:center;align-items:center;gap:16px;margin-top:16px;flex-wrap:wrap}
			.trust-item{display:flex;align-items:center;gap:6px;font-size:13px;color:#999999}
			@media (max-width:600px){
				.header,.verification-section,.features-section,.footer{padding:24px 16px}
				.header h1{font-size:24px}
				.trust-indicators{flex-direction:column;gap:8px}
			}
		`;

		return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to BidKore</title><style>${styles}</style></head><body><div class="container"><div class="header"><div style="font-size:24px;font-weight:700;margin-bottom:8px;color:#fff">BidKore</div><h1>Welcome to BidKore!</h1><p class="subtitle">Your gateway to winning government contracts</p></div><div class="verification-section"><h2>Let's get you started!</h2><p>Hello ${data.firstName}! Welcome to the <strong>${data.teamName}</strong> team on BidKore. Please verify your email address to unlock access to thousands of SAM.gov opportunities and start building your winning proposal pipeline.</p><p style="color:#ffffff;font-weight:600">Ready to transform your government contracting success?</p><a href="${data.dashboardUrl}" class="verify-button">Access Team Dashboard</a></div><div class="footer"><p>© ${new Date().getFullYear()} BidKore. All rights reserved.</p></div></div></body></html>`;
	}

	/**
	 * Generate optimized general welcome email HTML template
	 */
	private generateGeneralWelcomeEmailHTML(
		data: GeneralWelcomeEmailData
	): string {
		const styles = this.getSharedStyles() + `
			.header{background:#000000;padding:24px;text-align:center;color:#fff;border-radius:0 0 12px 12px;box-shadow:0 4px 12px rgba(0,0,0,.3)}
			.header h1{font-size:28px;font-weight:700;margin:0 0 8px;text-shadow:0 2px 4px rgba(0,0,0,.3)}
			.header .subtitle{font-size:16px;opacity:.9;margin:0 0 16px;font-weight:300;color:#cccccc}
			.verification-section{padding:32px 24px;text-align:center;background:#2d2d2d}
			.verification-section h2{font-size:22px;color:#ffffff;margin:0 0 12px;font-weight:600}
			.verification-section p{font-size:15px;color:#cccccc;margin:0 0 16px;max-width:400px;margin-left:auto;margin-right:auto}
			.verify-button{display:inline-block;background:#ffffff;color:#000000;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;box-shadow:0 3px 6px rgba(0,0,0,.2);transition:transform .2s ease}
			.verify-button:hover{transform:translateY(-1px);box-shadow:0 6px 12px rgba(0,0,0,.3);background:#f0f0f0}
			.features-section{background:#1a1a1a;padding:32px 24px;color:#fff}
			.features-section h2{font-size:22px;text-align:center;margin:0 0 24px;font-weight:600}
			.feature-list{list-style:none;padding:0;margin:0}
			.feature-list li{padding:12px 0;border-bottom:1px solid #404040;font-size:15px;position:relative;padding-left:24px}
			.feature-list li:last-child{border-bottom:none}
			.feature-list li:before{content:"✓";position:absolute;left:0;color:#ffffff;font-weight:bold;font-size:16px}
			.bonus-features{background:#404040;color:#fff;padding:16px;border-radius:6px;margin:16px 0;text-align:center;font-weight:600;font-size:16px}
			.support-section{text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #404040}
			.support-section p{margin:0;font-size:15px;color:#cccccc}
			.footer{background:#1a1a1a;padding:24px;text-align:center;border-top:1px solid #404040}
			.footer-links{margin-bottom:16px}
			.footer-links a{color:#ffffff;text-decoration:none;margin:0 8px;font-size:13px}
			.footer-links a:hover{text-decoration:underline}
			.footer-brand{font-size:11px;color:#999999;margin-top:16px}
			.trust-indicators{display:flex;justify-content:center;align-items:center;gap:16px;margin-top:16px;flex-wrap:wrap}
			.trust-item{display:flex;align-items:center;gap:6px;font-size:13px;color:#999999}
			@media (max-width:600px){
				.header,.verification-section,.features-section,.footer{padding:24px 16px}
				.header h1{font-size:24px}
				.trust-indicators{flex-direction:column;gap:8px}
			}
		`;

		return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to BidKore</title><style>${styles}</style></head><body><div class="container"><div class="header"><div style="font-size:24px;font-weight:700;margin-bottom:8px;color:#fff">BidKore</div><h1>Welcome to BidKore!</h1><p class="subtitle">Your gateway to winning government contracts</p></div><div class="verification-section"><h2>Let's get you started!</h2><p>Hello ${data.firstName}! Please verify your email address to unlock access to thousands of SAM.gov opportunities and start building your winning proposal pipeline.</p><p style="color:#ffffff;font-weight:600">Ready to transform your government contracting success?</p><a href="${data.dashboardUrl}" class="verify-button">Verify Email & Start Monitoring</a></div><div class="footer"><p>© ${new Date().getFullYear()} BidKore. All rights reserved.</p></div></div></body></html>`;
	}

	/**
	 * Generate optimized subscription upgrade email HTML template
	 */
	private generateSubscriptionUpgradeEmailHTML(
		data: SubscriptionUpgradeEmailData
	): string {
		const styles = this.getSharedStyles() + `
			.header{background:#000000;padding:24px;text-align:center;color:#fff;border-radius:0 0 12px 12px;box-shadow:0 4px 12px rgba(0,0,0,.3)}
			.header h1{font-size:28px;font-weight:700;margin:0 0 8px;text-shadow:0 2px 4px rgba(0,0,0,.3)}
			.header .subtitle{font-size:16px;opacity:.9;margin:0 0 16px;font-weight:300;color:#cccccc}
			.upgrade-section{padding:32px 24px;text-align:center;background:#2d2d2d}
			.upgrade-section h2{font-size:22px;color:#ffffff;margin:0 0 12px;font-weight:600}
			.upgrade-section p{font-size:15px;color:#cccccc;margin:0 0 16px;max-width:400px;margin-left:auto;margin-right:auto}
			.plan-badge{display:inline-block;background:#ffffff;color:#000000;padding:6px 12px;border-radius:16px;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px;margin:8px 4px}
			.dashboard-button{display:inline-block;background:#ffffff;color:#000000;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;box-shadow:0 3px 6px rgba(0,0,0,.2);transition:transform .2s ease;margin:16px 0}
			.dashboard-button:hover{transform:translateY(-1px);box-shadow:0 6px 12px rgba(0,0,0,.3);background:#f0f0f0}
			.features-section{background:#1a1a1a;padding:32px 24px;color:#fff}
			.features-section h2{font-size:22px;text-align:center;margin:0 0 24px;font-weight:600}
			.feature-list{list-style:none;padding:0;margin:0}
			.feature-list li{padding:12px 0;border-bottom:1px solid #404040;font-size:15px;position:relative;padding-left:24px}
			.feature-list li:last-child{border-bottom:none}
			.feature-list li:before{content:"🚀";position:absolute;left:0;font-size:16px}
			.celebration-section{background:#ffffff;color:#000000;padding:16px;border-radius:6px;margin:16px 0;text-align:center;font-weight:600;font-size:16px}
			.support-section{text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #404040}
			.support-section p{margin:0;font-size:15px;color:#cccccc}
			.footer{background:#1a1a1a;padding:24px;text-align:center;border-top:1px solid #404040}
			.footer-links{margin-bottom:16px}
			.footer-links a{color:#ffffff;text-decoration:none;margin:0 8px;font-size:13px}
			.footer-links a:hover{text-decoration:underline}
			.footer-brand{font-size:11px;color:#999999;margin-top:16px}
			.trust-indicators{display:flex;justify-content:center;align-items:center;gap:16px;margin-top:16px;flex-wrap:wrap}
			.trust-item{display:flex;align-items:center;gap:6px;font-size:13px;color:#999999}
			@media (max-width:600px){
				.header,.upgrade-section,.features-section,.footer{padding:24px 16px}
				.header h1{font-size:24px}
				.trust-indicators{flex-direction:column;gap:8px}
			}
		`;

		return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Subscription Upgraded - BidKore</title><style>${styles}</style></head><body><div class="container"><div class="header"><div style="font-size:24px;font-weight:700;margin-bottom:8px;color:#fff">BidKore</div><h1>🎉 Subscription Upgraded!</h1><p class="subtitle">Welcome to ${data.newPlan} - Your government contracting success just leveled up!</p></div><div class="upgrade-section"><h2>Congratulations ${data.firstName}!</h2><p>Your subscription has been successfully upgraded from <strong>${data.oldPlan}</strong> to <span class="plan-badge">${data.newPlan}</span>!</p><p style="color:#ffffff;font-weight:600">You now have access to premium features that will accelerate your government contracting success.</p><a href="${data.dashboardUrl}" class="dashboard-button">Access Your Premium Dashboard</a></div><div class="footer"><p>© ${new Date().getFullYear()} BidKore. All rights reserved.</p></div></div></body></html>`;
	}

	/**
	 * Send team creation confirmation email
	 */
	async sendTeamCreationConfirmation(data: {
		to: string;
		teamName: string;
		dashboardUrl: string;
	}): Promise<void> {
		const subject = `Team "${data.teamName}" created successfully`;

		const content = `
      <p>Congratulations! Your team <strong>"${data.teamName}"</strong> has been created successfully.</p>

      <p>You can now:</p>
      <ul>
        <li>Invite team members</li>
        <li>Set up team roles and permissions</li>
        <li>Create shared filters</li>
        <li>Start collaborating on opportunities</li>
      </ul>

      <p>Click the button below to start managing your team:</p>
    `;

		const html = this.generateEmailTemplate(
			"Team Created Successfully",
			content,
			"Manage Team",
			data.dashboardUrl
		);

		await this.sendEmail(data.to, subject, html);
	}

	/**
	 * Send role change notification email
	 */
	async sendRoleChangeNotification(data: {
		to: string;
		teamName: string;
		newRole: string;
		changedBy: string;
		dashboardUrl: string;
	}): Promise<void> {
		const subject = `Your role in ${data.teamName} has been updated`;

		const content = `
      <p>Hello!</p>
      <p>Your role in the <strong>${data.teamName}</strong> team has been updated by <strong>${data.changedBy}</strong>.</p>

      <p>Your new role: <span class="role-badge">${data.newRole}</span></p>

      <p>This change affects your permissions and access within the team. Click the button below to view your updated team dashboard:</p>
    `;

		const html = this.generateEmailTemplate(
			"Role Updated",
			content,
			"View Team Dashboard",
			data.dashboardUrl
		);

		await this.sendEmail(data.to, subject, html);
	}

	/**
	 * Send team member removal notification email
	 */
	async sendRemovalNotification(data: {
		to: string;
		teamName: string;
		removedBy: string;
	}): Promise<void> {
		const subject = `You've been removed from ${data.teamName}`;

		const content = `
      <p>Hello!</p>
      <p>You have been removed from the <strong>${data.teamName}</strong> team by <strong>${data.removedBy}</strong>.</p>

      <p>You will no longer have access to:</p>
      <ul>
        <li>Team-specific opportunities and filters</li>
        <li>Team chat and collaboration tools</li>
        <li>Shared resources and documents</li>
      </ul>

      <p>If you believe this was done in error, please contact the team administrator or our support team.</p>
    `;

		const html = this.generateEmailTemplate("Removed from Team", content);

		await this.sendEmail(data.to, subject, html);
	}
}

export default new EmailService();
