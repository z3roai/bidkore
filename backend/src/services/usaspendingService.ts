import axios, {
	type AxiosInstance,
	type AxiosResponse,
	type InternalAxiosRequestConfig,
} from "axios";

import loggingService from "@/services/loggingService";

export interface USAspendingAward {
	id: string;
	award_id: string;
	recipient_name: string;
	recipient_uei: string;
	recipient_duns: string;
	award_amount: number;
	award_type: string;
	date_signed: string;
	naics_code: string;
	naics_description: string;
	place_of_performance: {
		state_name: string;
		city_name: string;
		country_name: string;
	};
	funding_agency: {
		name: string;
		code: string;
	};
	awarding_agency: {
		name: string;
		code: string;
	};
	description: string;
	contract_award_type: string;
	competition_type: string;
	number_of_offers_received: number;
	small_business_competitive: boolean;
	set_aside_type: string;
	sub_agency: string;
	prime_awardee: {
		name: string;
		uei: string;
	};
	sub_awardee: {
		name: string;
		uei: string;
	};
}

export interface AgencySummary {
	agency_name: string;
	agency_code: string;
	total_obligations: number;
	num_awards: number;
	award_type_counts: {
		contracts: number;
		grants: number;
		loans: number;
		other: number;
	};
	fiscal_year: number;
}

interface TransactionSpendingSummary {
	results: {
		prime_awards_obligation_amount: number;
		prime_awards_count: number;
	};
}

interface AwardTypeCounts {
	results: {
		grants: number;
		loans: number;
		contracts: number;
		direct_payments: number;
		other: number;
		idvs: number;
	};
	spending_level: string;
	messages?: string[];
}

interface AwardingAgencySummary {
	category: string;
	spending_level: string;
	limit: number;
	page_metadata: {
		page: number;
		hasNext: boolean;
	};
	results: {
		amount: number;
		total_outlays: number | null;
		name: string;
		code: string;
		id: number;
	}[];
	messages?: string[];
}

export interface RecipientSummary {
	recipient_name: string;
	recipient_uei: string;
	total_obligations: number;
	num_awards: number;
	award_type_counts: {
		contracts: number;
		grants: number;
		loans: number;
		other: number;
	};
	fiscal_year: number;
	top_agencies: {
		agency_name: string;
		total_obligations: number;
		num_awards: number;
	}[];
}

export type AwardTypeGroup =
	| "contracts"
	| "loans"
	| "idvs"
	| "grants"
	| "other_financial_assistance"
	| "direct_payments";

export interface AwardTypes {
	contracts: Record<string, string>;
	loans: Record<string, string>;
	idvs: Record<string, string>;
	grants: Record<string, string>;
	other_financial_assistance: Record<string, string>;
	direct_payments: Record<string, string>;
}

const AWARD_TYPES_FALLBACK: AwardTypes = {
	contracts: {
		A: "BPA Call",
		B: "Purchase Order",
		C: "Delivery Order",
		D: "Definitive Contract",
	},
	loans: {
		"07": "Direct Loan",
		"08": "Guaranteed/Insured Loan",
	},
	idvs: {
		IDV_A: "GWAC Government Wide Acquisition Contract",
		IDV_B: "IDC Multi-Agency Contract, Other Indefinite Delivery Contract",
		IDV_B_A: "IDC Indefinite Delivery Contract / Requirements",
		IDV_B_B: "IDC Indefinite Delivery Contract / Indefinite Quantity",
		IDV_B_C: "IDC Indefinite Delivery Contract / Definite Quantity",
		IDV_C: "FSS Federal Supply Schedule",
		IDV_D: "BOA Basic Ordering Agreement",
		IDV_E: "BPA Blanket Purchase Agreement",
	},
	grants: {
		"02": "Block Grant",
		"03": "Formula Grant",
		"04": "Project Grant",
		"05": "Cooperative Agreement",
	},
	other_financial_assistance: {
		"09": "Insurance",
		"11": "Other Financial Assistance",
		"-1": "Not Specified",
	},
	direct_payments: {
		"06": "Direct Payment for Specified Use",
		"10": "Direct Payment with Unrestricted Use",
	},
};

