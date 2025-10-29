import axios from "axios";

import loggingService from "@/services/loggingService";

interface TurnstileResponse {
	success: boolean;
	challenge_ts?: string;
	hostname?: string;
	"error-codes"?: string[];
	action?: string;
	cdata?: string;
}

class TurnstileService {
	private readonly secretKey: string;
	private readonly verifyUrl =
		"https://challenges.cloudflare.com/turnstile/v0/siteverify";
	private readonly isDisabled: boolean;

	constructor() {
		this.secretKey = process.env["TURNSTILE_SECRET_KEY"] ?? "";
		this.isDisabled = process.env["NODE_ENV"] === "development";

		if (this.isDisabled) {
			loggingService.info(
				"Turnstile validation is disabled in development mode."
			);
		} else if (!this.secretKey) {
			loggingService.warn(
				"Turnstile secret key not configured. Turnstile validation will be disabled."
			);
		}
	}

	async verifyToken(token: string, remoteip?: string): Promise<boolean> {
		// Skip Turnstile validation in development mode
		if (this.isDisabled) {
			loggingService.info("Turnstile validation skipped in development mode.");
			return true;
		}

		if (!this.secretKey) {
			loggingService.warn(
				"Turnstile secret key not configured. Skipping validation."
			);
			return true; // Skip validation if not configured
		}

		if (!token) {
			loggingService.warn("Turnstile token not provided.");
			return false;
		}

		try {
			const response = await axios.post<TurnstileResponse>(
				this.verifyUrl,
				new URLSearchParams({
					secret: this.secretKey,
					response: token,
					...(remoteip && { remoteip }),
				}),
				{
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
					timeout: 10000, // 10 second timeout
				}
			);

			const result = response.data;

			loggingService.info("Turnstile verification result:", {
				success: result.success,
				hostname: result.hostname,
				challenge_ts: result.challenge_ts,
				errorCodes: result["error-codes"],
			});

			if (!result.success) {
				loggingService.warn("Turnstile verification failed:", {
					errorCodes: result["error-codes"],
					hostname: result.hostname,
				});
			}

			return result.success;
		} catch (error) {
			loggingService.error("Turnstile verification error:", error);
			return false;
		}
	}

	isConfigured(): boolean {
		// In development mode, consider Turnstile as "not configured" to skip validation
		if (this.isDisabled) {
			return false;
		}
		return Boolean(this.secretKey);
	}
}

export default new TurnstileService();
