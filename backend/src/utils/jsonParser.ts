import loggingService from "@/services/loggingService";
import { parse as parseJsonc } from "jsonc-parser";

export interface JsonParseResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	cleanedJson?: string;
}

/**
 * Robust JSON parser that handles malformed JSON from AI responses
 * Uses jsonc-parser for better error tolerance and fallback mechanisms
 */

/**
 * Parse JSON with multiple fallback strategies
 */
export function parseJson<T = unknown>(input: string): JsonParseResult<T> {
	if (!input || typeof input !== "string") {
		return {
			success: false,
			error: "Invalid input: expected non-empty string",
		};
	}

	// Strategy 1: Try to find JSON within code blocks first
	// Match various code block formats
	const codeBlockPatterns = [
		/```json\s*(\{[\s\S]*?\})\s*```/g,
		/```\s*(\{[\s\S]*?\})\s*```/g,
		/```json\s*(\{[\s\S]*?)\s*```/g,
		/```\s*(\{[\s\S]*?)\s*```/g,
	];

	for (const pattern of codeBlockPatterns) {
		const matches = [...input.matchAll(pattern)];
		for (const match of matches) {
			if (match[1]) {
				const result = parseJsonString<T>(match[1]);
				if (result.success) {
					loggingService.debug("JSON extracted from code block:", {
						pattern: pattern.toString(),
						extractedLength: match[1].length,
					});
					return result;
				}
			}
		}
	}

	// Strategy 2: Try to find JSON object in the string
	const jsonMatch = input.match(/\{[\s\S]*\}/);
	if (jsonMatch) {
		const result = parseJsonString<T>(jsonMatch[0]);
		if (result.success) {
			return result;
		}
	}

	// Strategy 3: Try to find JSON array
	const arrayMatch = input.match(/\[[\s\S]*\]/);
	if (arrayMatch) {
		const result = parseJsonString<T>(arrayMatch[0]);
		if (result.success) {
			return result;
		}
	}

	return {
		success: false,
		error: "No valid JSON found in input",
	};
}

/**
 * Parse a JSON string with cleaning and fallback strategies
 */
function parseJsonString<T = unknown>(jsonString: string): JsonParseResult<T> {
	// Clean the JSON string
	const cleanedJson = cleanJsonString(jsonString);

	// Try jsonc-parser first (more tolerant)
	try {
		const parsed = parseJsonc(cleanedJson) as T;
		return {
			success: true,
			data: parsed,
			cleanedJson,
		};
	} catch (error) {
		loggingService.debug(
			"jsonc-parser failed, trying additional repairs:",
			error
		);

		// Try additional repairs before falling back to native JSON.parse
		const furtherRepaired = performAdditionalRepairs(cleanedJson);
		if (furtherRepaired !== cleanedJson) {
			try {
				const parsed = parseJsonc(furtherRepaired) as T;
				return {
					success: true,
					data: parsed,
					cleanedJson: furtherRepaired,
				};
			} catch (secondError) {
				loggingService.debug(
					"Additional repairs also failed, trying native JSON.parse:",
					secondError
				);
			}
		}
	}

	// Fallback to native JSON.parse
	try {
		const parsed = JSON.parse(cleanedJson) as T;
		return {
			success: true,
			data: parsed,
			cleanedJson,
		};
	} catch (error) {
		loggingService.debug("Native JSON.parse failed:", error);
	}

	// Last resort: try to extract partial data
	return extractPartialData<T>(cleanedJson);
}

/**
 * Clean common JSON issues
 */
function cleanJsonString(jsonString: string): string {
	let cleaned = jsonString.trim();

	// First, try to repair the specific malformed JSON pattern we're seeing
	cleaned = repairMalformedJson(cleaned);

	// Remove trailing commas before closing braces/brackets
	cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

	// Fix unescaped quotes in strings (basic pattern)
	cleaned = cleaned.replace(/"([^"]*)"([^"]*)"([^"]*)":/g, '"$1$2$3":');

	// Remove comments (// and /* */)
	cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
	cleaned = cleaned.replace(/\/\/.*$/gm, "");

	// Fix common AI response issues
	cleaned = cleaned.replace(/\n\s*\n/g, "\n"); // Remove empty lines
	cleaned = cleaned.replace(/\s+/g, " "); // Normalize whitespace

	return cleaned;
}

