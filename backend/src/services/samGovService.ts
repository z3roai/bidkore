import axios, {
	type AxiosInstance,
	type AxiosResponse,
	type InternalAxiosRequestConfig,
} from "axios";

// RateLimiter will be imported dynamically in constructor
import config from "@/config/env";
import loggingService from "@/services/loggingService";

export interface SAMOpportunity {
	noticeId: string;
	title: string;
	solicitationNumber?: string;
	fullParentPathName?: string;
	fullParentPathCode?: string;
	postedDate?: string;
	type?: string;
	baseType?: string;
	archiveType?: string;
	archiveDate?: string;
	typeOfSetAsideDescription?: string;
	typeOfSetAside?: string;
	responseDeadLine?: string;
	naicsCode?: string;
	naicsCodes?: string[];
	classificationCode?: string;
	active?: string;
	award?: {
		number?: string;
		amount?: number;
		date?: string;
		awardee?: {
			name?: string;
			ueiSAM?: string;
			location?: {
				streetAddress?: string;
				streetAddress2?: string;
				city?: {
					code?: string;
					name?: string;
				};
				state?: {
					code?: string;
					name?: string;
				};
				country?: {
					code?: string;
					name?: string;
				};
				zip?: string;
			};
		};
	};
	pointOfContact?: PointOfContact[] | string;
	description?: string;
	organizationType?: string;
	officeAddress?: {
		city?: string;
		state?: string;
		zip?: string;
	};
	placeOfPerformance?: {
		streetAddress?: string;
		streetAddress2?: string;
		city?: {
			code?: string;
			name?: string;
		};
		state?: {
			code?: string;
			name?: string;
		};
		country?: {
			code?: string;
			name?: string;
		};
		zip?: string;
	};
	additionalInfoLink?: string;
	uiLink?: string;
	links?: {
		href?: string;
		rel?: string;
	}[];
	resourceLinks?: {
		href?: string;
		rel?: string;
	}[];
}

export interface PointOfContact {
	type?: string;
	title?: string;
	fullname?: string;
	email?: string;
	phone?: string;
	fax?: string;
	additionalInfo?: {
		content?: string;
	}[];
}

interface AxiosError {
	code?: string;
	response?: {
		status?: number;
		statusText?: string;
	};
	config?: {
		url?: string;
		params?: Record<string, unknown>;
	};
	message?: string;
}

export interface SAMSearchParams {
	q?: string;
	keyword?: string;
	naicsCode?: string;
	agency?: string;
	postedFrom?: Date | string;
	postedTo?: Date | string;
	responseDeadlineFrom?: Date | string;
	responseDeadlineTo?: Date | string;
	setAside?: string;
	type?: string;
	status?: string;
	limit?: number;
	offset?: number;
	sort?: string;
	order?: "asc" | "desc";
}

class SAMGovService {
	private readonly api: AxiosInstance;
	private readonly alphaApi: AxiosInstance;
	private limiter: { removeTokens: (count: number) => Promise<number> } | null =
		null;
	private readonly retryAttempts = 3; // Reduced retry attempts
	private readonly retryDelay = 2000;
	private circuitBreakerOpen = false;
	private circuitBreakerFailures = 0;
	private readonly circuitBreakerThreshold = 5;
	private readonly circuitBreakerTimeout = 60000; // 1 minute
	private lastFailureTime = 0;
	private useAlphaFallback = false;

	private readonly paramMapping: Record<keyof SAMSearchParams, string> = {
		q: "q",
		keyword: "q",
		naicsCode: "naicsCode",
		agency: "agency",
		postedFrom: "postedFrom",
		postedTo: "postedTo",
		responseDeadlineFrom: "responseDeadlineFrom",
		responseDeadlineTo: "responseDeadlineTo",
		setAside: "setAside",
		type: "type",
		status: "status",
		limit: "pageSize",
		offset: "pageNumber",
		sort: "sort",
		order: "order",
	};

	private readonly dateFields = new Set([
		"postedFrom",
		"postedTo",
		"responseDeadlineFrom",
		"responseDeadlineTo",
	]);

	constructor() {
		// Production API (correct endpoint from documentation)
		this.api = axios.create({
			baseURL: "https://api.sam.gov/prod/opportunities/v2",
			timeout: 60000, // Increased timeout for better reliability
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "SAM-SaaS/1.0",
			},
			maxRedirects: 5,
			validateStatus: status => status < 500, // Don't throw on 4xx errors
		});

