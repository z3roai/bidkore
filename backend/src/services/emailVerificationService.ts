import crypto from "node:crypto";

import sgMail from "@sendgrid/mail";

import EmailVerificationModel, {
	type EmailVerification,
	isExpired,
	VerificationType,
} from "../models/EmailVerification";

import config from "@/config/env";
import User from "@/models/User";
import loggingService from "@/services/loggingService";

// Initialize SendGrid
if (config.email.sendgridApiKey) {
	sgMail.setApiKey(config.email.sendgridApiKey);
}

export interface VerificationEmailData {
	email: string;
	firstName: string;
	lastName: string;
	verificationUrl?: string | undefined;
	otp?: string | undefined;
	type: VerificationType;
}

class EmailVerificationService {
	private async sendEmail(
		to: string,
		subject: string,
		html: string
	): Promise<void> {
		if (!config.email.sendgridApiKey) {
			loggingService.warn(
				"SendGrid not configured, skipping email verification"
			);
			return;
		}

		if (!config.email.fromEmail) {
			loggingService.warn(
				"FROM_EMAIL not configured. Skipping email verification. Please configure a verified sender address."
			);
			return;
		}

		try {
			const msg = {
				to,
				from: config.email.fromEmail,
				subject,
				html,
				// Disable click tracking for verification emails to prevent URL rewriting
				trackingSettings: {
					clickTracking: {
						enable: false,
					},
				},
			};

			loggingService.info(
				`Sending verification email from sender: ${config.email.fromEmail} to: ${to} subject: ${subject}`
			);
			await sgMail.send(msg);
			loggingService.info(
				`Verification email sent successfully from ${config.email.fromEmail} to ${to}: ${subject}`
			);
		} catch (error: unknown) {
			loggingService.error("SendGrid error:", error);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to send verification email: ${errorMessage}`);
		}
	}

	private generateToken(): string {
		return crypto.randomBytes(32).toString("hex");
	}

	private generateOTP(): string {
		return Math.floor(100000 + Math.random() * 900000).toString();
	}

	private generateVerificationUrl(token: string): string {
		const frontendUrl = config.urls.frontend || "http://localhost:3000";
		const baseUrl = Array.isArray(frontendUrl) ? frontendUrl[0] : frontendUrl;
		// Use main domain for email verification links
		const mainDomainUrl = baseUrl.replace(
			/^https?:\/\/([^.]+)\./,
			(match: string, subdomain: string) => {
				// If it's a subdomain, replace with main domain
				if (subdomain !== "www" && subdomain !== "localhost") {
					return match.replace(subdomain + ".", "");
				}
				return match;
			}
		);
		return `${mainDomainUrl}/verify-email?token=${token}`;
	}

	private generateEmailHTML(data: VerificationEmailData): string {
		const { firstName, lastName, verificationUrl, otp, type } = data;

		let title = "";
		let message = "";
		let actionButton = "";

		switch (type) {
			case VerificationType.EMAIL_VERIFICATION:
				if (otp) {
					// OTP-only verification
					title = `Welcome to BidKore, ${firstName}!`;
					message =
						"You're one step away from accessing thousands of government contracting opportunities. Use the verification code below to complete your email verification and start monitoring SAM.gov.";
					actionButton = "";
				} else {
					// Link-based verification (legacy)
					title = `Welcome to BidKore, ${firstName}!`;
					message =
						"You're one step away from accessing thousands of government contracting opportunities. Verify your email to start monitoring SAM.gov and building your winning proposal pipeline.";
					actionButton = verificationUrl
						? `<a href="${verificationUrl}" class="button">Verify Email & Start Monitoring</a>`
						: "";
				}
				break;
			case VerificationType.PASSWORD_RESET:
				title = "Reset Your Password";
				message = `Hi ${firstName} ${lastName},<br><br>You requested to reset your password for your BidKore account. Use the verification code below to create a new password and regain access to your government contracting opportunities.`;
				actionButton = "";
				break;
			case VerificationType.EMAIL_CHANGE:
				title = "Confirm Email Change";
				message = `Hi ${firstName} ${lastName},<br><br>You requested to change your email address for your BidKore account. Please confirm this change to continue receiving government contracting opportunities and updates.`;
				actionButton = verificationUrl
					? `<a href="${verificationUrl}" class="button">Confirm Email Change</a>`
					: "";
				break;
			default:
				title = "Email Verification";
				message = `Hi ${firstName} ${lastName},<br><br>Please verify your email address to continue using BidKore.`;
				actionButton = verificationUrl
					? `<a href="${verificationUrl}" class="button">Verify Email</a>`
					: "";
				break;
		}

		let otpSection = "";
		if (otp) {
			otpSection = `
        <div class="otp-code">
          <div class="otp-code-label">Your verification code:</div>
          <div class="otp-code-value">${otp}</div>
          <div class="otp-code-expiry">This code will expire in 15 minutes</div>
        </div>
      `;
		}

		return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #0f172a;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            border: 1px solid #e2e8f0;
          }
          .header {
            background: #0f172a;
            padding: 32px 24px;
            text-align: center;
            border-bottom: 1px solid #1e293b;
          }
          .logo {
            font-size: 24px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 8px;
            letter-spacing: -0.025em;
          }
          .header h1 {
            font-size: 20px;
            font-weight: 600;
            color: #f1f5f9;
            margin: 0;
            letter-spacing: -0.025em;
          }
          .content {
            padding: 32px 24px;
            color: #334155;
          }
          .content h2 {
            font-size: 18px;
            font-weight: 600;
            color: #0f172a;
            margin: 0 0 16px 0;
          }
          .content p {
            font-size: 16px;
            line-height: 1.6;
            margin: 0 0 16px 0;
            color: #475569;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background: #0f172a;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            font-size: 14px;
            margin: 24px 0;
            border: 1px solid #0f172a;
            transition: all 0.2s ease;
          }
          .button:hover {
            background: #1e293b;
            border-color: #1e293b;
          }
          .footer {
            background: #f8fafc;
            padding: 24px;
            border-top: 1px solid #e2e8f0;
            font-size: 14px;
            color: #64748b;
            text-align: center;
          }
          .otp-code {
            background: #f8fafc;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            padding: 24px;
            margin: 24px 0;
            text-align: center;
          }
          .otp-code-label {
            font-size: 14px;
            font-weight: 500;
            color: #64748b;
            margin-bottom: 12px;
          }
          .otp-code-value {
            font-size: 32px;
            font-weight: 700;
            color: #0f172a;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
            margin: 0;
          }
          .otp-code-expiry {
            font-size: 12px;
            color: #94a3b8;
            margin-top: 8px;
          }
          @media (max-width: 600px) {
            .container {
              margin: 0;
              border-radius: 0;
              border-left: none;
              border-right: none;
            }
            .header, .content, .footer {
              padding: 24px 16px;
            }
            .otp-code-value {
              font-size: 24px;
              letter-spacing: 4px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">BidKore</div>
            <h1>${title}</h1>
          </div>
          <div class="content">
            <p>${message}</p>

            ${otpSection}

            ${
							actionButton
								? `<div style="text-align: center; margin: 24px 0;">${actionButton}</div>`
								: ""
						}
          </div>
          <div class="footer">
            <p>This email was sent from BidKore. If you have any questions, please contact our support team.</p>
            <p>© ${new Date().getFullYear()} BidKore. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
	}

	async createVerificationToken(
		userId: string,
		email: string,
		type: VerificationType,
		includeOTP = false
	): Promise<EmailVerification> {
		// Clean up any existing verification tokens for this user and type
		await EmailVerificationModel.deleteMany({
			where: {
				userId,
				type,
				email,
			},
		});

		const token = this.generateToken();
		const otp = includeOTP ? this.generateOTP() : null;
		const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

		const verification = await EmailVerificationModel.create({
			email,
			token,
			otp,
			type,
			expiresAt,
			...(userId && {
				user: {
					connect: { id: userId },
				},
			}),
		});

		return verification;
	}

	async sendVerificationEmail(
		userId: string,
		email: string,
		type: VerificationType,
		includeOTP = false
	): Promise<void> {
		const user = await User.findByPk(userId);
		if (!user) {
			throw new Error("User not found");
		}

		const verification = await this.createVerificationToken(
			userId,
			email,
			type,
			includeOTP
		);

		// Only generate verification URL if not using OTP
		const verificationUrl = includeOTP
			? null
			: this.generateVerificationUrl(verification.token);

		let subject = "";
		switch (type) {
			case VerificationType.EMAIL_VERIFICATION:
				subject = "Verify Your Email Address - BidKore";
				break;
			case VerificationType.PASSWORD_RESET:
				subject = "Reset Your Password - BidKore";
				break;
			case VerificationType.EMAIL_CHANGE:
				subject = "Confirm Email Change - BidKore";
				break;
			default:
				subject = "Email Verification - BidKore";
				break;
		}

		const emailData: VerificationEmailData = {
			email,
			firstName: user.firstName,
			lastName: user.lastName,
			verificationUrl: verificationUrl ?? undefined,
			otp: verification.otp ?? undefined,
			type,
		};

		const html = this.generateEmailHTML(emailData);
		await this.sendEmail(email, subject, html);
	}

	async validateVerificationToken(
		token: string,
		type: VerificationType
	): Promise<{
		verification: EmailVerification | null;
		message: string;
	}> {
		const verification = await EmailVerificationModel.findOne({
			where: {
				token,
				type,
				isUsed: false,
			},
		});

		if (!verification) {
			return { verification: null, message: "Invalid verification token" };
		}

		if (isExpired(verification)) {
			return { verification: null, message: "Verification token has expired" };
		}

		return { verification, message: "Token is valid" };
	}

	async verifyToken(
		token: string,
		type: VerificationType
	): Promise<EmailVerification | null> {
		const verification = await EmailVerificationModel.findOne({
			where: {
				token,
				type,
				isUsed: false,
			},
		});

		if (!verification || isExpired(verification)) {
			return null;
		}

		return verification;
	}

	async verifyOTP(
		email: string,
		otp: string,
		type: VerificationType
	): Promise<EmailVerification | null> {
		const verification = await EmailVerificationModel.findOne({
			where: {
				email,
				otp,
				type,
				isUsed: false,
			},
		});

		if (!verification || isExpired(verification)) {
			return null;
		}

		return verification;
	}

	async markAsUsed(verificationId: string): Promise<void> {
		await EmailVerificationModel.update(
			{ isUsed: true },
			{ where: { id: verificationId } }
		);
	}

	async cleanupExpiredTokens(): Promise<void> {
		await EmailVerificationModel.deleteMany({
			where: {
				expiresAt: {
					lt: new Date(),
				},
			},
		});
	}
}

export default new EmailVerificationService();
