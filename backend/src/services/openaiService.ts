import OpenAI from "openai";

import config from "@/config/env";
import loggingService from "@/services/loggingService";
import type { SAMSearchParams } from "@/services/samGovService";

export interface AISearchRequest {
	naturalLanguageQuery: string;
	context?: {
		userPreferences?: string[];
		recentSearches?: string[];
		industry?: string;
	};
}

export interface AISearchResponse {
	samGovParams: SAMSearchParams;
	explanation: string;
	confidence: number;
	suggestedKeywords: string[];
	reasoning: string;
}

class OpenAIService {
	private client: OpenAI | null = null;
	private isInitialized = false;
	private readonly availableModels: string[] = [];
	private preferredModel = "gpt-5";

	constructor() {
		// Initialize asynchronously
		this.initializeClient().catch(error => {
			loggingService.error(
				"[ERROR] Failed to initialize OpenAI service:",
				error instanceof Error ? error.message : String(error)
			);
		});
	}

	private async initializeClient(): Promise<void> {
		try {
			if (!config.openai.apiKey) {
				loggingService.warn(
					"[WARN] OpenAI API key not configured - AI search features will be disabled"
				);
				return;
			}

			this.client = new OpenAI({
				apiKey: config.openai.apiKey,
			});

			this.isInitialized = true;

			// Detect available models
			await this.detectAvailableModels();

			loggingService.info("OpenAI service initialized successfully");
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			loggingService.error(
				"[ERROR] Failed to initialize OpenAI service:",
				errorMessage
			);
			this.isInitialized = false;
		}
	}

	private async detectAvailableModels(): Promise<void> {
		if (!this.client) {
			return;
		}

		try {
			// Test GPT-5 first, then fallback to other models
			const modelsToTest = [
				"gpt-5-chat-latest",
				"gpt-5",
				"gpt-4o",
				"gpt-4o-mini",
				"gpt-4-turbo",
				"gpt-4",
			];

			for (const model of modelsToTest) {
				try {
					// Test if model is available with a simple request
					await this.client.chat.completions.create({
						model,
						messages: [{ role: "user", content: "test" }],
						...this.getTokenParameter(model, 1),
					});

					this.availableModels.push(model);
					loggingService.info(`Model ${model} is available`);

					// Use the first available model as preferred
					if (!this.preferredModel || this.preferredModel === "gpt-5") {
						this.preferredModel = model;
					}

					// Stop after finding GPT-5 or GPT-4o
					if (model.startsWith("gpt-5") || model === "gpt-4o") {
						break;
					}
				} catch (error: unknown) {
					const errorObj = error as {
						status?: number;
						message?: string;
					};
					if (
						errorObj.status === 403 &&
						errorObj.message?.includes(
							"Country, region, or territory not supported"
						)
					) {
						loggingService.warn(
							`[WARN] OpenAI API not available in this region for model ${model}`
						);
						// Skip all OpenAI models if geographic restriction
						break;
					}
					loggingService.debug(
						`Model ${model} not available:`,
						errorObj.message ?? "Unknown error"
					);
				}
			}

			loggingService.info(`Using preferred model: ${this.preferredModel}`);
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			loggingService.warn(
				"[WARN] Failed to detect available models:",
				errorMessage
			);
			// Fallback to GPT-4o-mini if detection fails
			this.preferredModel = "gpt-4o-mini";
		}
	}

	// Helper method to get the correct token parameter for different models
	private getTokenParameter(
		model: string,
		tokens: number
	): { max_completion_tokens?: number; max_tokens?: number } {
		// GPT-5 models use max_completion_tokens, others use max_tokens
		if (model.startsWith("gpt-5")) {
			return { max_completion_tokens: tokens };
		}
		return { max_tokens: tokens };
	}

	private getSystemPrompt(): string {
		return `You transform a natural-language user query into strictly valid JSON parameters for the SAM.gov opportunities search.

STRICT OUTPUT REQUIREMENTS:
- Output JSON only. No prose, no markdown, no trailing commentary.
- Never fabricate defaults or assumptions not present in the user query.
- If a parameter is unknown, omit it. Do not invent date ranges or NAICS codes.
- Use keys that match EXACTLY these names: { "samGovParams", "explanation", "confidence", "suggestedKeywords", "reasoning" }.
- Date values, when provided by the user, must be MM/DD/YYYY.

Allowed samGovParams keys:
- keyword, naicsCode, agency, postedFrom, postedTo, responseDeadlineFrom, responseDeadlineTo, setAside, type, status, limit

Validation rules:
- If you set postedFrom, you MUST also set postedTo (SAM.gov requires both).
- If user provided a time window, use it. If not, use last 30 days as default.
- Do not map industries to NAICS unless the user gave a 6-digit code.
- Keep explanation short (<= 200 chars), avoid jargon.
- confidence is a float 0..1.
`;
	}

