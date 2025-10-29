import axios, {
	type AxiosInstance,
	type AxiosResponse,
	type InternalAxiosRequestConfig,
} from "axios";

import config from "@/config/env";
import loggingService from "@/services/loggingService";
import openaiService from "@/services/openaiService";
import { parseJson } from "@/utils/jsonParser";

interface AxiosError {
	config?: InternalAxiosRequestConfig & { __retryCount?: number };
	response?: { status?: number; statusText?: string };
	code?: string;
	message?: string;
}

export interface EntityInfo {
	entity_id: string;
	legal_business_name: string;
	duns_number: string;
	cage_code: string;
	uei: string;
	registration_status: string;
	exclusion_status: string;
	socioeconomic_status: string[];
	business_types: string[];
	address: {
		street_address: string;
		city: string;
		state: string;
		zip_code: string;
		country: string;
	};
	point_of_contact: {
		name: string;
		email: string;
		phone: string;
		title: string;
	};
	naics_codes: {
		code: string;
		description: string;
		primary: boolean;
	}[];
	psc_codes: {
		code: string;
		description: string;
	}[];
	certifications: {
		type: string;
		status: string;
		expiration_date: string;
	}[];
	small_business_designations: string[];
	set_aside_eligibility: string[];
	last_updated: string;
}

export interface EntitySearchParams {
	uei?: string;
	duns_number?: string;
	cage_code?: string;
	legal_business_name?: string;
	naics_code?: string;
	psc_code?: string;
	socioeconomic_status?: string;
	business_type?: string;
	registration_status?: string;
	exclusion_status?: string;
	state?: string;
	city?: string;
	zip_code?: string;
	limit?: number;
	page?: number;
}

export interface EntitySummary {
	total_entities: number;
	small_business_count: number;
	socioeconomic_counts: Record<string, number>;
	business_type_counts: Record<string, number>;
	state_distribution: Record<string, number>;
	naics_distribution: Record<string, number>;
}

class EntityManagementService {
	private readonly api: AxiosInstance;
	private readonly retryAttempts = 3;
	private readonly retryDelay = 2000;
	private circuitBreakerOpen = false;
	private circuitBreakerFailures = 0;
	private readonly circuitBreakerThreshold = 5;
	private readonly circuitBreakerTimeout = 60000; // 1 minute
	private lastFailureTime = 0;

	constructor() {
		this.api = axios.create({
			baseURL: "https://api.sam.gov/prod/entity-information/v4",
			timeout: 60000,
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				"User-Agent": "BidKore/1.0",
			},
			maxRedirects: 5,
			validateStatus: status => status < 500,
		});

		// Attach API key to requests
		const attachApiKey = (
			requestConfig: InternalAxiosRequestConfig
		): InternalAxiosRequestConfig => {
			const { apiKey } = config.samGov;
			if (apiKey) {
				// SAM.gov Entity API uses api_key as query parameter
				requestConfig.params = {
					...(requestConfig.params as Record<string, unknown>),
					api_key: apiKey,
				};
			}
			return requestConfig;
		};

		this.api.interceptors.request.use(attachApiKey);

		// Rate limiter setup
		const attachRateLimiter = async (
			cfg: InternalAxiosRequestConfig
		): Promise<InternalAxiosRequestConfig> => {
			// SAM.gov Entity Management has rate limits similar to opportunities API
			await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay between requests
			return cfg;
		};

		this.api.interceptors.request.use(attachRateLimiter);

