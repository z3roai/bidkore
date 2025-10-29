// Export all schemas and types

import type { NextFunction, Request, Response } from "express";
import type { ZodError, ZodIssue, ZodSchema } from "zod";

// Re-export Zod for convenience
export { z } from "zod";
export * from "./auth";
export * from "./opportunity";
export * from "./subscription";
export * from "./team";
export * from "./user";
export * from "./webauthn";

// Common validation utilities
export const createValidationMiddleware = <T>(schema: ZodSchema<T>) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		try {
			req.body = schema.parse(req.body);
			next();
		} catch (error: unknown) {
			if (error instanceof Error && error.name === "ZodError") {
				const zodError = error as ZodError;
				const formattedErrors = zodError.issues.map((err: ZodIssue) => ({
					field: err.path.join("."),
					message: err.message,
					code: err.code,
					...(err.path.length > 0 && { path: err.path }),
				}));

				res.status(400).json({
					error: "Validation failed",
					details: formattedErrors,
				});
			}
			next(error);
		}
	};
};