	async convertNaturalLanguageToSAMQuery(
		request: AISearchRequest
	): Promise<AISearchResponse> {
		if (!this.isInitialized || !this.client) {
			throw new Error(
				"OpenAI service is not initialized. Please check your API key configuration."
			);
		}

		try {
			loggingService.info("Processing AI search request:", {
				query: request.naturalLanguageQuery,
			});

			const completion = await this.client.chat.completions.create({
				model: this.preferredModel, // Use the best available model
				messages: [
					{
						role: "system",
						content: this.getSystemPrompt(),
					},
					{
						role: "user",
						content: `Query: ${request.naturalLanguageQuery}\nContext: ${
							request.context ? JSON.stringify(request.context) : "{}"
						}`,
					},
				],
				temperature: 0.0, // deterministic
				...this.getTokenParameter(this.preferredModel, 800),
				response_format: { type: "json_object" },
			});

			const responseContent = completion.choices[0]?.message.content;
			if (!responseContent) {
				throw new Error("No response content received from OpenAI");
			}

			const parsedResponse = JSON.parse(responseContent) as AISearchResponse;

			// Validate the response structure
			this.validateAIResponse(parsedResponse);

			// Enhanced logging for testing and debugging
			const logData = {
				query: request.naturalLanguageQuery,
				confidence: parsedResponse.confidence,
				parameters: Object.keys(parsedResponse.samGovParams),
				explanation: parsedResponse.explanation,
				suggestedKeywords: parsedResponse.suggestedKeywords,
				reasoning: parsedResponse.reasoning,
			};

			loggingService.info("AI search conversion completed:", logData);

			return parsedResponse;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			loggingService.error("[ERROR] OpenAI API request failed:", {
				error: errorMessage,
				query: request.naturalLanguageQuery,
			});

			// Fallback to basic keyword extraction
			return this.fallbackKeywordExtraction(request.naturalLanguageQuery);
		}
	}

	private validateAIResponse(response: AISearchResponse): void {
		if (!response.samGovParams || typeof response.samGovParams !== "object") {
			throw new Error("Invalid AI response: missing or invalid samGovParams");
		}

		if (
			typeof response.confidence !== "number" ||
			response.confidence < 0 ||
			response.confidence > 1
		) {
			throw new Error(
				"Invalid AI response: confidence must be a number between 0 and 1"
			);
		}

		if (!Array.isArray(response.suggestedKeywords)) {
			throw new Error(
				"Invalid AI response: suggestedKeywords must be an array"
			);
		}

		// Validate NAICS code format if provided
		if (
			response.samGovParams.naicsCode &&
			!/^[0-9]{6}$/.test(String(response.samGovParams.naicsCode))
		) {
			loggingService.warn(
				"[WARN] Invalid NAICS code format:",
				response.samGovParams.naicsCode
			);
			delete response.samGovParams.naicsCode; // Remove invalid NAICS code
		}
	}

	private fallbackKeywordExtraction(query: string): AISearchResponse {
		loggingService.info("Using fallback keyword extraction for query:", query);

		// Simple keyword extraction fallback
		const keywords = query
			.toLowerCase()
			.replace(/[^\w\s]/g, " ") // Remove punctuation
			.split(/\s+/)
			.filter(word => word.length > 2) // Filter out short words
			.slice(0, 10); // Limit to 10 keywords

		return {
			samGovParams: {
				keyword: keywords.join(" "),
				limit: 25,
			},
			explanation:
				"Basic keyword extraction fallback due to AI service unavailability",
			confidence: 0.3,
			suggestedKeywords: keywords.slice(0, 5),
			reasoning:
				"Fallback method used simple keyword extraction from the natural language query.",
		};
	}

	isServiceAvailable(): boolean {
		return this.isInitialized && this.client !== null;
	}

	async testConnection(): Promise<{ available: boolean; error?: string }> {
		if (!this.isInitialized || !this.client) {
			return {
				available: false,
				error: "OpenAI service not initialized",
			};
		}

		try {
			// Simple test request using preferred model
			await this.client.chat.completions.create({
				model: this.preferredModel,
				messages: [{ role: "user", content: "Test" }],
				...this.getTokenParameter(this.preferredModel, 5),
			});

			return { available: true };
		} catch (error: unknown) {
			const errorObj = error as {
				status?: number;
				message?: string;
			};
			if (
				errorObj.status === 403 &&
				errorObj.message?.includes(
					"Country, region, or territory not supported"
				)
			) {
				loggingService.warn(
					"[WARN] OpenAI API not available in this geographic region"
				);
				return {
					available: false,
					error: "OpenAI API not available in this geographic region",
				};
			}
			return {
				available: false,
				error: errorObj.message ?? "Unknown error",
			};
		}
	}

	getCurrentModel(): string {
		return this.preferredModel;
	}

	getAvailableModels(): string[] {
		return [...this.availableModels];
	}

	isUsingGPT5(): boolean {
		return this.preferredModel.startsWith("gpt-5");
	}

	isGeographicRestricted(): boolean {
		return (
			this.availableModels.length === 0 && this.preferredModel === "gpt-4o-mini"
		);
	}

	getServiceStatus(): {
		available: boolean;
		model: string;
		isGPT5: boolean;
		geographicRestricted: boolean;
		fallbackActive: boolean;
	} {
		return {
			available: this.isInitialized && this.client !== null,
			model: this.preferredModel,
			isGPT5: this.isUsingGPT5(),
			geographicRestricted: this.isGeographicRestricted(),
			fallbackActive: this.availableModels.length === 0,
		};
	}

	async callOpenAICompletion(prompt: string): Promise<string> {
		if (!this.isInitialized || !this.client) {
			throw new Error(
				"OpenAI service is not initialized. Please check your API key configuration."
			);
		}

		try {
			loggingService.info("Processing AI completion request");

			const response = await this.client.chat.completions.create({
				model: this.preferredModel,
				messages: [
					{
						role: "system",
						content:
							"You are an expert government contracting analyst. Provide detailed, professional analysis in JSON format when requested.",
					},
					{
						role: "user",
						content: prompt,
					},
				],
				temperature: 0.3,
				max_tokens: 4000,
			});

			const responseContent = response.choices[0]?.message?.content;
			if (!responseContent) {
				throw new Error("No response content received from OpenAI");
			}

			loggingService.info("AI completion successful");
			return responseContent;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.error("[ERROR] OpenAI completion failed:", errorMessage);
			throw error;
		}
	}
}

export default new OpenAIService();
