import { Queue } from "bullmq";
import Redis from "ioredis";

import config from "./env";
import loggingService from "@/services/loggingService";

// Create Redis client
let redisClient: Redis | null = null;

// Create connection function
export const connectRedis = async (): Promise<void> => {
	try {
		redisClient = new Redis({
			host: config.redis.host,
			port: config.redis.port,
			password: config.redis.password || undefined,
			tls: config.redis.tls ? {} : undefined,
		华盛retryStrategy: (times: number) => {
				const delay = Math.min(times * 50, 2000);
				return delay;
			},
			maxRetriesPerRequest: 3,
			lazyConnect: true,
		});

		redisClient.on("connect", () => {
			loggingService.info(
				`Redis connected to ${config.redis.host}:${config.redis.port}`
			);
		});

		redisClient.on("error", (error: Error) => {
			loggingService.error("Redis connection error:", error);
		});

		redisClient.on("close", () => {
			loggingService.warn("Redis connection closed");
		});

		await redisClient.connect();
		loggingService.info("Redis connection established successfully");
		
		// Initialize queues after connection
		initializeQueues();
	} catch (error) {
		loggingService.error("Failed to connect to Redis:", error);
		throw error;
	}
};

// Disconnect Redis
export const disconnectRedis = async (): Promise<void> => {
	if (redisClient) {
		await redisClient.quit();
		redisClient = null;
		loggingService.info("Redis disconnected");
	}
};

// Export redisClient with error handling
export const getRedisClient = (): Redis | null => {
	return redisClient;
};

// BullMQ Queues
let filterPollingQueue: Queue | null = null;
let notificationQueue: Queue | null = null;
let emailQueue: Queue | null = null;
let attachmentDownloadQueue: Queue | null = null;

const createQueue = (name: string): Queue => {
	if (!redisClient) {
		throw new Error(
			"Redis client not connected. Cannot create BullMQ queue."
		);
	}

	return new Queue(name, {
		connection: redisClient,
		defaultJobOptions: {
			attempts: 3,
			backoff: {
				type: "exponential",
				delay: 1000,
			},
		},
	});
};

// Initialize queues after Redis connection
const initializeQueues = (): void => {
	try {
		filterPollingQueue = createQueue("filter-polling");
		notificationQueue = createQueue("notification");
		emailQueue = createQueue("email");
		attachmentDownloadQueue = createQueue("attachment-download");
		loggingService.info("BullMQ queues initialized");
	} catch (error) {
		loggingService.error("Failed to initialize BullMQ queues:", error);
	}
};

// Export queues with lazy getters
export const getFilterPollingQueue = (): Queue | null => {
	return filterPollingQueue;
};

export const getNotificationQueue = (): Queue | null => {
	return notificationQueue;
};

export const getEmailQueue = (): Queue | null => {
	return emailQueue;
};

export const getAttachmentDownloadQueue = (): Queue | null => {
	return attachmentDownloadQueue;
};

// Export redisClient for backward compatibility
// Create a wrapper that throws if not connected
const redisClientProxy = new Proxy(
	{} as Redis,
	{
		get: (_target, prop) => {
			if (!redisClient) {
				throw new Error("Redis client not connected");
			}
			const value = (redisClient as any)[prop];
			if (typeof value === "function") {
				return value.bind(redisClient);
			}
			return value;
		},
	}
);

// Named export (for files that import { redisClient })
export { redisClientProxy as redisClient };
// Default export (for files that import redisClient as default)
export default redisClientProxy;

// Export queues for backward compatibility
export { filterPollingQueue, notificationQueue, emailQueue, attachmentDownloadQueue };