		// Circuit breaker and retry logic
		this.setupResponseInterceptor();
	}

	/**
	 * Generate enhanced search parameters using AI for intelligent defaults
	 * This helps avoid 400 errors when user provides minimal search criteria
	 */
	private async generateEnhancedSearchParams(
		params: EntitySearchParams
	): Promise<Record<string, number | string>> {
		const searchParams: Record<string, number | string> = {
			limit: Math.min(params.limit ?? 25, 100), // Cap at 100
			page: params.page ?? 1,
		};

		// Add user-provided search parameters
		if (params.uei) {
			searchParams["uei"] = params.uei;
		}
		if (params.duns_number) {
			searchParams["duns"] = params.duns_number;
		}
		if (params.cage_code) {
			searchParams["cage"] = params.cage_code;
		}
		if (params.legal_business_name) {
			searchParams["name"] = params.legal_business_name;
		}
		if (params.naics_code) {
			searchParams["naics"] = params.naics_code;
		}
		if (params.psc_code) {
			searchParams["psc"] = params.psc_code;
		}
		if (params.socioeconomic_status) {
			searchParams["socioeconomic"] = params.socioeconomic_status;
		}
		if (params.business_type) {
			searchParams["business_type"] = params.business_type;
		}
		if (params.state) {
			searchParams["state"] = params.state;
		}
		if (params.city) {
			searchParams["city"] = params.city;
		}
		if (params.zip_code) {
			searchParams["zip"] = params.zip_code;
		}

		// Add sensible defaults for required parameters
		searchParams["samRegistered"] = "Yes"; // Default to registered entities
		searchParams["registration_status"] =
			params.registration_status ?? "Active";
		searchParams["exclusion_status"] =
			params.exclusion_status ?? "Not Excluded";

		// Check if we need AI to generate intelligent defaults
		const hasSpecificCriteria =
			params.uei ||
			params.duns_number ||
			params.cage_code ||
			params.legal_business_name ||
			params.naics_code ||
			params.psc_code ||
			params.socioeconomic_status ||
			params.business_type ||
			params.state ||
			params.city ||
			params.zip_code;

		if (!hasSpecificCriteria) {
			// Use AI to generate intelligent search parameters
			try {
				const aiGeneratedParams = await this.generateAISearchParameters(params);
				Object.assign(searchParams, aiGeneratedParams);
				loggingService.debug(
					"AI-generated search parameters applied:",
					aiGeneratedParams
				);
			} catch (error) {
				loggingService.warn(
					"AI parameter generation failed, using fallback defaults:",
					error
				);
				// Fallback to static defaults if AI fails
				searchParams["naics"] = "541519"; // Other Computer Related Services
				searchParams["business_type"] = "Corporation";
				searchParams["state"] = "CA";
			}
		}

		return searchParams;
	}

	/**
	 * Use AI to generate intelligent search parameters based on context
	 */
	private async generateAISearchParameters(
		params: EntitySearchParams
	): Promise<Record<string, string>> {
		// Check if AI service is available
		const isAvailable = openaiService.isServiceAvailable();
		if (!isAvailable) {
			throw new Error("AI service not available");
		}

		const prompt = this.buildAISearchPrompt(params);

		try {
			const aiResponse = await openaiService.callOpenAICompletion(prompt);
			const parsedResponse = this.parseAISearchResponse(aiResponse);
			return parsedResponse;
		} catch (error) {
			loggingService.error("AI search parameter generation failed:", error);
			throw error;
		}
	}

	/**
	 * Build AI prompt for generating search parameters
	 */
	private buildAISearchPrompt(params: EntitySearchParams): string {
		return `You are an expert government contracting analyst. Generate intelligent search parameters for the SAM.gov Entity API based on the provided context.

Context:
- User provided parameters: ${JSON.stringify(params, null, 2)}
- Current timestamp: ${new Date().toISOString()}

Generate search parameters that will help find relevant government contractors. Consider:
1. Industry trends and common contractor types
2. Geographic distribution of government contractors
3. Business types that typically work with government
4. NAICS codes relevant to government contracting
5. Socioeconomic statuses that are common in government contracting

Return ONLY a JSON object with the following structure:
{
  "naics": "6-digit NAICS code",
  "business_type": "Corporation|Partnership|LLC|Sole Proprietorship|Non-Profit|Government|Other",
  "state": "2-letter state code",
  "socioeconomic": "Small Business|8(a)|HUBZone|SDVOSB|WOSB|VOSB|EDWOSB|Large Business",
  "explanation": "Brief explanation of why these parameters were chosen"
}

Guidelines:
- Use realistic, commonly used values
- Focus on parameters that will return meaningful results
- Consider the current government contracting landscape
- Ensure all values are valid for the SAM.gov API
- Provide diverse but relevant results`;
	}

	/**
	 * Parse AI response for search parameters with enhanced format support
	 */
	private parseAISearchResponse(aiResponse: string): Record<string, string> {
		try {
			const parseResult = parseJson<Record<string, string>>(aiResponse);

			if (!parseResult.success || !parseResult.data) {
				throw new Error(`JSON parsing failed: ${parseResult.error}`);
			}

			const parsed = parseResult.data;

			// Validate and clean the response
			const result: Record<string, string> = {};

			// Handle NAICS codes (single or multiple comma-separated)
			if (parsed["naics"]) {
				const naicsCodes = parsed["naics"].split(",").map(code => code.trim());
				const validNaics = naicsCodes.filter(code =>
					this.isValidNaicsCode(code)
				);
				if (validNaics.length > 0) {
					result["naics"] = validNaics.join(",");
				}
			}

			// Handle business type
			if (
				parsed["business_type"] &&
				this.isValidBusinessType(parsed["business_type"])
			) {
				result["business_type"] = parsed["business_type"];
			}

			// Handle state codes (single or multiple comma-separated)
			if (parsed["state"]) {
				const stateCodes = parsed["state"].split(",").map(code => code.trim());
				const validStates = stateCodes.filter(code =>
					this.isValidStateCode(code)
				);
				if (validStates.length > 0) {
					result["state"] = validStates.join(",");
				}
			}

			// Handle socioeconomic status
			if (parsed["socioeconomic"]) {
				result["socioeconomic"] = parsed["socioeconomic"];
			}

			// Handle optional enhanced parameters
			if (parsed["city"]) {
				result["city"] = parsed["city"];
			}
			if (parsed["zip"]) {
				result["zip"] = parsed["zip"];
			}
			if (parsed["duns"]) {
				result["duns"] = parsed["duns"];
			}
			if (parsed["cage"]) {
				result["cage"] = parsed["cage"];
			}

			// Log the AI's explanation and enhancement details
			if (parsed["explanation"]) {
				loggingService.info(
					"[AI Query Enhancement] Enhancement explanation:",
					parsed["explanation"]
				);
			}

			// Log enhancement metadata
			if (parsed["enhancement_type"]) {
				loggingService.debug(
					"[AI Query Enhancement] Enhancement type:",
					parsed["enhancement_type"]
				);
			}

			if (parsed["confidence"]) {
				loggingService.debug(
					"[AI Query Enhancement] Confidence level:",
					parsed["confidence"]
				);
			}

			return result;
		} catch (error) {
			loggingService.error("Failed to parse AI search response:", error);
			throw new Error("Invalid AI response format");
		}
	}

	/**
	 * Generate AI-powered enhanced parameters using GPT-5 for weak queries
	 */
	private async generateAIMinimalParameters(
		params: EntitySearchParams
	): Promise<Record<string, string>> {
		// Check if AI service is available
		const isAvailable = openaiService.isServiceAvailable();
		if (!isAvailable) {
			throw new Error("AI service not available");
		}

		// Analyze query strength and enhance if weak
		const queryStrength = this.analyzeQueryStrength(params);
		loggingService.info("[AI Query Enhancement] Analyzing query strength:", {
			strength: queryStrength,
			params: Object.keys(params),
		});

		if (queryStrength === "strong") {
			// Query is already strong, just return minimal safe parameters
			return this.getMinimalSafeParameters();
		}

		// Use GPT-5 to enhance weak queries
		const prompt = `You are an expert government contracting analyst with access to GPT-5's advanced capabilities. The SAM.gov Entity API returned a 400 error due to weak or overly restrictive parameters.

Your task is to analyze the original query and enhance it using your comprehensive knowledge of:
- Government contracting patterns and trends
- NAICS code distributions and market dynamics
- Geographic contractor concentrations
- Socioeconomic status patterns in federal contracting
- Common business structures in government contracting
- Agency-specific contractor preferences

ORIGINAL PARAMETERS: ${JSON.stringify(params, null, 2)}

QUERY STRENGTH ANALYSIS: ${queryStrength}

Using your advanced knowledge base, enhance this query by:

1. **NAICS Code Intelligence**: If no NAICS or weak NAICS provided, suggest the most relevant 6-digit NAICS codes based on:
   - Market size and activity levels
   - Government spending patterns
   - Contractor density in that sector
   - Growth trends and emerging opportunities

2. **Geographic Optimization**: If no location specified, recommend states/regions with:
   - High contractor density
   - Strong government contracting presence
   - Relevant industry clusters
   - Favorable business environments

3. **Business Type Enhancement**: If no business type specified, suggest types that:
   - Are common in government contracting
   - Have high success rates
   - Match the NAICS sector patterns

4. **Socioeconomic Status Intelligence**: If no socioeconomic status specified, recommend statuses that:
   - Are frequently used in the target NAICS
   - Have competitive advantages
   - Match market trends

5. **Query Expansion**: Add relevant parameters that will:
   - Increase result relevance
   - Improve search precision
   - Leverage your knowledge of contracting patterns

Return a JSON object with enhanced parameters:
{
  "naics": "6-digit NAICS code (or multiple comma-separated codes)",
  "business_type": "Corporation|Partnership|LLC|Sole Proprietorship|Non-Profit|Government|Other",
  "state": "2-letter state code (or multiple comma-separated codes)",
  "socioeconomic": "Small Business|8(a)|HUBZone|SDVOSB|WOSB|VOSB|EDWOSB|Large Business",
  "city": "city name (optional)",
  "zip": "zip code (optional)",
  "duns": "DUNS number (optional)",
  "cage": "CAGE code (optional)",
  "explanation": "Detailed explanation of enhancement strategy and reasoning",
  "confidence": "0-100 confidence in the enhanced parameters",
  "enhancement_type": "naics_expansion|geographic_optimization|business_type_enhancement|socioeconomic_intelligence|comprehensive_enhancement"
}

Use your comprehensive knowledge to make intelligent, data-driven enhancements that will return relevant, high-quality results.`;

		try {
			const aiResponse = await openaiService.callOpenAICompletion(prompt);
			const parsedResponse = this.parseAISearchResponse(aiResponse);

			loggingService.info(
				"[AI Query Enhancement] Enhanced parameters generated:",
				{
					enhancementType: parsedResponse["enhancement_type"],
					confidence: parsedResponse["confidence"],
					explanation: parsedResponse["explanation"],
				}
			);

			return parsedResponse;
		} catch (error) {
			loggingService.error("AI query enhancement failed:", error);
			// Fallback to minimal safe parameters
			return this.getMinimalSafeParameters();
		}
	}

	/**
	 * Analyze the strength of the search query
	 */
	private analyzeQueryStrength(
		params: EntitySearchParams
	): "weak" | "moderate" | "strong" {
		const paramCount = Object.keys(params).length;
		const hasSpecificCriteria = !!(
			params.naics_code ||
			params.duns_number ||
			params.cage_code ||
			params.uei
		);
		const hasLocation = !!(params.state || params.city || params.zip_code);
		const hasBusinessInfo = !!(
			params.business_type || params.socioeconomic_status
		);

		// Strong query: has specific identifiers or multiple criteria
		if (
			hasSpecificCriteria ||
			(paramCount >= 3 && hasLocation && hasBusinessInfo)
		) {
			return "strong";
		}

		// Moderate query: has some criteria but not comprehensive
		if (paramCount >= 2 || hasLocation || hasBusinessInfo) {
			return "moderate";
		}

		// Weak query: minimal or no criteria
		return "weak";
	}

	/**
	 * Get minimal safe parameters as fallback
	 */
	private getMinimalSafeParameters(): Record<string, string> {
		return {
			naics: "541519", // Other Computer Related Services - broad, active sector
			business_type: "Corporation",
			state: "VA", // Virginia - high contractor density
			socioeconomic: "Small Business",
			explanation: "Minimal safe parameters for fallback",
			confidence: "50",
			enhancement_type: "fallback",
		};
	}

	/**
	 * Validate NAICS code format (6-digit number)
	 */
	private isValidNaicsCode(naicsCode: string): boolean {
		return /^\d{6}$/.test(naicsCode);
	}

	/**
	 * Validate state code format (2-letter uppercase)
	 */
	private isValidStateCode(stateCode: string): boolean {
		const validStates = [
			"AL",
			"AK",
			"AZ",
			"AR",
			"CA",
			"CO",
			"CT",
			"DE",
			"FL",
			"GA",
			"HI",
			"ID",
			"IL",
			"IN",
			"IA",
			"KS",
			"KY",
			"LA",
			"ME",
			"MD",
			"MA",
			"MI",
			"MN",
			"MS",
			"MO",
			"MT",
			"NE",
			"NV",
			"NH",
			"NJ",
			"NM",
			"NY",
			"NC",
			"ND",
			"OH",
			"OK",
			"OR",
			"PA",
			"RI",
			"SC",
			"SD",
			"TN",
			"TX",
			"UT",
			"VT",
			"VA",
			"WA",
			"WV",
			"WI",
			"WY",
			"DC",
			"PR",
			"VI",
			"GU",
			"AS",
			"MP",
		];
		return validStates.includes(stateCode.toUpperCase());
	}

	/**
	 * Validate business type format
	 */
	private isValidBusinessType(businessType: string): boolean {
		const validTypes = [
			"Corporation",
			"Partnership",
			"LLC",
			"Sole Proprietorship",
			"Non-Profit",
			"Government",
			"Other",
		];
		return validTypes.some(type =>
			businessType.toLowerCase().includes(type.toLowerCase())
		);
	}

	private setupResponseInterceptor(): void {
		this.api.interceptors.response.use(
			res => {
				// Reset circuit breaker on successful response
				this.circuitBreakerFailures = 0;
				this.circuitBreakerOpen = false;
				return res;
			},
			async error => {
				// Check circuit breaker
				if (this.isCircuitBreakerOpen()) {
					loggingService.warn(
						"[WARN] Entity Management circuit breaker is open - rejecting request"
					);
					throw new Error(
						"SAM.gov Entity Management API is temporarily unavailable due to repeated failures. Please try again later."
					);
				}

				const cfg = (error as AxiosError).config;
				if (!cfg || (cfg.__retryCount ?? 0) >= this.retryAttempts) {
					this.recordFailure();
					const errorMessage = (error as AxiosError).message ?? "Unknown error";
					loggingService.error(
						"[ERROR] Entity Management API request failed after retries:",
						errorMessage
					);
					return Promise.reject(error);
				}

				cfg.__retryCount = (cfg.__retryCount ?? 0) + 1;

				let waitTime = this.retryDelay * cfg.__retryCount;

				if ((error as AxiosError).response?.status === 429) {
					waitTime = Math.min(this.retryDelay * 2 ** cfg.__retryCount, 60000);
					loggingService.warn(
						`[WARN] Rate limit (429) on Entity Management — retry ${cfg.__retryCount} in ${waitTime}ms`
					);
				} else if ((error as AxiosError).response?.status === 500) {
					waitTime = Math.min(this.retryDelay * 3 ** cfg.__retryCount, 120000);
					loggingService.warn(
						`[WARN] Server error (500) on Entity Management — retry ${cfg.__retryCount} in ${waitTime}ms`
					);
				} else if (
					(error as AxiosError).code === "ECONNABORTED" ||
					(error as AxiosError).message?.includes("timeout")
				) {
					waitTime = Math.min(5000 * cfg.__retryCount, 20000);
					loggingService.warn(
						`[WARN] Timeout error on Entity Management — retry ${cfg.__retryCount} in ${waitTime}ms`
					);
				}

				await new Promise(resolve => setTimeout(resolve, waitTime));
				return this.api(cfg);
			}
		);
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
				"Entity Management circuit breaker timeout expired - attempting to close"
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
				`[WARN] Entity Management circuit breaker opened after ${this.circuitBreakerFailures} failures`
			);
		}
	}

	async checkHealth(): Promise<boolean> {
		try {
			const response = await this.api.get("/entities", {
				params: { limit: 1 },
				timeout: 10000,
			});
			return response.status === 200;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			loggingService.warn(
				"[WARN] SAM.gov Entity Management health check failed:",
				errorMessage
			);
			return false;
		}
	}

	async getEntityByUei(uei: string): Promise<EntityInfo | null> {
		try {
			// Check circuit breaker before making request
			if (this.isCircuitBreakerOpen()) {
				loggingService.warn("[WARN] Circuit breaker is open - returning null");
				return null;
			}

			loggingService.debug("SAM.gov Entity Management get entity by UEI", {
				uei,
			});

			const response: AxiosResponse<{ entityData: EntityInfo[] }> =
				await this.api.get("/entities", {
					params: {
						uei,
						limit: 1,
					},
				});

			const entity = response.data.entityData?.[0] ?? null;

			if (entity) {
				loggingService.info("Entity found for UEI:", uei);
			} else {
				loggingService.warn("No entity found for UEI:", uei);
			}

			return entity;
		} catch (error: unknown) {
			const axiosError = error as {
				response?: { status?: number };
				message?: string;
			};
			if (axiosError.response?.status === 404) {
				return null;
			}
			const errorMessage = axiosError.message ?? "Unknown error";
			loggingService.error(
				`Error fetching entity for UEI ${uei}:`,
				errorMessage
			);
			return null;
		}
	}

	async getEntityByDuns(dunsNumber: string): Promise<EntityInfo | null> {
		try {
			// Check circuit breaker before making request
			if (this.isCircuitBreakerOpen()) {
				loggingService.warn("[WARN] Circuit breaker is open - returning null");
				return null;
			}

			loggingService.debug("SAM.gov Entity Management get entity by DUNS", {
				dunsNumber,
			});

			const response: AxiosResponse<{ entityData: EntityInfo[] }> =
				await this.api.get("/entities", {
					params: {
						duns: dunsNumber,
						limit: 1,
						samRegistered: "Yes",
						registration_status: "Active",
						exclusion_status: "Not Excluded",
					},
				});

			const entity = response.data.entityData?.[0] ?? null;

			if (entity) {
				loggingService.info("Entity found for DUNS:", dunsNumber);
			} else {
				loggingService.warn("No entity found for DUNS:", dunsNumber);
			}

			return entity;
		} catch (error: unknown) {
			const axiosError = error as {
				response?: {
					status?: number;
					data?: {
						message?: string;
						detail?: string;
						title?: string;
					};
				};
				message?: string;
			};

			// Handle specific SAM.gov error codes
			if (axiosError.response?.status === 400) {
				const errorData = axiosError.response.data;
				loggingService.error(
					`SAM.gov Entity API 400 Error for DUNS ${dunsNumber}:`,
					errorData?.message || errorData?.title || "Invalid request parameters"
				);
				return null;
			}

			if (axiosError.response?.status === 401) {
				loggingService.error(
					`SAM.gov Entity API 401 Error for DUNS ${dunsNumber}:`,
					"Unauthorized - Check API key and system account credentials"
				);
				return null;
			}

			if (axiosError.response?.status === 403) {
				loggingService.error(
					`SAM.gov Entity API 403 Error for DUNS ${dunsNumber}:`,
					"Forbidden - Invalid API key or insufficient privileges"
				);
				return null;
			}

			if (axiosError.response?.status === 404) {
				return null;
			}

			if (axiosError.response?.status === 406) {
				loggingService.error(
					`SAM.gov Entity API 406 Error for DUNS ${dunsNumber}:`,
					"Invalid Accept header - API requires application/json"
				);
				return null;
			}

			if (axiosError.response?.status === 415) {
				loggingService.error(
					`SAM.gov Entity API 415 Error for DUNS ${dunsNumber}:`,
					"Invalid Content-Type header - API requires application/json"
				);
				return null;
			}

			const errorMessage = axiosError.message ?? "Unknown error";
			loggingService.error(
				`Error fetching entity for DUNS ${dunsNumber}:`,
				errorMessage
			);
			return null;
		}
	}

	async searchEntities(params: EntitySearchParams): Promise<EntityInfo[]> {
		const startTime = Date.now();

		try {
			// Check circuit breaker before making request
			if (this.isCircuitBreakerOpen()) {
				loggingService.warn(
					"[WARN] Circuit breaker is open - returning empty results"
				);
				return [];
			}

			loggingService.debug("SAM.gov Entity Management search entities", params);

			// Generate enhanced parameters with AI-powered intelligent defaults for sparse payloads
			const searchParams = await this.generateEnhancedSearchParams(params);

			loggingService.info(
				"Making SAM.gov Entity Management API request with enhanced params:",
				searchParams
			);

			let response: AxiosResponse<{ entityData: EntityInfo[] }> =
				await this.api.get("/entities", { params: searchParams });

			// If 400, retry with GPT-5 enhanced query parameters
			if (response.status === 400) {
				loggingService.warn(
					"[WARN] Entity Management 400 — retrying with GPT-5 enhanced parameters",
					{ originalParams: searchParams }
				);

				try {
					// Use GPT-5 to enhance weak queries with intelligent parameters
					const enhancedParams = await this.generateAIMinimalParameters(params);

					// Build enhanced search parameters
					const enhancedSearchParams: Record<string, number | string> = {
						limit: Math.min(params.limit ?? 25, 50),
						page: params.page ?? 1,
						samRegistered: "Yes",
						registration_status: "Active",
						exclusion_status: "Not Excluded",
						...enhancedParams,
					};

					loggingService.info(
						"[AI Query Enhancement] Retrying with enhanced parameters:",
						{
							enhancedParams,
							enhancementType: enhancedParams["enhancement_type"],
							confidence: enhancedParams["confidence"],
						}
					);

					response = await this.api.get("/entities", {
						params: enhancedSearchParams,
					});
				} catch (error) {
					loggingService.warn(
						"GPT-5 query enhancement failed, using static fallback:",
						error
					);

					// Fallback to static minimal parameters
					const minimalParams: Record<string, number | string> = {
						limit: Math.min(params.limit ?? 25, 50),
						page: params.page ?? 1,
						samRegistered: "Yes",
						registration_status: "Active",
						exclusion_status: "Not Excluded",
						naics: "541519", // Other Computer Related Services
					};

					response = await this.api.get("/entities", {
						params: minimalParams,
					});
				}
			}

			const duration = Date.now() - startTime;

			loggingService.info(
				"SAM.gov Entity Management search response status:",
				response.status
			);
			loggingService.debug(
				"SAM.gov Entity Management search response data count:",
				response.data.entityData?.length || 0
			);

			const entities = response.data.entityData ?? [];

			// Record metrics for successful API call
			loggingService.debug(
				`[ENTITY MANAGEMENT SERVICE DEBUG] Search completed successfully: ${duration}ms`
			);

			// Log entities discovered
			if (entities.length > 0) {
				loggingService.debug(
					`[ENTITY MANAGEMENT SERVICE DEBUG] Entities found: ${entities.length}`
				);
			}

			return entities;
		} catch (error: unknown) {
			const axiosError = error as {
				code?: string;
				message?: string;
				response?: {
					status?: number;
					statusText?: string;
					data?: {
						message?: string;
						detail?: string;
						title?: string;
					};
				};
				config?: { url?: string; params?: unknown };
			};

			// Handle specific SAM.gov error codes
			if (axiosError.response?.status === 400) {
				const errorData = axiosError.response.data;
				loggingService.error(
					"SAM.gov Entity API 400 Error:",
					errorData?.message || errorData?.title || "Invalid request parameters"
				);
				return [];
			}

			if (axiosError.response?.status === 401) {
				loggingService.error(
					"SAM.gov Entity API 401 Error:",
					"Unauthorized - Check API key and system account credentials"
				);
				return [];
			}

			if (axiosError.response?.status === 403) {
				loggingService.error(
					"SAM.gov Entity API 403 Error:",
					"Forbidden - Invalid API key or insufficient privileges"
				);
				return [];
			}

			if (axiosError.response?.status === 406) {
				loggingService.error(
					"SAM.gov Entity API 406 Error:",
					"Invalid Accept header - API requires application/json"
				);
				return [];
			}

			if (axiosError.response?.status === 415) {
				loggingService.error(
					"SAM.gov Entity API 415 Error:",
					"Invalid Content-Type header - API requires application/json"
				);
				return [];
			}

			loggingService.error(
				"SAM.gov Entity Management API search error:",
				axiosError.message ?? "Unknown error"
			);
			loggingService.error("Error details:", {
				code: axiosError.code,
				status: axiosError.response?.status,
				statusText: axiosError.response?.statusText,
				url: axiosError.config?.url,
				params: axiosError.config?.params,
			});

			// For network errors, return empty array instead of throwing
			if (
				axiosError.code === "ECONNABORTED" ||
				axiosError.message?.includes("timeout")
			) {
				loggingService.warn(
					"[WARN] Request timeout - returning empty results to prevent service disruption"
				);
				return [];
			}

			this.handleError(error);
		}
	}

	async getEligibleContractors(
		naicsCode: string,
		socioeconomicStatus?: string
	): Promise<EntityInfo[]> {
		try {
			const searchParams: EntitySearchParams = {
				naics_code: naicsCode,
				registration_status: "Active",
				exclusion_status: "Not Excluded",
				limit: 50,
			};

			if (socioeconomicStatus) {
				searchParams.socioeconomic_status = socioeconomicStatus;
			}

			return this.searchEntities(searchParams);
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			loggingService.error(
				`Error fetching eligible contractors for NAICS ${naicsCode}:`,
				errorMessage
			);
			return [];
		}
	}

	async getSmallBusinessContractors(naicsCode: string): Promise<EntityInfo[]> {
		try {
			const searchParams: EntitySearchParams = {
				naics_code: naicsCode,
				socioeconomic_status: "Small Business",
				registration_status: "Active",
				exclusion_status: "Not Excluded",
				limit: 50,
			};

			return this.searchEntities(searchParams);
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			loggingService.error(
				`Error fetching small business contractors for NAICS ${naicsCode}:`,
				errorMessage
			);
			return [];
		}
	}

	async getTeamingOpportunities(
		naicsCode: string,
		_agencyCode?: string
	): Promise<{
		primeContractors: EntityInfo[];
		subcontractors: EntityInfo[];
		jointVentures: EntityInfo[];
		totalEligible: number;
	}> {
		try {
			// Get all eligible contractors
			const allContractors = await this.getEligibleContractors(naicsCode);

			// Categorize by business type
			const primeContractors = allContractors.filter(
				entity =>
					entity.business_types.includes("Prime Contractor") ||
					entity.business_types.includes("General Contractor")
			);

			const subcontractors = allContractors.filter(
				entity =>
					entity.business_types.includes("Subcontractor") ||
					entity.business_types.includes("Specialty Contractor")
			);

			const jointVentures = allContractors.filter(
				entity =>
					entity.business_types.includes("Joint Venture") ||
					entity.business_types.includes("Partnership")
			);

			return {
				primeContractors,
				subcontractors,
				jointVentures,
				totalEligible: allContractors.length,
			};
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			loggingService.error(
				`Error analyzing teaming opportunities for NAICS ${naicsCode}:`,
				errorMessage
			);
			return {
				primeContractors: [],
				subcontractors: [],
				jointVentures: [],
				totalEligible: 0,
			};
		}
	}

	async getEntitySummary(naicsCode: string): Promise<EntitySummary> {
		try {
			const entities = await this.getEligibleContractors(naicsCode, undefined);

			const summary: EntitySummary = {
				total_entities: entities.length,
				small_business_count: 0,
				socioeconomic_counts: {},
				business_type_counts: {},
				state_distribution: {},
				naics_distribution: {},
			};

			entities.forEach(entity => {
				// Count small businesses
				if (entity.socioeconomic_status.includes("Small Business")) {
					summary.small_business_count++;
				}

				// Count socioeconomic statuses
				entity.socioeconomic_status.forEach(status => {
					summary.socioeconomic_counts[status] =
						(summary.socioeconomic_counts[status] || 0) + 1;
				});

				// Count business types
				entity.business_types.forEach(type => {
					summary.business_type_counts[type] =
						(summary.business_type_counts[type] || 0) + 1;
				});

				// Count states
				if (entity.address?.state) {
					summary.state_distribution[entity.address.state] =
						(summary.state_distribution[entity.address.state] || 0) + 1;
				}

				// Count NAICS codes
				entity.naics_codes.forEach(naics => {
					summary.naics_distribution[naics.code] =
						(summary.naics_distribution[naics.code] || 0) + 1;
				});
			});

			return summary;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			loggingService.error(
				`Error generating entity summary for NAICS ${naicsCode}:`,
				errorMessage
			);
			return {
				total_entities: 0,
				small_business_count: 0,
				socioeconomic_counts: {},
				business_type_counts: {},
				state_distribution: {},
				naics_distribution: {},
			};
		}
	}

	private handleError(error: unknown): never {
		const axiosError = error as {
			response?: { status?: number };
			code?: string;
			message?: string;
		};
		const status = axiosError.response?.status;
		const { code } = axiosError;
		const message = axiosError.message ?? "Unknown error";

		if (code === "ECONNABORTED" || message.includes("timeout")) {
			throw new Error(
				"Request timeout. SAM.gov Entity Management API is taking too long to respond. Please try again."
			);
		} else if (status === 500) {
			throw new Error(
				"SAM.gov Entity Management server error (500). Please try again later."
			);
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
				"Bad request (400). Invalid parameters sent to SAM.gov Entity Management API."
			);
		} else if (status === 404) {
			throw new Error(
				"SAM.gov Entity Management API endpoint not found (404). Please check the API configuration."
			);
		}
		throw new Error(`Failed to call SAM.gov Entity Management API: ${message}`);
	}
}

export default new EntityManagementService();