		// Alpha API as fallback (from documentation)
		this.alphaApi = axios.create({
			baseURL: "https://api-alpha.sam.gov/opportunities/v2",
			timeout: 60000,
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "SAM-SaaS/1.0",
			},
			maxRedirects: 5,
			validateStatus: status => status < 500,
		});

		// Attach API key to both APIs
		const attachApiKey = (
			requestConfig: InternalAxiosRequestConfig
		): InternalAxiosRequestConfig => {
			const { apiKey } = config.samGov;
			if (apiKey) {
				requestConfig.params = {
					...(requestConfig.params as Record<string, unknown>),
					api_key: apiKey,
				};
			}
			return requestConfig;
		};

		this.api.interceptors.request.use(attachApiKey);
		this.alphaApi.interceptors.request.use(attachApiKey);

		// Rate limiter will be initialized lazily

		const attachRateLimiter = async (
			cfg: InternalAxiosRequestConfig
		): Promise<InternalAxiosRequestConfig> => {
			if (!this.limiter) {
				const { RateLimiter } = await import("limiter");
				this.limiter = new RateLimiter({
					tokensPerInterval: 10,
					interval: "minute",
				});
			}
			await this.limiter.removeTokens(1);
			return cfg;
		};

		this.api.interceptors.request.use(attachRateLimiter);
		this.alphaApi.interceptors.request.use(attachRateLimiter);

		// Circuit breaker and retry logic for both APIs
		const setupResponseInterceptor = (
			apiInstance: AxiosInstance,
			apiName: string
		): void => {
			apiInstance.interceptors.response.use(
				res => {
					// Reset circuit breaker on successful response
					this.circuitBreakerFailures = 0;
					this.circuitBreakerOpen = false;
					this.useAlphaFallback = false; // Reset fallback flag on success
					return res;
				},
				async (error: unknown) => {
					// Check circuit breaker
					if (this.isCircuitBreakerOpen()) {
						loggingService.warn(
							"[WARN] Circuit breaker is open - rejecting request"
						);
						throw new Error(
							"SAM.gov API is temporarily unavailable due to repeated failures. Please try again later."
						);
					}

					const axiosError = error as AxiosError;
					const cfg = axiosError.config as InternalAxiosRequestConfig & {
						__retryCount?: number;
					};
					if (!cfg || (cfg.__retryCount ?? 0) >= this.retryAttempts) {
						this.recordFailure();
						loggingService.error(
							`[ERROR] ${apiName} API request failed after ${this.retryAttempts} retries:`,
							axiosError.message
						);

						// Try alpha fallback if production fails
						if (apiName === "Production" && !this.useAlphaFallback) {
							loggingService.info("Attempting fallback to Alpha API");
							this.useAlphaFallback = true;
							return this.alphaApi(cfg);
						}

						return Promise.reject(error);
					}

					cfg.__retryCount = (cfg.__retryCount ?? 0) + 1;

					let waitTime = this.retryDelay * cfg.__retryCount;
					let errorType = "unknown";

					if (axiosError.response?.status === 429) {
						waitTime = Math.min(this.retryDelay * 2 ** cfg.__retryCount, 60000);
						errorType = "rate_limit";
						loggingService.warn(
							`[WARN] Rate limit (429) on ${apiName} — retry ${cfg.__retryCount} in ${waitTime}ms`
						);
					} else if (axiosError.response?.status === 500) {
						waitTime = Math.min(
							this.retryDelay * 3 ** cfg.__retryCount,
							120000
						);
						errorType = "server_error";
						loggingService.warn(
							`[WARN] Server error (500) on ${apiName} — retry ${cfg.__retryCount} in ${waitTime}ms`
						);
					} else if (
						axiosError.code === "ECONNABORTED" ||
						axiosError.message?.includes("timeout")
					) {
						waitTime = Math.min(5000 * cfg.__retryCount, 20000);
						errorType = "timeout";
						loggingService.warn(
							`[WARN] Timeout error on ${apiName} — retry ${cfg.__retryCount} in ${waitTime}ms`
						);
					} else if (axiosError.code === "ETIMEDOUT") {
						waitTime = Math.min(8000 * cfg.__retryCount, 30000);
						errorType = "connection timeout";
						loggingService.warn(
							`[WARN] Connection timeout on ${apiName} — retry ${cfg.__retryCount} in ${waitTime}ms`
						);
					} else {
						loggingService.warn(
							`[WARN] ${errorType} error on ${apiName} — retry ${cfg.__retryCount} in ${waitTime}ms`
						);
					}

					await new Promise(resolve => setTimeout(resolve, waitTime));
					return apiInstance(cfg);
				}
			);
		};

		setupResponseInterceptor(this.api, "Production");
		setupResponseInterceptor(this.alphaApi, "Alpha");
	}

	private isCircuitBreakerOpen(): boolean {
		if (!this.circuitBreakerOpen) {
			return false;
		}

		// Check if timeout period has passed
		if (Date.now() - this.lastFailureTime > this.circuitBreakerTimeout) {
			this.circuitBreakerOpen = false;
			this.circuitBreakerFailures = 0;
			loggingService.info(
				"Circuit breaker timeout expired - attempting to close"
			);
			return false;
		}

		return true;
	}

	private recordFailure(): void {
		this.circuitBreakerFailures++;
		this.lastFailureTime = Date.now();

		if (this.circuitBreakerFailures >= this.circuitBreakerThreshold) {
			this.circuitBreakerOpen = true;
			loggingService.warn(
				`[WARN] Circuit breaker opened after ${this.circuitBreakerFailures} failures`
			);
		}
	}

	async checkHealth(): Promise<{
		production: boolean;
		alpha: boolean;
		usingFallback: boolean;
	}> {
		const results = {
			production: false,
			alpha: false,
			usingFallback: this.useAlphaFallback,
		};

		try {
			// Test production API
			const prodResponse = await this.api.get("/search", {
				params: { pageSize: 1 },
				timeout: 10000, // Short timeout for health check
			});
			results.production = prodResponse.status === 200;
		} catch (error: unknown) {
			loggingService.warn(
				"[WARN] SAM.gov production health check failed:",
				error instanceof Error ? error.message : String(error)
			);
		}

		try {
			// Test alpha API
			const alphaResponse = await this.alphaApi.get("/search", {
				params: { pageSize: 1 },
				timeout: 10000,
			});
			results.alpha = alphaResponse.status === 200;
		} catch (error: unknown) {
			loggingService.warn(
				"[WARN] SAM.gov alpha health check failed:",
				error instanceof Error ? error.message : String(error)
			);
		}

		return results;
	}

	async searchOpportunities(
		params: SAMSearchParams
	): Promise<SAMOpportunity[]> {
		const _startTime = Date.now();
		const apiVersion = this.useAlphaFallback ? "alpha" : "production";

		try {
			// Check circuit breaker before making request
			if (this.isCircuitBreakerOpen()) {
				loggingService.warn(
					"[WARN] Circuit breaker is open - returning empty results"
				);
				return [];
			}

			loggingService.debug("SAM.gov search opportunities", params);

			const searchParams: Record<string, number | string> = {};

			for (const [key, apiKey] of Object.entries(this.paramMapping)) {
				const value = params[key as keyof SAMSearchParams];
				if (value != null) {
					if (this.dateFields.has(key)) {
						searchParams[apiKey] = this.formatDateForAPI(new Date(value));
					} else if (key === "limit") {
						const limitValue =
							typeof value === "number" ? value : Number(value);
						searchParams[apiKey] = Math.min(limitValue, 1000);
					} else if (key === "offset") {
						const offsetValue =
							typeof value === "number" ? value : Number(value);
						const limitValue =
							typeof params.limit === "number"
								? params.limit
								: Number(params.limit ?? 25);
						searchParams[apiKey] = Math.floor((offsetValue || 0) / limitValue);
					} else {
						searchParams[apiKey] =
							typeof value === "string" || typeof value === "number"
								? value
								: String(value);
					}
				}
			}

			// SAM.gov requires postedFrom and postedTo parameters
			// Set defaults if not provided
			searchParams["postedFrom"] ??= this.formatDateForAPI(
				new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
			);
			searchParams["postedTo"] ??= this.formatDateForAPI(new Date());

			// Choose API instance based on fallback state
			const apiInstance = this.useAlphaFallback ? this.alphaApi : this.api;
			const apiName = this.useAlphaFallback ? "Alpha" : "Production";

			loggingService.info(
				`Making SAM.gov ${apiName} API request with params:`,
				searchParams
			);

			const response: AxiosResponse<{ opportunitiesData: SAMOpportunity[] }> =
				await apiInstance.get("/search", { params: searchParams });

			loggingService.info("SAM.gov search response status:", response.status);
			loggingService.debug(
				"SAM.gov search response data count:",
				response.data.opportunitiesData?.length || 0
			);

			// Process opportunities to fetch actual descriptions if they contain URLs
			const opportunities = response.data.opportunitiesData ?? [];
			const processedOpportunities = await this.processOpportunityDescriptions(
				opportunities
			);

			// Record metrics for successful API call
			loggingService.debug(
				`[SAM SERVICE DEBUG] Search completed successfully: ${apiVersion}`
			);

			// Log opportunities discovered
			if (processedOpportunities.length > 0) {
				loggingService.debug(
					`[SAM SERVICE DEBUG] Opportunities found: ${processedOpportunities.length}`
				);
			}

			return processedOpportunities;
		} catch (error: unknown) {
			loggingService.error(
				"SAM.gov API search error:",
				error instanceof Error ? error.message : String(error)
			);
			const axiosError = error as AxiosError;
			loggingService.error("Error details:", {
				code: axiosError.code,
				status: axiosError.response?.status,
				statusText: axiosError.response?.statusText,
				url: axiosError.config?.url,
				params: axiosError.config?.params,
			});

			// Record metrics for failed API call
			// Duration and error type tracking could be implemented here

			// For network errors, return empty array instead of throwing
			if (
				axiosError.code === "ECONNABORTED" ||
				(error instanceof Error && error.message.includes("timeout"))
			) {
				loggingService.warn(
					"[WARN] Request timeout - returning empty results to prevent service disruption"
				);
				return [];
			}

			this.handleError(error);
		}
	}

	private async processOpportunityDescriptions(
		opportunities: SAMOpportunity[]
	): Promise<SAMOpportunity[]> {
		const processedOpportunities: SAMOpportunity[] = [];

		for (const opportunity of opportunities) {
			const processedOpp = { ...opportunity };

			// Check if description field contains a URL instead of actual content
			if (
				opportunity.description &&
				this.isDescriptionUrl(opportunity.description)
			) {
				try {
					loggingService.debug(
						`Fetching description from URL: ${opportunity.description}`
					);
					const descriptionContent = await this.fetchDescriptionFromUrl(
						opportunity.description
					);
					if (descriptionContent) {
						processedOpp.description = descriptionContent;
						loggingService.debug(
							`Successfully fetched description (${descriptionContent.length} chars)`
						);
					} else {
						loggingService.warn("[WARN] No description content found from URL");
					}
				} catch (error: unknown) {
					loggingService.warn(
						"[WARN] Failed to fetch description from URL:",
						error instanceof Error ? error.message : String(error)
					);
					// Keep the original description (URL) if fetch fails
				}
			}

			processedOpportunities.push(processedOpp);
		}

		return processedOpportunities;
	}

	private isDescriptionUrl(description: string): boolean {
		if (!description) {
			return false;
		}
		// Check if description is a URL to the noticedesc endpoint
		return (
			description.includes("api.sam.gov") && description.includes("noticedesc")
		);
	}

	async fetchDescriptionFromUrl(
		descriptionUrl: string
	): Promise<string | null> {
		try {
			const { apiKey } = config.samGov;
			if (!apiKey) {
				throw new Error("SAM.gov API key is not configured");
			}

			const url = new URL(descriptionUrl);
			url.searchParams.set("api_key", apiKey);

			const response = await axios.get(url.toString(), {
				timeout: 30000,
				headers: {
					"Content-Type": "application/json",
					"User-Agent": "SAM-SaaS/1.0",
				},
			});

			if (
				response.data &&
				typeof response.data === "object" &&
				"description" in response.data
			) {
				return (response.data as { description: string }).description;
			}

			return null;
		} catch (error: unknown) {
			loggingService.error(
				`[ERROR] Failed to fetch description from URL ${descriptionUrl}:`,
				error instanceof Error ? error.message : String(error)
			);
			throw error;
		}
	}

	async getOpportunityDetails(
		noticeId: string
	): Promise<SAMOpportunity | null> {
		try {
			const response: AxiosResponse<{ opportunitiesData: SAMOpportunity[] }> =
				await this.api.get("/search", { params: { noticeId } });

			const opportunity = response.data.opportunitiesData[0] ?? null;
			if (!opportunity) {
				return null;
			}

			// Process description if it's a URL
			if (
				opportunity.description &&
				this.isDescriptionUrl(opportunity.description)
			) {
				try {
					const descriptionContent = await this.fetchDescriptionFromUrl(
						opportunity.description
					);
					if (descriptionContent) {
						opportunity.description = descriptionContent;
					}
				} catch (error: unknown) {
					loggingService.warn(
						`[WARN] Failed to fetch description for ${noticeId}:`,
						error instanceof Error ? error.message : String(error)
					);
				}
			}

			return opportunity;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 404) {
				return null;
			}
			loggingService.error(
				`Error fetching details for ${noticeId}:`,
				error instanceof Error ? error.message : String(error)
			);
			throw new Error(
				`Failed to get opportunity details: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	async downloadAttachment(
		attachmentUrl: string,
		cookies?: string
	): Promise<Buffer> {
		try {
			const headers: Record<string, string> = {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
			};
			if (cookies) {
				headers["Cookie"] = cookies;
			}

			const response = await axios.get(attachmentUrl, {
				headers,
				responseType: "arraybuffer",
				timeout: 60000,
			});

			return Buffer.from(response.data);
		} catch (error: unknown) {
			loggingService.error(
				`Attachment download error for ${attachmentUrl}:`,
				error instanceof Error ? error.message : String(error)
			);

			throw new Error(
				`Failed to download attachment: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	getOpportunityAttachments(
		noticeId: string
	): Promise<{ name: string; url: string; size?: number }[]> {
		loggingService.warn(`Attachments endpoint not supported for ${noticeId}`);
		return Promise.resolve([]);
	}

	async getOpportunityDescription(
		noticeId: string
	): Promise<{ description: string } | null> {
		try {
			const response: AxiosResponse<{ description: string }> =
				await this.api.get("/noticedesc", { params: { noticeid: noticeId } });
			return response.data;
		} catch (error: unknown) {
			loggingService.error(
				`Description fetch error for ${noticeId}:`,
				error instanceof Error ? error.message : String(error)
			);
			return null;
		}
	}

	buildSearchQuery(keywords: string[]): string {
		return keywords.join(" OR ");
	}

	validateNAICSCode(naicsCode: string): boolean {
		return /^\d{6}$/.test(naicsCode);
	}

	formatDateForAPI(date: Date): string {
		return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
			date.getDate()
		).padStart(2, "0")}/${date.getFullYear()}`;
	}

	transformPointOfContact(
		poc: PointOfContact[] | string | undefined
	): string | undefined {
		if (!poc) {
			return undefined;
		}
		if (typeof poc === "string") {
			return poc;
		}
		if (Array.isArray(poc)) {
			return poc
				.map(c => {
					if (typeof c === "string") {
						return c;
					}
					if (typeof c === "object" && c !== null) {
						return [
							c.fullname && `Name: ${c.fullname}`,
							c.email && `Email: ${c.email}`,
							c.phone && `Phone: ${c.phone}`,
							c.title && `Title: ${c.title}`,
						]
							.filter(Boolean)
							.join(", ");
					}
					return String(c);
				})
				.join("; ");
		}
		return String(poc);
	}

	private handleError(error: unknown): never {
		const axiosError = error as AxiosError;
		const status = axiosError.response?.status;
		const { code } = axiosError;

		if (
			code === "ECONNABORTED" ||
			(error instanceof Error && error.message.includes("timeout"))
		) {
			throw new Error(
				"Request timeout. SAM.gov API is taking too long to respond. Please try again."
			);
		} else if (status === 500) {
			throw new Error("SAM.gov server error (500). Please try again later.");
		} else if (status === 429) {
			throw new Error(
				"Rate limit exceeded (429). Please wait before retrying."
			);
		} else if (status === 403) {
			throw new Error(
				"Access forbidden (403). Invalid API key or insufficient permissions."
			);
		} else if (status === 400) {
			throw new Error(
				"Bad request (400). Invalid parameters sent to SAM.gov API."
			);
		} else if (status === 404) {
			throw new Error(
				"SAM.gov API endpoint not found (404). Please check the API configuration."
			);
		}
		throw new Error(
			`Failed to call SAM.gov API: ${
				error instanceof Error ? error.message : String(error)
			}`
		);
	}
}

export default new SAMGovService();
