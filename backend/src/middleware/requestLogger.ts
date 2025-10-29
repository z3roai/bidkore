import type { NextFunction, Request, Response } from "express";

import loggingService from "@/services/loggingService";

// Custom request logging middleware with color-enhanced status codes
export const requestLogger = (
	req: Request,
	res: Response,
	next: NextFunction,
): void => {
	const startTime = Date.now();

	// Override the res.end method to capture response time
	const originalEnd = res.end;

	// Create a wrapper function that matches all Response.end overloads
	const endWrapper = function(
		this: Response,
		...args: Parameters<typeof originalEnd>
	): Response {
		const responseTime = Date.now() - startTime;

		// Log the request with enhanced color coding
		loggingService.logApiRequest(req, res, responseTime);

		// Call the original end method and return its result
		return originalEnd.apply(this, args);
	};

	// Assign with proper typing
	res.end = endWrapper as typeof res.end;

	next();
};

export default requestLogger;