export interface USAspendingSearchParams {
	keyword?: string; // legacy single keyword phrase
	keywords?: string[]; // preferred array form for USAspending filters.keywords
	extraKeywords?: string[]; // optional extras to append
	enableTokenization?: boolean; // default true when keyword present
	enablePhraseInKeywords?: boolean; // default true
	removeStopwords?: boolean; // default true
	enableSynonyms?: boolean; // default false
	naics_code?: string;
	agency_code?: string;
	recipient_name?: string;
	date_signed_from?: Date | string;
	date_signed_to?: Date | string;
	award_amount_min?: number;
	award_amount_max?: number;
	award_type?: string;
	award_type_codes?: string[];
	award_type_group?: AwardTypeGroup;
	set_aside_type?: string;
	competition_type?: string;
	place_of_performance_state?: string;
	limit?: number;
	page?: number;
	sort?: string;
	order?: "asc" | "desc";
	fields?: string[];
}

class USAspendingService {
	private readonly api: AxiosInstance;
	private readonly retryAttempts = 3;
	private readonly retryDelay = 2000;
	private circuitBreakerOpen = false;
	private circuitBreakerFailures = 0;
	private readonly circuitBreakerThreshold = 5;
	private readonly circuitBreakerTimeout = 60000; // 1 minute
	private lastFailureTime = 0;

	private awardTypesCache: AwardTypes | null = null;
	private awardTypesCacheFetchedAt = 0;
	private readonly awardTypesCacheTtlMs = 24 * 60 * 60 * 1000; // 24 hours

	constructor() {
		this.api = axios.create({
			baseURL: "https://api.usaspending.gov/api/v2",
			timeout: 60000,
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "BidKore/1.0",
			},
			maxRedirects: 5,
			validateStatus: status => status < 500,
		});

		// Rate limiter setup
		const attachRateLimiter = async (
			cfg: InternalAxiosRequestConfig
		): Promise<InternalAxiosRequestConfig> => {
			// USAspending.gov has generous rate limits, but we'll still implement basic limiting
			await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between requests
			return cfg;
		};

		this.api.interceptors.request.use(attachRateLimiter);

