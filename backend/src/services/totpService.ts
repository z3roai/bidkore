import crypto from "node:crypto";

import * as QRCode from "qrcode";
import * as speakeasy from "speakeasy";

import loggingService from "@/services/loggingService";

export interface TOTPSetupResult {
	secret: string;
	qrCodeUrl: string;
	backupCodes: string[];
}

export interface TOTPVerificationResult {
	valid: boolean;
	backupCodeUsed?: boolean;
	skewStepsUsed?: number;
}

class TOTPService {
	normalizeSecret(rawSecret: string): string {
		let secret = String(rawSecret || "")
			.trim()
			.toUpperCase()
			.replace(/[^A-Z2-7]/g, "");
		const remainder = secret.length % 8;
		if (remainder !== 0) {
			secret = secret + "=".repeat(8 - remainder);
		}
		return secret;
	}
	/**
	 * Generate a new TOTP secret for a user
	 */
	generateSecret(userEmail: string): string {
		const secret = speakeasy.generateSecret({
			name: `BidKore (${userEmail})`,
			issuer: "BidKore",
			length: 32,
		});

		return secret.base32;
	}

	/**
	 * Generate backup codes for a user
	 */
	generateBackupCodes(count = 10): string[] {
		const codes: string[] = [];
		for (let i = 0; i < count; i++) {
			// Generate 8-character alphanumeric codes
			const code = crypto.randomBytes(4).toString("hex").toUpperCase();
			codes.push(code);
		}
		return codes;
	}

	/**
	 * Generate QR code URL for TOTP setup
	 */
	async generateQRCode(secret: string, userEmail: string): Promise<string> {
		const normalizedSecret = this.normalizeSecret(secret);
		const issuer = "BidKore";
		const label = `${issuer}:${userEmail}`;
		const otpauthUrl = `otpauth://totp/${encodeURIComponent(label)}?secret=${normalizedSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

		try {
			const qrCodeUrl = await QRCode.toDataURL(otpauthUrl, {
				errorCorrectionLevel: "M",
				margin: 2,
				width: 300,
			});
			return qrCodeUrl;
		} catch (error) {
			loggingService.error("Failed to generate QR code:", error);
			throw new Error("Failed to generate QR code");
		}
	}

	/**
	 * Secret fingerprint for diagnostics (first 10 hex of sha256)
	 */
	fingerprintSecret(secret: string): string {
		try {
			const normalized = this.normalizeSecret(secret);
			return crypto
				.createHash("sha256")
				.update(normalized)
				.digest("hex")
				.slice(0, 10);
		} catch {
			return "";
		}
	}

	/**
	 * Setup TOTP for a user
	 */
	async setupTOTP(userEmail: string): Promise<TOTPSetupResult> {
		const secret = this.generateSecret(userEmail);
		const qrCodeUrl = await this.generateQRCode(secret, userEmail);
		const backupCodes = this.generateBackupCodes();

		return {
			secret,
			qrCodeUrl,
			backupCodes,
		};
	}

	/**
	 * Verify TOTP token
	 */
	verifyTOTP(secret: string, token: string, window = 2): boolean {
		try {
			// Normalize token to digits only
			const normalizedToken = String(token).replace(/\D/g, "");
			if (normalizedToken.length !== 6) {
				return false;
			}
			const normalizedSecret = this.normalizeSecret(secret);
			const verified = speakeasy.totp.verify({
				secret: normalizedSecret,
				encoding: "base32",
				token: normalizedToken,
				window: Math.max(1, window),
				digits: 6,
			});

			return Boolean(verified);
		} catch (error) {
			loggingService.error("TOTP verification error:", error);
			return false;
		}
	}

	/**
	 * Diagnostic helper: returns delta if token matches within window
	 */
	diagnoseVerification(
		secret: string,
		token: string,
		window = 4,
	): { delta: number | null; window: number } {
		try {
			const normalizedToken = String(token).replace(/\D/g, "");
			const normalizedSecret = this.normalizeSecret(secret);
			const result = speakeasy.totp.verifyDelta({
				secret: normalizedSecret,
				encoding: "base32",
				token: normalizedToken,
				window: Math.max(1, window),
			});
			return {
				delta: result ? result.delta : null,
				window: Math.max(1, window),
			};
		} catch (error) {
			loggingService.error("TOTP diagnose error:", error);
			return { delta: null, window: Math.max(1, window) };
		}
	}

	/**
	 * Generate tokens around current time for debugging (-1, 0, +1 steps)
	 */
	previewTokens(secret: string): { prev: string; now: string; next: string } {
		const normalizedSecret = this.normalizeSecret(secret);
		const epoch = Math.floor(Date.now() / 1000);
		const step = 30;
		const prev = speakeasy.totp({
			secret: normalizedSecret,
			encoding: "base32",
			time: epoch - step,
		});
		const now = speakeasy.totp({
			secret: normalizedSecret,
			encoding: "base32",
			time: epoch,
		});
		const next = speakeasy.totp({
			secret: normalizedSecret,
			encoding: "base32",
			time: epoch + step,
		});
		return { prev, now, next };
	}

	/**
	 * Verify backup code
	 */
	verifyBackupCode(backupCodes: string[], code: string): boolean {
		const index = backupCodes.indexOf(code);
		if (index !== -1) {
			// Remove used backup code
			backupCodes.splice(index, 1);
			return true;
		}
		return false;
	}

	/**
	 * Verify TOTP or backup code
	 */
	verifyToken(
		secret: string,
		token: string,
		backupCodes: string[],
	): TOTPVerificationResult {
		// First try strict TOTP verification (small window)
		if (this.verifyTOTP(secret, token)) {
			return { valid: true };
		}

		// If that fails, attempt large-window drift compensation
		const driftWindowSteps = 240; // tolerate up to ~2 hours total drift
		const diag = this.diagnoseVerification(secret, token, driftWindowSteps);
		if (diag.delta !== null) {
			return { valid: true, skewStepsUsed: diag.delta };
		}

		// Then try backup code verification
		if (this.verifyBackupCode(backupCodes, token)) {
			return { valid: true, backupCodeUsed: true };
		}

		return { valid: false };
	}

	/**
	 * Generate time-based token for testing
	 */
	generateToken(secret: string): string {
		return speakeasy.totp({
			secret,
			encoding: "base32",
			time: Math.floor(Date.now() / 1000),
		});
	}

	/**
	 * Get remaining time for current TOTP window
	 */
	getRemainingTime(): number {
		const epoch = Math.round(Date.now() / 1000.0);
		const timeStep = 30;
		return timeStep - (epoch % timeStep);
	}
}

export default new TOTPService();
