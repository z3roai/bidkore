import { describe, expect, it } from "@jest/globals";
import type { ZodError } from "zod";

import { loginSchema, registerSchema, verifyEmailSchema } from "../auth";

describe("Zod Auth Schemas", () => {
	describe("registerSchema", () => {
		it("should validate correct registration data", () => {
			const validData = {
				email: "test@example.com",
				password: "password123",
				firstName: "John",
				lastName: "Doe",
			};

			const result = registerSchema.safeParse(validData);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.email).toBe("test@example.com");
				expect(result.data.firstName).toBe("John");
			}
		});

		it("should reject invalid email", () => {
			const invalidData = {
				email: "invalid-email",
				password: "password123",
				firstName: "John",
				lastName: "Doe",
			};

			const result = registerSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as ZodError).issues[0]?.message).toContain(
					"Invalid email format",
				);
			}
		});

		it("should reject short password", () => {
			const invalidData = {
				email: "test@example.com",
				password: "123",
				firstName: "John",
				lastName: "Doe",
			};

			const result = registerSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as ZodError).issues[0]?.message).toContain(
					"Password must be at least 6 characters",
				);
			}
		});
	});

	describe("loginSchema", () => {
		it("should validate correct login data", () => {
			const validData = {
				email: "test@example.com",
				password: "password123",
			};

			const result = loginSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it("should reject empty password", () => {
			const invalidData = {
				email: "test@example.com",
				password: "",
			};

			const result = loginSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as ZodError).issues[0]?.message).toContain(
					"Password is required",
				);
			}
		});
	});

	describe("verifyEmailSchema", () => {
		it("should validate with token", () => {
			const validData = {
				token: "some-token",
				email: "test@example.com",
			};

			const result = verifyEmailSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it("should validate with OTP", () => {
			const validData = {
				otp: "123456",
				email: "test@example.com",
			};

			const result = verifyEmailSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it("should reject when neither token nor OTP provided", () => {
			const invalidData = {
				email: "test@example.com",
			};

			const result = verifyEmailSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as ZodError).issues[0]?.message).toContain(
					"Either token or OTP must be provided",
				);
			}
		});

		it("should reject invalid OTP length", () => {
			const invalidData = {
				otp: "12345", // Too short
				email: "test@example.com",
			};

			const result = verifyEmailSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as ZodError).issues[0]?.message).toContain(
					"OTP must be exactly 6 characters",
				);
			}
		});
	});
});
