import type { NextFunction, Request, Response } from "express";

import { isDev } from "@/config/env";
import loggingService from "@/services/loggingService";

export interface AppError extends Error {
	statusCode?: number;
	isOperational?: boolean;
	details?: Record<string, unknown>;
}

export const errorHandler = (
	error: AppError,
	_req: Request,
	res: Response,
	_next: NextFunction
): void => {
	let statusCode = error.statusCode ?? 500;
	let message = error.message || "Internal Server Error";

	// Handle specific error types
	if (error.name === "ValidationError") {
		statusCode = 400;
		message = "Validation Error";
	} else if (error.name === "PrismaClientValidationError") {
		statusCode = 400;
		message = "Database Validation Error";
	} else if (error.name === "PrismaClientKnownRequestError") {
		statusCode = 409;
		message = "Resource already exists";
	} else if (error.name === "PrismaClientUnknownRequestError") {
		statusCode = 400;
		message = "Invalid reference";
	}

	// Log error in development
	if (isDev) {
		loggingService.error("Error:", error);
	}

	const response: {
		error: string;
		stack?: string;
		details?: Record<string, unknown>;
	} = {
		error: message,
		...(isDev && { stack: error.stack }),
	};

	// Include validation details if available
	if (error.details) {
		response.details = error.details;
	}

	res.status(statusCode).json(response);
};

export const notFoundHandler = (req: Request, res: Response): void => {
	res.status(404).json({
		error: "Route not found",
		path: req.originalUrl,
	});
};

export const createError = (message: string, statusCode = 500): AppError => {
	const error: AppError = new Error(message);
	error.statusCode = statusCode;
	error.isOperational = true;
	return error;
};