		// Circuit breaker and retry logic
		this.setupResponseInterceptor();
	}

	private mapSortField(field: string): string {
		// Pass-through for known labels. USAspending accepts display names like "Award Amount"
		// Optionally normalize common internal names to display names.
		const mapping: Record<string, string> = {
			award_amount: "Award Amount",
			AwardAmount: "Award Amount",
			action_date: "Action Date",
			ActionDate: "Action Date",
		};
		return mapping[field] ?? field;
	}

	private tokenize(
		phrase: string,
		opts: { removeStopwords: boolean }
	): string[] {
		const basic = phrase
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, " ")
			.split(/\s+/)
			.filter(t => t.length >= 3);
		if (!opts.removeStopwords) {
			return basic;
		}
		const stop = new Set([
			"the",
			"a",
			"an",
			"and",
			"or",
			"of",
			"for",
			"to",
			"in",
			"on",
			"with",
			"by",
			"at",
			"from",
			"as",
			"service",
			"services", // optional mild pruning to reduce noise
		]);
		return basic.filter(t => !stop.has(t));
	}

	private getSynonyms(token: string): string[] {
		// Lightweight static synonyms; keep conservative to avoid noise
		const dict: Record<string, string[]> = {
			construction: ["build", "building", "construction"],
			management: ["mgmt", "management"],
			services: ["service", "services"],
			contract: ["contract", "procurement"],
		};
		return dict[token] ?? [];
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
						"[WARN] USAspending circuit breaker is open - rejecting request"
					);
					throw new Error(
						"USAspending.gov API is temporarily unavailable due to repeated failures. Please try again later."
					);
				}

				const axiosError = error as {
					config?: InternalAxiosRequestConfig & { __retryCount?: number };
					message?: string;
					response?: { status?: number };
					code?: string;
				};
				const cfg = axiosError.config;
				if (!cfg || (cfg.__retryCount ?? 0) >= this.retryAttempts) {
					this.recordFailure();
					loggingService.error(
						"[ERROR] USAspending API request failed after retries:",
						axiosError.message
					);
					return Promise.reject(error);
				}

				cfg.__retryCount = (cfg.__retryCount ?? 0) + 1;

				let waitTime = this.retryDelay * cfg.__retryCount;

				if (axiosError.response?.status === 429) {
					waitTime = Math.min(this.retryDelay * 2 ** cfg.__retryCount, 60000);
					loggingService.warn(
						`[WARN] Rate limit (429) on USAspending — retry ${cfg.__retryCount} in ${waitTime}ms`
					);
				} else if (axiosError.response?.status === 500) {
					waitTime = Math.min(this.retryDelay * 3 ** cfg.__retryCount, 120000);
					loggingService.warn(
						`[WARN] Server error (500) on USAspending — retry ${cfg.__retryCount} in ${waitTime}ms`
					);
				} else if (
					axiosError.code === "ECONNABORTED" ||
					axiosError.message?.includes("timeout")
				) {
					waitTime = Math.min(5000 * cfg.__retryCount, 20000);
					loggingService.warn(
						`[WARN] Timeout error on USAspending — retry ${cfg.__retryCount} in ${waitTime}ms`
					);
				}

				await new Promise(resolve => setTimeout(resolve, waitTime));
				return this.api(cfg);
			}
		);
	}

	private isAwardTypesCacheValid(): boolean {
		return (
			this.awardTypesCache !== null &&
			Date.now() - this.awardTypesCacheFetchedAt < this.awardTypesCacheTtlMs
		);
	}

	async getAwardTypes(forceRefresh = false): Promise<AwardTypes> {
		try {
			if (!forceRefresh && this.isAwardTypesCacheValid()) {
				return this.awardTypesCache as AwardTypes;
			}

			const response: AxiosResponse<AwardTypes> = await this.api.get(
				"/references/award_types/"
			);

			const data = response.data as Partial<AwardTypes>;
			const requiredGroups: AwardTypeGroup[] = [
				"contracts",
				"loans",
				"idvs",
				"grants",
				"other_financial_assistance",
				"direct_payments",
			];

			const isValid = requiredGroups.every(
				group =>
					Object.prototype.hasOwnProperty.call(data, group) &&
					typeof (data as Record<string, unknown>)[group] === "object"
			);

			const awardTypes: AwardTypes = isValid
				? (data as AwardTypes)
				: AWARD_TYPES_FALLBACK;

			this.awardTypesCache = awardTypes;
			this.awardTypesCacheFetchedAt = Date.now();
			return awardTypes;
		} catch (error: unknown) {
			loggingService.warn(
				"[WARN] Failed to fetch award types from USAspending. Using fallback.",
				error instanceof Error ? error.message : "Unknown error"
			);
			this.awardTypesCache = AWARD_TYPES_FALLBACK;
			this.awardTypesCacheFetchedAt = Date.now();
			return AWARD_TYPES_FALLBACK;
		}
	}

	async getAwardTypeCodesForGroup(group: AwardTypeGroup): Promise<string[]> {
		const awardTypes = await this.getAwardTypes();
		const mapping = awardTypes[group];
		return Object.keys(mapping ?? {});
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
				"USAspending circuit breaker timeout expired - attempting to close"
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
				`[WARN] USAspending circuit breaker opened after ${this.circuitBreakerFailures} failures`
			);
		}
	}

	async checkHealth(): Promise<boolean> {
		try {
			const response = await this.api.get("/search/spending_by_award", {
				params: { limit: 1 },
				timeout: 10000,
			});
			return response.status === 200;
		} catch (error: unknown) {
			loggingService.warn(
				"[WARN] USAspending.gov health check failed:",
				error instanceof Error ? error.message : "Unknown error"
			);
			return false;
		}
	}

	async searchAwards(
		params: USAspendingSearchParams
	): Promise<USAspendingAward[]> {
		try {
			// Check circuit breaker before making request
			if (this.isCircuitBreakerOpen()) {
				loggingService.warn(
					"[WARN] Circuit breaker is open - returning empty results"
				);
				return [];
			}

			loggingService.debug("USAspending.gov search awards", params);

			// Build POST body according to USAspending API
			// Map sort field to API expected case when needed
			const sortField = this.mapSortField(params.sort ?? "Award Amount");
			const order = params.order ?? "desc";

			const filters: Record<string, unknown> = {};

			// Add required award_type_codes filter (USAspending.gov requirement)
			// Determine codes from explicit list, provided group, or default to contracts
			let awardTypeCodes: string[] | undefined = undefined;
			if (params.award_type_codes && params.award_type_codes.length > 0) {
				awardTypeCodes = params.award_type_codes;
			} else if (params.award_type_group) {
				awardTypeCodes = await this.getAwardTypeCodesForGroup(
					params.award_type_group
				);
			} else {
				awardTypeCodes = await this.getAwardTypeCodesForGroup("contracts");
			}
			filters["award_type_codes"] = awardTypeCodes;

			// Build keywords
			const keywordsSet = new Set<string>();
			const enableTokenization = params.enableTokenization !== false; // default true
			const includePhrase = params.enablePhraseInKeywords !== false; // default true
			const removeStop = params.removeStopwords !== false; // default true

			if (params.keywords?.length) {
				params.keywords.forEach(k => {
					if (k.trim()) {
						keywordsSet.add(k.trim());
					}
				});
			}

			if (params.keyword && typeof params.keyword === "string") {
				const phrase = params.keyword.trim();
				if (includePhrase && phrase) {
					keywordsSet.add(phrase);
				}
				if (enableTokenization && phrase) {
					const tokens = this.tokenize(phrase, { removeStopwords: removeStop });
					tokens.forEach(t => {
						keywordsSet.add(t);
					});
					if (params.enableSynonyms) {
						tokens.forEach(t => {
							const syns = this.getSynonyms(t);
							syns.forEach(s => {
								keywordsSet.add(s);
							});
						});
					}
				}
			}

			if (params.extraKeywords?.length) {
				params.extraKeywords.forEach(k => {
					if (k.trim()) {
						keywordsSet.add(k.trim());
					}
				});
			}

			if (keywordsSet.size > 0) {
				filters["keywords"] = Array.from(keywordsSet);
			}

			if (params.naics_code) {
				filters["naics_codes"] = [params.naics_code];
			}

			if (params.agency_code) {
				// Use awarding_agency_code which is accepted by USAspending search filters
				filters["awarding_agency_code"] = params.agency_code;
			}

			if (params.recipient_name) {
				filters["recipient_name"] = params.recipient_name;
			}

			if (params.date_signed_from || params.date_signed_to) {
				const period: Record<string, string> = {};
				const start = params.date_signed_from
					? new Date(params.date_signed_from)
					: (() => {
							// If only end_date provided, back off 2 years by default
							const d = new Date();
							d.setFullYear(d.getFullYear() - 2);
							return d;
					  })();
				const end = params.date_signed_to
					? new Date(params.date_signed_to)
					: new Date();
				period["start_date"] = this.formatDateForAPI(start);
				period["end_date"] = this.formatDateForAPI(end);
				filters["time_period"] = [period];
			}

			if (params.award_amount_min || params.award_amount_max) {
				filters["award_amounts"] = [
					{
						min_amount: params.award_amount_min,
						max_amount: params.award_amount_max,
					},
				];
			}

			if (params.place_of_performance_state) {
				filters["place_of_performance_locations"] = [
					{ state: params.place_of_performance_state },
				];
			}

			const requestBody: Record<string, unknown> = {
				filters,
				limit: Math.min(params.limit ?? 25, 100),
				page: params.page ?? 1,
				sort: sortField,
				order,
			};

			if (params.fields && params.fields.length > 0) {
				requestBody["fields"] = params.fields;
			} else {
				// USAspending requires fields; provide a safe default set
				requestBody["fields"] = [
					"Award ID",
					"Recipient Name",
					"Action Date",
					"Award Amount",
					"Awarding Agency",
					"Award Type",
					"Award Description",
				];
			}

			loggingService.info(
				"Making USAspending.gov API request (POST) with body:",
				requestBody
			);

			const response: AxiosResponse<{ results: USAspendingAward[] }> =
				await this.api.post("/search/spending_by_award/", requestBody);

			loggingService.info(
				"USAspending.gov search response status:",
				response.status
			);

			// Check if response has the expected structure
			if (!response.data || !Array.isArray(response.data.results)) {
				loggingService.warn(
					"USAspending.gov API returned unexpected response structure:",
					response.data
				);
				return [];
			}

			loggingService.debug(
				"USAspending.gov search response data count:",
				response.data.results.length
			);

			const awards = response.data.results;

			// Record metrics for successful API call
			loggingService.debug(
				"[USASPENDING SERVICE DEBUG] Search completed successfully"
			);

			// Log awards discovered
			if (awards.length > 0) {
				loggingService.debug(
					`[USASPENDING SERVICE DEBUG] Awards found: ${awards.length}`
				);
			}

			return awards;
		} catch (error: unknown) {
			const err = error as {
				message?: string;
				code?: string;
				response?: {
					status?: number;
					statusText?: string;
				};
				config?: {
					url?: string;
					params?: unknown;
				};
			};

			loggingService.error(
				"USAspending.gov API search error:",
				err.message ?? "Unknown error"
			);
			loggingService.error("Error details:", {
				code: err.code,
				status: err.response?.status,
				statusText: err.response?.statusText,
				url: err.config?.url,
				params: err.config?.params,
			});

			// For network errors, return empty array instead of throwing
			if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
				loggingService.warn(
					"[WARN] Request timeout - returning empty results to prevent service disruption"
				);
				return [];
			}

			return [];
		}
	}

	async getAgencySummary(
		agencyCode: string,
		fiscalYear?: number
	): Promise<AgencySummary | null> {
		try {
			// Get transaction spending summary for totals
			const filters: Record<string, unknown> = {
				awarding_agency_code: agencyCode,
			};

			if (fiscalYear) {
				filters["time_period"] = [
					{
						fiscal_year: fiscalYear.toString(),
					},
				];
			}

			const spendingRequestBody = {
				filters,
				scope: "prime_awards",
			};

			const spendingResponse: AxiosResponse<TransactionSpendingSummary> =
				await this.api.post(
					"/search/transaction_spending_summary/",
					spendingRequestBody
				);

			if (!spendingResponse.data.results) {
				return null;
			}

			const spendingData = spendingResponse.data.results;

			// Get award type counts
			const awardTypeRequestBody = {
				filters,
				scope: "prime_awards",
			};

			const awardTypeResponse: AxiosResponse<AwardTypeCounts> =
				await this.api.post(
					"/search/spending_by_award_count/",
					awardTypeRequestBody
				);

			// Map award types to expected format
			const awardTypeCounts = {
				contracts: awardTypeResponse.data.results.contracts || 0,
				grants: awardTypeResponse.data.results.grants || 0,
				loans: awardTypeResponse.data.results.loans || 0,
				other:
					(awardTypeResponse.data.results.direct_payments || 0) +
					(awardTypeResponse.data.results.other || 0) +
					(awardTypeResponse.data.results.idvs || 0),
			};

			return {
				agency_name: `Agency ${agencyCode}`, // USAspending doesn't return agency name in this endpoint
				agency_code: agencyCode,
				total_obligations: spendingData.prime_awards_obligation_amount,
				num_awards: spendingData.prime_awards_count,
				award_type_counts: awardTypeCounts,
				fiscal_year: fiscalYear || new Date().getFullYear(),
			};
		} catch (error: unknown) {
			const err = error as {
				response?: { status?: number };
				message?: string;
			};
			if (err.response?.status === 404) {
				return null;
			}
			loggingService.error(
				`Error fetching agency summary for ${agencyCode}:`,
				err.message ?? "Unknown error"
			);
			return null;
		}
	}

	async getRecipientSummary(
		recipientUei: string,
		fiscalYear?: number
	): Promise<RecipientSummary | null> {
		try {
			// Get transaction spending summary for totals
			const filters: Record<string, unknown> = {
				recipient_uei: recipientUei,
			};

			if (fiscalYear) {
				filters["time_period"] = [
					{
						fiscal_year: fiscalYear.toString(),
					},
				];
			}

			const spendingRequestBody = {
				filters,
				scope: "prime_awards",
			};

			const spendingResponse: AxiosResponse<TransactionSpendingSummary> =
				await this.api.post(
					"/search/transaction_spending_summary/",
					spendingRequestBody
				);

			if (!spendingResponse.data.results) {
				return null;
			}

			const spendingData = spendingResponse.data.results;

			// Get award type counts
			const awardTypeRequestBody = {
				filters,
			};

			const awardTypeResponse: AxiosResponse<AwardTypeCounts> =
				await this.api.post(
					"/search/spending_by_award_count/",
					awardTypeRequestBody
				);

			// Map award types to expected format
			const awardTypeCounts = {
				contracts: awardTypeResponse.data.results.contracts || 0,
				grants: awardTypeResponse.data.results.grants || 0,
				loans: awardTypeResponse.data.results.loans || 0,
				other:
					(awardTypeResponse.data.results.direct_payments || 0) +
					(awardTypeResponse.data.results.other || 0) +
					(awardTypeResponse.data.results.idvs || 0),
			};

			// Get top agencies for this recipient
			const agencyFilters: Record<string, unknown> = {
				recipient_uei: recipientUei,
			};

			if (fiscalYear) {
				agencyFilters["time_period"] = [
					{
						fiscal_year: fiscalYear.toString(),
					},
				];
			}

			const agencyRequestBody = {
				filters: agencyFilters,
				category: "awarding_agency",
				limit: 5, // Top 5 agencies
				page: 1,
				spending_level: "transactions",
			};

			const agencyResponse: AxiosResponse<AwardingAgencySummary> =
				await this.api.post(
					"/search/spending_by_category/awarding_agency/",
					agencyRequestBody
				);

			const topAgencies =
				agencyResponse.data.results?.map(result => ({
					agency_name: result.name,
					total_obligations: result.amount,
					num_awards: 0, // This endpoint doesn't provide award count per agency
				})) || [];

			return {
				recipient_name: `Recipient ${recipientUei}`, // USAspending doesn't return recipient name in this endpoint
				recipient_uei: recipientUei,
				total_obligations: spendingData.prime_awards_obligation_amount,
				num_awards: spendingData.prime_awards_count,
				award_type_counts: awardTypeCounts,
				fiscal_year: fiscalYear || new Date().getFullYear(),
				top_agencies: topAgencies,
			};
		} catch (error: unknown) {
			const err = error as {
				response?: { status?: number };
				message?: string;
			};
			if (err.response?.status === 404) {
				return null;
			}
			loggingService.error(
				`Error fetching recipient summary for ${recipientUei}:`,
				err.message ?? "Unknown error"
			);
			return null;
		}
	}

	async getSimilarAwards(
		naicsCode: string,
		agencyCode?: string,
		limit = 10
	): Promise<USAspendingAward[]> {
		try {
			const params: USAspendingSearchParams = {
				naics_code: naicsCode,
				limit,
				sort: "award_amount",
				order: "desc",
				fields: [
					"Award ID",
					"Recipient Name",
					"Action Date",
					"Award Amount",
					"NAICS Code",
					"Description",
				],
			};

			if (agencyCode) {
				params.agency_code = agencyCode;
			}

			// Get awards from the last 2 years
			const twoYearsAgo = new Date();
			twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
			params.date_signed_from = twoYearsAgo;

			return this.searchAwards(params);
		} catch (error: unknown) {
			loggingService.error(
				`Error fetching similar awards for NAICS ${naicsCode}:`,
				error instanceof Error ? error.message : "Unknown error"
			);
			return [];
		}
	}

	async getCompetitionAnalysis(
		naicsCode: string,
		agencyCode?: string
	): Promise<{
		averageOffers: number;
		competitionTypes: Record<string, number>;
		setAsideTypes: Record<string, number>;
		averageAwardAmount: number;
		totalAwards: number;
	}> {
		try {
			const similarAwards = await this.getSimilarAwards(
				naicsCode,
				agencyCode,
				50
			);

			if (similarAwards.length === 0) {
				return {
					averageOffers: 0,
					competitionTypes: {},
					setAsideTypes: {},
					averageAwardAmount: 0,
					totalAwards: 0,
				};
			}

			const competitionTypes: Record<string, number> = {};
			const setAsideTypes: Record<string, number> = {};
			let totalOffers = 0;
			let totalAmount = 0;
			let validOffers = 0;

			similarAwards.forEach(award => {
				// Count competition types
				if (award.competition_type) {
					competitionTypes[award.competition_type] =
						(competitionTypes[award.competition_type] ?? 0) + 1;
				}

				// Count set-aside types
				if (award.set_aside_type) {
					setAsideTypes[award.set_aside_type] =
						(setAsideTypes[award.set_aside_type] ?? 0) + 1;
				}

				// Calculate average offers
				if (
					award.number_of_offers_received &&
					award.number_of_offers_received > 0
				) {
					totalOffers += award.number_of_offers_received;
					validOffers++;
				}

				// Calculate average award amount
				if (award.award_amount && award.award_amount > 0) {
					totalAmount += award.award_amount;
				}
			});

			return {
				averageOffers:
					validOffers > 0 ? Math.round(totalOffers / validOffers) : 0,
				competitionTypes,
				setAsideTypes,
				averageAwardAmount:
					similarAwards.length > 0
						? Math.round(totalAmount / similarAwards.length)
						: 0,
				totalAwards: similarAwards.length,
			};
		} catch (error: unknown) {
			loggingService.error(
				`Error analyzing competition for NAICS ${naicsCode}:`,
				error instanceof Error ? error.message : "Unknown error"
			);
			return {
				averageOffers: 0,
				competitionTypes: {},
				setAsideTypes: {},
				averageAwardAmount: 0,
				totalAwards: 0,
			};
		}
	}

	formatDateForAPI(date: Date): string {
		return date.toISOString().split("T")[0] || ""; // YYYY-MM-DD format
	}

	private handleError(error: unknown): never {
		const err = error as {
			response?: { status?: number };
			code?: string;
			message?: string;
		};
		const status = err.response?.status;
		const { code } = err;
		const message = err.message ?? "Unknown error";

		if (code === "ECONNABORTED" || message.includes("timeout")) {
			throw new Error(
				"Request timeout. USAspending.gov API is taking too long to respond. Please try again."
			);
		} else if (status === 500) {
			throw new Error(
				"USAspending.gov server error (500). Please try again later."
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
				"Bad request (400). Invalid parameters sent to USAspending.gov API."
			);
		} else if (status === 404) {
			throw new Error(
				"USAspending.gov API endpoint not found (404). Please check the API configuration."
			);
		}
		throw new Error(`Failed to call USAspending.gov API: ${err.message}`);
	}
}

export default new USAspendingService();
