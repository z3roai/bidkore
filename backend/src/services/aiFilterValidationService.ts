import loggingService from "@/services/loggingService";

export interface AIFilterValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
	suggestions: string[];
}

export interface FilterValidationOptions {
	strictMode?: boolean;
	allowEmptyCriteria?: boolean;
	validateConsistency?: boolean;
}

export interface FilterCriteria {
	keywords?: string[];
	naicsCodes?: string[];
	agencies?: string[];
	setAsides?: string[];
	types?: string[];
	locations?: string[];
	postedFrom?: Date | string;
	postedTo?: Date | string;
	responseDeadlineFrom?: Date | string;
	responseDeadlineTo?: Date | string;
	estimatedValueMin?: number;
	estimatedValueMax?: number;
	classificationCodes?: string[];
	[key: string]: unknown;
}

class AIFilterValidationService {
	/**
	 * Validates AI-generated filter data
	 */
	validateAIFilter(
		naturalLanguage: string | null | undefined,
		criteria: FilterCriteria,
		options: FilterValidationOptions = {}
	): AIFilterValidationResult {
		const result: AIFilterValidationResult = {
			isValid: true,
			errors: [],
			warnings: [],
			suggestions: [],
		};

		const {
			strictMode = false,
			allowEmptyCriteria = false,
			validateConsistency = true,
		} = options;

		// Check if natural language exists
		if (!naturalLanguage || naturalLanguage.trim().length === 0) {
			if (strictMode) {
				result.errors.push(
					"Natural language description is required for AI-generated filters"
				);
				result.isValid = false;
			} else {
				result.warnings.push("No natural language description provided");
			}
		}

		// Validate criteria structure
		const criteriaValidation = this.validateCriteriaStructure(
			criteria,
			allowEmptyCriteria
		);
		if (!criteriaValidation.isValid) {
			result.errors.push(...criteriaValidation.errors);
			result.isValid = false;
		}
		result.warnings.push(...criteriaValidation.warnings);

		// Validate consistency between natural language and criteria
		if (validateConsistency && naturalLanguage) {
			const consistencyValidation = this.validateConsistency(
				naturalLanguage,
				criteria
			);
			if (!consistencyValidation.isValid) {
				result.errors.push(...consistencyValidation.errors);
				result.isValid = false;
			}
			result.warnings.push(...consistencyValidation.warnings);
			result.suggestions.push(...consistencyValidation.suggestions);
		}

		// Log validation results
		if (!result.isValid) {
			loggingService.warn("AI Filter validation failed", {
				errors: result.errors,
				warnings: result.warnings,
				naturalLanguageLength: naturalLanguage?.length ?? 0,
				criteriaKeys: Object.keys(criteria ?? {}),
			});
		}

		return result;
	}

	/**
	 * Validates the structure of filter criteria
	 */
	private validateCriteriaStructure(
		criteria: FilterCriteria,
		allowEmpty: boolean
	): AIFilterValidationResult {
		const result: AIFilterValidationResult = {
			isValid: true,
			errors: [],
			warnings: [],
			suggestions: [],
		};

		if (!criteria) {
			result.errors.push("Criteria must be provided");
			result.isValid = false;
			return result;
		}

		if (typeof criteria !== "object") {
			result.errors.push("Criteria must be a valid object");
			result.isValid = false;
			return result;
		}

		// Check for valid criteria fields
		const validFields = [
			"keywords",
			"naicsCodes",
			"agencies",
			"setAsides",
			"types",
			"locations",
			"postedFrom",
			"postedTo",
			"responseDeadlineFrom",
			"responseDeadlineTo",
			"estimatedValueMin",
			"estimatedValueMax",
			"classificationCodes",
		];

		const hasValidFields = validFields.some(field => {
			const value = criteria[field];
			if (Array.isArray(value)) {
				return value.length > 0;
			}
			if (typeof value === "string") {
				return value.trim().length > 0;
			}
			if (typeof value === "number") {
				return value > 0;
			}
			if (value instanceof Date) {
				return true;
			}
			return false;
		});

		if (!hasValidFields && !allowEmpty) {
			result.errors.push("At least one valid criteria field must be provided");
			result.isValid = false;
		}

		// Validate array fields
		const arrayFields = [
			"keywords",
			"naicsCodes",
			"agencies",
			"setAsides",
			"types",
			"locations",
			"classificationCodes",
		];
		arrayFields.forEach(field => {
			if (criteria[field] && !Array.isArray(criteria[field])) {
				result.warnings.push(`${field} should be an array`);
			}
		});

		// Validate date fields
		const dateFields = [
			"postedFrom",
			"postedTo",
			"responseDeadlineFrom",
			"responseDeadlineTo",
		];
		dateFields.forEach(field => {
			if (
				criteria[field] &&
				!(criteria[field] instanceof Date) &&
				typeof criteria[field] === "string" &&
				!this.isValidDateString(criteria[field])
			) {
				result.warnings.push(`${field} should be a valid date`);
			}
		});

		// Validate numeric fields
		const numericFields = ["estimatedValueMin", "estimatedValueMax"];
		numericFields.forEach(field => {
			if (
				criteria[field] !== undefined &&
				(typeof criteria[field] !== "number" ||
					(typeof criteria[field] === "number" && criteria[field] < 0))
			) {
				result.warnings.push(`${field} should be a positive number`);
			}
		});

		return result;
	}

