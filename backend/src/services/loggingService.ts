import winston from "winston";

import config from "@/config/env";

// Define log levels
const levels = {
	error: 0,
	warn: 1,
	info: 2,
	http: 3,
	debug: 4,
	success: 2,
	warning: 1,
	danger: 0,
	primary: 2,
	secondary: 3,
};

// Define colors for each level
const colors = {
	error: "red",
	warn: "yellow",
	info: "green",
	http: "magenta",
	debug: "white",
	success: "green",
	warning: "yellow",
	danger: "red",
	primary: "blue",
	secondary: "gray",
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which logs to show based on environment
const level = (): string => {
	const isDevelopment = config.nodeEnv === "development";
	return isDevelopment ? "debug" : "info";
};

// Define different log formats

// Enhanced log format with colored headers and status code highlighting
const httpLogFormat = winston.format.combine(
	winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
	winston.format.printf((info: winston.Logform.TransformableInfo) => {
		// Define colors for log levels
		const levelColors: Record<string, string> = {
			error: "\x1b[31m", // Red
			warn: "\x1b[33m", // Yellow
			info: "\x1b[32m", // Green
			http: "\x1b[35m", // Magenta
			debug: "\x1b[36m", // White
			success: "\x1b[32m", // Green
			warning: "\x1b[33m", // Yellow
			danger: "\x1b[31m", // Red
			primary: "\x1b[34m", // Blue
			secondary: "\x1b[90m", // Gray
		};

		const resetColor = "\x1b[0m";
		const levelColor = levelColors[info.level] ?? "\x1b[37m";
		const coloredLevel = `${levelColor}[${info.level.toUpperCase()}]${resetColor}`;

		// Extract and colorize status code if it exists in HTTP requests
		let coloredMessage = String(info.message);
		// Only match 3-digit numbers that are actual HTTP status codes (100-599)
		const statusMatch = String(info.message).match(/\b([1-5]\d{2})\b/);
		if (statusMatch?.[1]) {
			const statusCode = parseInt(statusMatch[1], 10);
			let statusColor = "";

			if (statusCode >= 200 && statusCode < 300) {
				statusColor = "\x1b[32m"; // Green
			} else if (statusCode >= 300 && statusCode < 400) {
				statusColor = "\x1b[34m"; // Blue
			} else if (statusCode >= 400 && statusCode < 500) {
				statusColor = "\x1b[33m"; // Yellow
			} else if (statusCode >= 500) {
				statusColor = "\x1b[31m"; // Red
			} else {
				statusColor = "\x1b[90m"; // Gray
			}

			coloredMessage = String(info.message).replace(
				statusCode.toString(),
				`${statusColor}${statusCode}${resetColor}`
			);
		}

		return `${coloredLevel} ${info["timestamp"]} ${String(coloredMessage)}`;
	})
);

// Define transports - only console
const transports = [
	// Console transport with enhanced HTTP logging
	new winston.transports.Console({
		format: httpLogFormat,
	}),
];

// Create the logger
const logger = winston.createLogger({
	level: level(),
	levels,
	transports,
});

class LoggingService {
	// Helper method to safely stringify objects for logging
	private safeStringify(data: unknown): string {
		if (data == null) {
			return "none";
		}

		if (typeof data === "string") {
			return data || "none";
		}

		if (typeof data === "object") {
			const stringified = JSON.stringify(data);
			// Check if it's an empty object or array
			if (stringified === "{}" || stringified === "[]") {
				return "none";
			}
			return stringified;
		}

		return String(data) || "none";
	}

	// API Request Logging with status-based color coding
	logApiRequest(req: unknown, res: unknown, responseTime: number): void {
		const reqObj = req as {
			method?: string;
			url?: string;
			ip?: string;
			get?: (header: string) => string;
			user?: { id?: number };
		};
		const resObj = res as { statusCode?: number };
		const { method, url, ip } = reqObj;
		const { statusCode } = resObj;
		const userId = reqObj.user?.id ?? "anonymous";

		// Create the log message with clearer formatting
		const message = `${method ?? "UNKNOWN"} ${url ?? "UNKNOWN"} | Status: ${
			statusCode ?? "UNKNOWN"
		} | Time: ${responseTime}ms | IP: ${ip ?? "UNKNOWN"} | User: ${userId}`;

		// Use appropriate log level based on status code
		if (statusCode && statusCode >= 200 && statusCode < 300) {
			logger.info(message);
		} else if (statusCode && statusCode >= 300 && statusCode < 400) {
			logger.info(message);
		} else if (statusCode && statusCode >= 400 && statusCode < 500) {
			logger.warn(message);
		} else if (statusCode && statusCode >= 500) {
			logger.error(message);
		} else {
			logger.http(message);
		}
	}

	// Job Logging
	logJobStart(
		jobType: string,
		jobId: string,
		userId?: number,
		additionalData?: unknown
	): void {
		const data = this.safeStringify(additionalData);
		logger.info(
			`Job started: ${jobType} (${jobId}) - User: ${
				userId ?? "system"
			} - Data: ${data}`
		);
	}

	logJobComplete(
		jobType: string,
		jobId: string,
		userId?: number,
		result?: unknown
	): void {
		const resultData = this.safeStringify(result);
		logger.info(
			`Job completed: ${jobType} (${jobId}) - User: ${
				userId ?? "system"
			} - Result: ${resultData}`
		);
	}

	logJobError(
		jobType: string,
		jobId: string,
		error: Error,
		userId?: number
	): void {
		logger.error(
			`Job failed: ${jobType} (${jobId}) - User: ${
				userId ?? "system"
			} - Error: ${error.message}`,
			{
				stack: error.stack,
				jobType,
				jobId,
				userId,
			}
		);
	}

	// SAM.gov API Logging
	logSamApiCall(
		endpoint: string,
		params: unknown,
		responseTime: number,
		success: boolean
	): void {
		const paramStr = this.safeStringify(params);
		const status = success ? "SUCCESS" : "FAILED";
		logger.info(
			`SAM.gov API: ${endpoint} - ${status} - ${responseTime}ms - Params: ${paramStr}`
		);
	}

	logSamApiError(endpoint: string, error: Error, params?: unknown): void {
		const paramStr = this.safeStringify(params);
		logger.error(
			`SAM.gov API Error: ${endpoint} - ${error.message} - Params: ${paramStr}`,
			{
				stack: error.stack,
				endpoint,
				params,
			}
		);
	}

	// Attachment Download Logging
	logAttachmentDownload(
		url: string,
		fileName: string,
		fileSize: number,
		success: boolean,
		userId?: number
	): void {
		const status = success ? "SUCCESS" : "FAILED";
		const userInfo = userId ? `User: ${userId}` : "System";
		logger.info(
			`Attachment Download: ${fileName} - ${status} - Size: ${fileSize} bytes - ${userInfo} - URL: ${url}`
		);
	}

	logAttachmentDownloadError(
		url: string,
		fileName: string,
		error: Error,
		userId?: number
	): void {
		const userInfo = userId ? `User: ${userId}` : "System";
		logger.error(
			`Attachment Download Error: ${fileName} - ${error.message} - ${userInfo} - URL: ${url}`,
			{
				stack: error.stack,
				fileName,
				url,
				userId,
			}
		);
	}

	// Notification Logging
	logNotificationSent(
		type: string,
		recipient: string,
		opportunityId: number,
		success: boolean
	): void {
		const status = success ? "SUCCESS" : "FAILED";
		logger.info(
			`Notification Sent: ${type} - ${status} - Recipient: ${recipient} - Opportunity: ${opportunityId}`
		);
	}

	logNotificationError(
		type: string,
		recipient: string,
		opportunityId: number,
		error: Error
	): void {
		logger.error(
			`Notification Error: ${type} - ${error.message} - Recipient: ${recipient} - Opportunity: ${opportunityId}`,
			{
				stack: error.stack,
				type,
				recipient,
				opportunityId,
			}
		);
	}

	// User Action Logging
	logUserAction(
		action: string,
		userId: string,
		userRole: string,
		additionalData?: unknown
	): void {
		const data = this.safeStringify(additionalData);
		logger.info(
			`User Action: ${action} - User: ${userId} (${userRole}) - Data: ${data}`
		);
	}

	logUserError(
		action: string,
		userId: string,
		userRole: string,
		error: Error,
		additionalData?: unknown
	): void {
		const data = this.safeStringify(additionalData);
		logger.error(
			`User Error: ${action} - User: ${userId} (${userRole}) - ${error.message} - Data: ${data}`,
			{
				stack: error.stack,
				action,
				userId,
				userRole,
				additionalData,
			}
		);
	}

	// Database Logging
	logDatabaseOperation(
		operation: string,
		table: string,
		success: boolean,
		executionTime?: number
	): void {
		const status = success ? "SUCCESS" : "FAILED";
		const timeInfo = executionTime ? ` - ${executionTime}ms` : "";
		logger.info(`Database: ${operation} on ${table} - ${status}${timeInfo}`);
	}

	logDatabaseError(operation: string, table: string, error: Error): void {
		logger.error(
			`Database Error: ${operation} on ${table} - ${error.message}`,
			{
				stack: error.stack,
				operation,
				table,
			}
		);
	}

	// General logging methods
	logError(context: string, error: Error, additionalData?: unknown): void {
		logger.error(`${context}: ${error.message}`, {
			stack: error.stack,
			context,
			additionalData: this.safeStringify(additionalData),
		});
	}

	info(message: string, meta?: unknown): void {
		if (meta != null) {
			// If meta is an object, stringify it and append to message
			if (typeof meta === "object") {
				const metaStr = this.safeStringify(meta);
				logger.info(`${message} ${metaStr}`);
			} else {
				logger.info(`${message} ${this.safeStringify(meta)}`);
			}
		} else {
			logger.info(message);
		}
	}

	warn(message: string, meta?: unknown): void {
		if (meta != null) {
			// If meta is an object, stringify it and append to message
			if (typeof meta === "object") {
				const metaStr = this.safeStringify(meta);
				logger.warn(`${message} ${metaStr}`);
			} else {
				logger.warn(`${message} ${this.safeStringify(meta)}`);
			}
		} else {
			logger.warn(message);
		}
	}

	error(message: string, meta?: unknown): void {
		if (meta != null) {
			// If meta is an object, stringify it and append to message
			if (typeof meta === "object") {
				const metaStr = this.safeStringify(meta);
				logger.error(`${message} ${metaStr}`);
			} else {
				logger.error(`${message} ${this.safeStringify(meta)}`);
			}
		} else {
			logger.error(message);
		}
	}

	debug(message: string, meta?: unknown): void {
		if (meta != null) {
			// If meta is an object, stringify it and append to message
			if (typeof meta === "object") {
				const metaStr = this.safeStringify(meta);
				logger.debug(`${message} ${metaStr}`);
			} else {
				logger.debug(`${message} ${this.safeStringify(meta)}`);
			}
		} else {
			logger.debug(message);
		}
	}
}

export default new LoggingService();
