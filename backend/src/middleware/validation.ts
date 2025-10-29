import type { NextFunction, Request, Response } from "express";
import type { ParsedQs } from "qs";
import { ZodError, type ZodSchema } from "zod";

import { createError } from "@/middleware/errorHandler";

export const validateRequest = <T>(
	schema: ZodSchema<T>
): ((req: Request, _res: Response, next: NextFunction) => void) => {
	return (req: Request, _res: Response, next: NextFunction): void => {
		try {
			// Validate request body using Zod 4's improved parsing
			req.body = schema.parse(req.body);
			next();
		} catch (error) {
			if (error instanceof ZodError) {
				// Format Zod 4 errors for better API response
				const formattedErrors = error.issues.map(err => ({
					field: err.path.join("."),
					message: err.message,
					code: err.code,
					...(err.path.length > 0 && { path: err.path }),
				}));

				const validationError = createError("Validation failed", 400);
				validationError.details = { errors: formattedErrors };
				next(validationError);
				return;
			}
			next(error);
		}
	};
};

export const validateQuery = <T>(
	schema: ZodSchema<T>
): ((req: Request, _res: Response, next: NextFunction) => void) => {
	return (req: Request, _res: Response, next: NextFunction): void => {
		try {
			// Validate query parameters
			req.query = schema.parse(req.query) as ParsedQs;
			next();
		} catch (error) {
			if (error instanceof ZodError) {
				const formattedErrors = error.issues.map(err => ({
					field: err.path.join("."),
					message: err.message,
					code: err.code,
					...(err.path.length > 0 && { path: err.path }),
				}));

				const validationError = createError("Query validation failed", 400);
				validationError.details = { errors: formattedErrors };
				next(validationError);
				return;
			}
			next(error);
		}
	};
};

export const validateParams = <T>(
	schema: ZodSchema<T>
): ((req: Request, _res: Response, next: NextFunction) => void) => {
	return (req: Request, _res: Response, next: NextFunction): void => {
		try {
			// Validate route parameters
			req.params = schema.parse(req.params) as Record<string, string>;
			next();
		} catch (error) {
			if (error instanceof ZodError) {
				const formattedErrors = error.issues.map(err => ({
					field: err.path.join("."),
					message: err.message,
					code: err.code,
					...(err.path.length > 0 && { path: err.path }),
				}));

				const validationError = createError("Parameter validation failed", 400);
				validationError.details = { errors: formattedErrors };
				next(validationError);
				return;
			}
			next(error);
		}
	};
};

// Safe validation that doesn't throw - useful for optional validation
export const safeValidate = <T>(
	schema: ZodSchema<T>,
	data: unknown
): { success: boolean; data?: T; error?: ZodError } => {
	const result = schema.safeParse(data);
	return result;
};