	/**
	 * Validates consistency between natural language and structured criteria
	 */
	private validateConsistency(
		naturalLanguage: string,
		criteria: FilterCriteria
	): AIFilterValidationResult {
		const result: AIFilterValidationResult = {
			isValid: true,
			errors: [],
			warnings: [],
			suggestions: [],
		};

		const nlLower = naturalLanguage.toLowerCase();

		// Check for keyword consistency
		if (criteria.keywords && Array.isArray(criteria.keywords)) {
			const missingKeywords = criteria.keywords.filter(
				(keyword: string) => !nlLower.includes(keyword.toLowerCase())
			);

			if (missingKeywords.length > 0) {
				result.warnings.push(
					`Keywords [${missingKeywords.join(
						", "
					)}] not found in natural language description`
				);
				result.suggestions.push(
					"Consider updating natural language to include all keywords"
				);
			}
		}

		// Check for value range consistency
		if (criteria.estimatedValueMin ?? criteria.estimatedValueMax) {
			const hasValueMention = /\$[\d,]+|\d+\s*(k|thousand|million|m)/i.test(
				naturalLanguage
			);
			if (!hasValueMention) {
				result.warnings.push(
					"Value range specified in criteria but not mentioned in natural language"
				);
				result.suggestions.push(
					"Consider mentioning value range in natural language description"
				);
			}
		}

		// Check for date range consistency
		const hasDateMention =
			/(posted|deadline|due|from|to|between).*\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/i.test(
				naturalLanguage
			);
		const hasDateCriteria =
			criteria.postedFrom ??
			criteria.postedTo ??
			criteria.responseDeadlineFrom ??
			criteria.responseDeadlineTo;

		if (hasDateCriteria && !hasDateMention) {
			result.warnings.push(
				"Date range specified in criteria but not mentioned in natural language"
			);
			result.suggestions.push(
				"Consider mentioning date range in natural language description"
			);
		}

		return result;
	}

	/**
	 * Checks if a string is a valid date
	 */
	private isValidDateString(dateStr: string): boolean {
		const date = new Date(dateStr);
		return !Number.isNaN(date.getTime());
	}

	/**
	 * Attempts to parse natural language into structured criteria
	 */
	parseNaturalLanguageToCriteria(naturalLanguage: string): FilterCriteria {
		const criteria: FilterCriteria = {};

		try {
			// Extract keywords (simple keyword extraction)
			const keywordMatches = naturalLanguage.match(
				/\b(software|development|technology|defense|healthcare|education|construction|consulting|services|equipment|supplies)\b/gi
			);
			if (keywordMatches) {
				criteria.keywords = Array.from(
					new Set(keywordMatches.map(k => k.toLowerCase()))
				);
			}

			// Extract value ranges
			const valueMatches = naturalLanguage.match(
				/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(k|thousand|million|m|billion|b)?/gi
			);
			if (valueMatches) {
				const values = valueMatches
					.map(match => {
						const numMatch = match.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
						const unitMatch = match.match(/(k|thousand|million|m|billion|b)/i);

						if (numMatch && numMatch[1]) {
							let value = parseFloat(numMatch[1].replace(/,/g, ""));
							if (unitMatch && unitMatch[1]) {
								const unit = unitMatch[1].toLowerCase();
								if (unit === "k" || unit === "thousand") {
									value *= 1000;
								} else if (unit === "million" || unit === "m") {
									value *= 1000000;
								} else if (unit === "billion" || unit === "b") {
									value *= 1000000000;
								}
							}
							return value;
						}
						return null;
					})
					.filter(v => v !== null);

				if (values.length > 0) {
					criteria.estimatedValueMin = Math.min(...values);
					criteria.estimatedValueMax = Math.max(...values);
				}
			}

			// Extract agencies
			const agencyMatches = naturalLanguage.match(
				/\b(department of defense|dod|department of health|doh|department of education|doe|general services administration|gsa|national aeronautics and space administration|nasa)\b/gi
			);
			if (agencyMatches) {
				criteria.agencies = Array.from(
					new Set(agencyMatches.map(a => a.toLowerCase()))
				);
			}

			loggingService.info("Successfully parsed natural language to criteria", {
				originalLength: naturalLanguage.length,
				extractedFields: Object.keys(criteria),
			});
		} catch (error) {
			loggingService.error(
				"Failed to parse natural language to criteria:",
				error
			);
		}

		return criteria;
	}

	/**
	 * Checks if criteria has valid content
	 */
	hasValidCriteria(criteria: FilterCriteria): boolean {
		if (!criteria) {
			return false;
		}

		if (typeof criteria !== "object") {
			return false;
		}

		return Object.values(criteria).some(value => {
			if (Array.isArray(value)) {
				return value.length > 0;
			}
			if (typeof value === "string") {
				return value.trim().length > 0;
			}
			if (typeof value === "number") {
				return value > 0;
			}
			if (value instanceof Date) {
				return true;
			}
			return false;
		});
	}
}

export default new AIFilterValidationService();
