import { z } from "zod";

export const webauthnLoginOptionsSchema = z
	.object({
		email: z.string().email("Invalid email format"),
	})
	.describe("Request options for WebAuthn authentication");

export const webauthnRegisterVerifySchema = z
	.object({
		credential: z.any(),
	})
	.describe("Verify WebAuthn registration response");

export const webauthnLoginVerifySchema = z
	.object({
		email: z.string().email("Invalid email format"),
		credential: z.any(),
	})
	.describe("Verify WebAuthn authentication response");

export type WebAuthnLoginOptionsRequest = z.infer<
	typeof webauthnLoginOptionsSchema
>;
export type WebAuthnRegisterVerifyRequest = z.infer<
	typeof webauthnRegisterVerifySchema
>;
export type WebAuthnLoginVerifyRequest = z.infer<
	typeof webauthnLoginVerifySchema
>;