/**
 * Repair specific malformed JSON patterns from AI responses
 */
function repairMalformedJson(jsonString: string): string {
	let repaired = jsonString;

	// Log the original for debugging
	loggingService.debug("Repairing malformed JSON:", {
		originalLength: jsonString.length,
		originalPreview: jsonString.substring(0, 200),
	});

	// Fix the specific pattern: "winProbability: { score" -> "winProbability": { "score"
	repaired = repaired.replace(
		/"winProbability:\s*\{\s*score":/g,
		'"winProbability": { "score":'
	);

	// Fix similar patterns for other top-level keys
	repaired = repaired.replace(
		/"marketIntelligence:\s*\{/g,
		'"marketIntelligence": {'
	);
	repaired = repaired.replace(
		/"recommendations:\s*\{/g,
		'"recommendations": {'
	);
	repaired = repaired.replace(
		/"implementationRoadmap:\s*\{/g,
		'"implementationRoadmap": {'
	);
	repaired = repaired.replace(
		/"attachmentAnalysis:\s*\{/g,
		'"attachmentAnalysis": {'
	);

	// Fix malformed nested object patterns
	// Pattern: "confidence: 78, factors" -> "confidence": 78, "factors"
	repaired = repaired.replace(
		/"confidence:\s*(\d+),\s*factors":/g,
		'"confidence": $1, "factors":'
	);

	// Fix malformed factor patterns
	// Pattern: "competitionLevel: 30, agencyPreference" -> "competitionLevel": 30, "agencyPreference"
	repaired = repaired.replace(
		/"competitionLevel:\s*(\d+),\s*agencyPreference":/g,
		'"competitionLevel": $1, "agencyPreference":'
	);
	repaired = repaired.replace(
		/"historicalSuccess:\s*(\d+),\s*setAsideAdvantage":/g,
		'"historicalSuccess": $1, "setAsideAdvantage":'
	);
	repaired = repaired.replace(
		/"timingAdvantage:\s*(\d+),\s*technicalFit":/g,
		'"timingAdvantage": $1, "technicalFit":'
	);
	repaired = repaired.replace(
		/"pastPerformance:\s*(\d+),\s*pricingCompetitiveness":/g,
		'"pastPerformance": $1, "pricingCompetitiveness":'
	);

	// Fix malformed array patterns
	// Pattern: "keySuccessFactors: [" -> "keySuccessFactors": [
	repaired = repaired.replace(
		/"keySuccessFactors:\s*\[/g,
		'"keySuccessFactors": ['
	);
	repaired = repaired.replace(
		/"criticalChallenges:\s*\[/g,
		'"criticalChallenges": ['
	);
	repaired = repaired.replace(
		/"recommendations:\s*\[/g,
		'"recommendations": ['
	);

	// Fix malformed string patterns
	// Pattern: "detailedAnalysis: "text"" -> "detailedAnalysis": "text"
	repaired = repaired.replace(
		/"detailedAnalysis:\s*"/g,
		'"detailedAnalysis": "'
	);

	// Log the repaired version for debugging
	loggingService.debug("Repaired JSON:", {
		repairedLength: repaired.length,
		repairedPreview: repaired.substring(0, 200),
		wasChanged: repaired !== jsonString,
	});

	return repaired;
}

/**
 * Perform additional repairs for stubborn JSON issues
 */
function performAdditionalRepairs(jsonString: string): string {
	let repaired = jsonString;

	// Fix malformed object structure where keys are not properly quoted
	// Pattern: { key: value } -> { "key": "value" }
	repaired = repaired.replace(
		/\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([^,}]+)(?=[,}])/g,
		'{ "$1": "$2"'
	);

	// Fix malformed nested objects
	// Pattern: { key: { nestedKey: value } } -> { "key": { "nestedKey": "value" } }
	repaired = repaired.replace(
		/\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([^,}]+)(?=[,}])/g,
		'{ "$1": { "$2": "$3"'
	);

	// Fix malformed arrays
	// Pattern: [ value1, value2 ] -> [ "value1", "value2" ]
	repaired = repaired.replace(/\[\s*([^",\]]+)(?=[,\]])/g, '[ "$1"');

	// Fix missing quotes around string values in arrays
	repaired = repaired.replace(/,\s*([^",\]]+)(?=[,\]])/g, ', "$1"');

	// Fix specific patterns we've seen in the logs
	// Pattern: "winProbability: { score": 42 -> "winProbability": { "score": 42
	repaired = repaired.replace(
		/"winProbability:\s*\{\s*score":\s*(\d+)/g,
		'"winProbability": { "score": $1'
	);

	// Pattern: "confidence: 78, factors": { -> "confidence": 78, "factors": {
	repaired = repaired.replace(
		/"confidence:\s*(\d+),\s*factors":\s*\{/g,
		'"confidence": $1, "factors": {'
	);

	loggingService.debug("Additional repairs applied:", {
		originalLength: jsonString.length,
		repairedLength: repaired.length,
		wasChanged: repaired !== jsonString,
	});

	return repaired;
}

/**
 * Extract partial data when JSON parsing completely fails
 */
function extractPartialData<T = unknown>(
	jsonString: string
): JsonParseResult<T> {
	try {
		// Try to extract key-value pairs using regex
		const keyValuePairs: Record<string, unknown> = {};

		// Extract string values
		const stringMatches = jsonString.match(/"([^"]+)":\s*"([^"]*)"/g);
		if (stringMatches) {
			stringMatches.forEach(match => {
				const [, key, value] = match.match(/"([^"]+)":\s*"([^"]*)"/) || [];
				if (key && value !== undefined) {
					keyValuePairs[key] = value;
				}
			});
		}

		// Extract number values
		const numberMatches = jsonString.match(/"([^"]+)":\s*(\d+(?:\.\d+)?)/g);
		if (numberMatches) {
			numberMatches.forEach(match => {
				const [, key, value] =
					match.match(/"([^"]+)":\s*(\d+(?:\.\d+)?)/) || [];
				if (key && value !== undefined) {
					keyValuePairs[key] = parseFloat(value);
				}
			});
		}

		// Extract boolean values
		const booleanMatches = jsonString.match(/"([^"]+)":\s*(true|false)/g);
		if (booleanMatches) {
			booleanMatches.forEach(match => {
				const [, key, value] = match.match(/"([^"]+)":\s*(true|false)/) || [];
				if (key && value !== undefined) {
					keyValuePairs[key] = value === "true";
				}
			});
		}

		if (Object.keys(keyValuePairs).length > 0) {
			return {
				success: true,
				data: keyValuePairs as T,
				cleanedJson: jsonString,
			};
		}

		return {
			success: false,
			error: "Unable to extract any valid data from malformed JSON",
			cleanedJson: jsonString,
		};
	} catch (error) {
		return {
			success: false,
			error: `Partial data extraction failed: ${error}`,
			cleanedJson: jsonString,
		};
	}
}

/**
 * Validate that parsed data has required fields
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
	data: T,
	requiredFields: (keyof T)[]
): { isValid: boolean; missingFields: (keyof T)[] } {
	const missingFields = requiredFields.filter(field => {
		const value = data[field];
		return value === undefined || value === null || value === "";
	});

	return {
		isValid: missingFields.length === 0,
		missingFields,
	};
}

/**
 * Safe JSON stringify with error handling
 */
export function stringifyJson(data: unknown, space?: number): string {
	try {
		return JSON.stringify(data, null, space);
	} catch (error) {
		loggingService.error("JSON stringify failed:", error);
		return "{}";
	}
}

// Export the main parsing function as default
export default parseJson;
