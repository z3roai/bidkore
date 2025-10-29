import loggingService from "@/services/loggingService";
import openaiService from "@/services/openaiService";
import { parseJson } from "@/utils/jsonParser";

export interface RewrittenDescription {
	originalDescription: string;
	rewrittenDescription: string;
	keyPoints: string[];
	technicalRequirements: string[];
	complianceRequirements: string[];
	performanceCriteria: string[];
	riskFactors: string[];
	opportunityHighlights: string[];
}

class DescriptionRewritingService {
	private readonly AI_ENABLED = true;

	async rewriteDescription(
		originalDescription: string,
		opportunityTitle: string,
		naicsCode?: string,
		agency?: string
	): Promise<RewrittenDescription> {
		if (!this.AI_ENABLED) {
			return this.generateFallbackDescription(originalDescription);
		}

		try {
			const isAvailable = openaiService.isServiceAvailable();
			if (!isAvailable) {
				return this.generateFallbackDescription(originalDescription);
			}

			const prompt = this.buildRewritingPrompt(
				originalDescription,
				opportunityTitle,
				naicsCode,
				agency
			);

			const aiResponse = await this.callOpenAICompletion(prompt);
			return this.parseAIResponse(aiResponse, originalDescription);
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn(
				"Description rewriting failed, using fallback:",
				errorMessage
			);
			return this.generateFallbackDescription(originalDescription);
		}
	}

	private buildRewritingPrompt(
		originalDescription: string,
		opportunityTitle: string,
		naicsCode?: string,
		agency?: string
	): string {
		return `
You are a highly experienced federal contracting professional and technical writer with deep expertise in government solicitations. Your role is to analyze, rewrite, and enhance contract opportunity descriptions so they are clear, professional, and strategically actionable, ensuring potential bidders can easily understand requirements, assess relevance, and respond effectively.

REWRITING REQUIREMENTS:
- Transform the description into professional, clear, and comprehensive language
- Maintain all technical accuracy and compliance requirements
- Enhance readability and structure for better understanding
- Extract and highlight key technical and business requirements
- Identify compliance and regulatory requirements
- Highlight performance criteria and evaluation factors
- Identify potential risks and mitigation opportunities
- Emphasize opportunity value and strategic importance

ORIGINAL DESCRIPTION:
${originalDescription}

OPPORTUNITY CONTEXT:
- Title: ${opportunityTitle}
- NAICS Code: ${naicsCode || "Not specified"}
- Agency: ${agency || "Not specified"}

Please provide a comprehensive analysis and rewriting in this JSON format:
{
  "rewrittenDescription": "Professional, clear, and comprehensive description of the opportunity with enhanced structure and clarity",
  "keyPoints": [
    "Key technical requirements and specifications",
    "Critical business objectives and deliverables",
    "Important timeline and milestone information",
    "Strategic value and importance of the opportunity"
  ],
  "technicalRequirements": [
    "Specific technical capabilities required",
    "Equipment and technology specifications",
    "Performance standards and metrics",
    "Quality assurance and testing requirements"
  ],
  "complianceRequirements": [
    "Regulatory compliance requirements",
    "Certification and qualification standards",
    "Security clearance requirements",
    "Documentation and reporting standards"
  ],
  "performanceCriteria": [
    "Key performance indicators and metrics",
    "Deliverable requirements and standards",
    "Timeline and milestone requirements",
    "Quality assurance and acceptance criteria"
  ],
  "riskFactors": [
    "Technical risks and challenges",
    "Schedule and timeline risks",
    "Compliance and regulatory risks",
    "Resource and capability risks"
  ],
  "opportunityHighlights": [
    "Strategic value and importance",
    "Market positioning opportunities",
    "Innovation and technology advancement potential",
    "Long-term relationship and follow-on opportunities"
  ]
}
`;
	}

	private parseAIResponse(
		aiResponse: string,
		originalDescription: string
	): RewrittenDescription {
		try {
			const parseResult = parseJson<{
				rewrittenDescription?: string;
				keyPoints?: string[];
				technicalRequirements?: string[];
				complianceRequirements?: string[];
				performanceCriteria?: string[];
				riskFactors?: string[];
				opportunityHighlights?: string[];
			}>(aiResponse);

			if (!parseResult.success || !parseResult.data) {
				throw new Error(`JSON parsing failed: ${parseResult.error}`);
			}

			const parsed = parseResult.data;

			return {
				originalDescription,
				rewrittenDescription:
					parsed.rewrittenDescription || originalDescription,
				keyPoints: parsed.keyPoints || [],
				technicalRequirements: parsed.technicalRequirements || [],
				complianceRequirements: parsed.complianceRequirements || [],
				performanceCriteria: parsed.performanceCriteria || [],
				riskFactors: parsed.riskFactors || [],
				opportunityHighlights: parsed.opportunityHighlights || [],
			};
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn("Failed to parse AI response:", errorMessage);
			return this.generateFallbackDescription(originalDescription);
		}
	}

	private generateFallbackDescription(
		originalDescription: string
	): RewrittenDescription {
		// Extract basic information from the description
		const keyPoints = this.extractBasicKeyPoints(originalDescription);
		const technicalRequirements =
			this.extractBasicTechnicalRequirements(originalDescription);
		const complianceRequirements =
			this.extractBasicComplianceRequirements(originalDescription);
		const performanceCriteria =
			this.extractBasicPerformanceCriteria(originalDescription);
		const riskFactors = this.extractBasicRiskFactors(originalDescription);
		const opportunityHighlights =
			this.extractBasicOpportunityHighlights(originalDescription);

		return {
			originalDescription,
			rewrittenDescription: this.rewriteDescriptionBasic(originalDescription),
			keyPoints,
			technicalRequirements,
			complianceRequirements,
			performanceCriteria,
			riskFactors,
			opportunityHighlights,
		};
	}

	private extractBasicKeyPoints(description: string): string[] {
		const points: string[] = [];

		if (description.toLowerCase().includes("rfq")) {
			points.push("Request for Quote (RFQ) - Price-focused procurement");
		}
		if (description.toLowerCase().includes("rfp")) {
			points.push(
				"Request for Proposal (RFP) - Technical and price evaluation"
			);
		}
		if (description.toLowerCase().includes("sba")) {
			points.push("Small Business Administration (SBA) set-aside opportunity");
		}
		if (description.toLowerCase().includes("electronically")) {
			points.push("Electronic submission required");
		}
		if (description.toLowerCase().includes("hard copies")) {
			points.push("No hard copies available - electronic only");
		}

		return points.length > 0
			? points
			: ["Standard government procurement opportunity"];
	}

	private extractBasicTechnicalRequirements(description: string): string[] {
		const requirements: string[] = [];

		if (description.toLowerCase().includes("nsn")) {
			requirements.push("National Stock Number (NSN) compliance required");
		}
		if (description.toLowerCase().includes("approved source")) {
			requirements.push("Approved source requirements must be met");
		}
		if (description.toLowerCase().includes("specifications")) {
			requirements.push("Technical specifications must be followed");
		}

		return requirements;
	}

	private extractBasicComplianceRequirements(description: string): string[] {
		const requirements: string[] = [];

		if (description.toLowerCase().includes("responsible sources")) {
			requirements.push("Must be a responsible source");
		}
		if (description.toLowerCase().includes("timely received")) {
			requirements.push("Timely submission required");
		}
		if (description.toLowerCase().includes("electronically")) {
			requirements.push("Electronic submission compliance");
		}

		return requirements;
	}

	private extractBasicPerformanceCriteria(description: string): string[] {
		const criteria: string[] = [];

		if (description.toLowerCase().includes("delivery")) {
			criteria.push("Delivery performance requirements");
		}
		if (description.toLowerCase().includes("quality")) {
			criteria.push("Quality standards compliance");
		}

		return criteria;
	}

	private extractBasicRiskFactors(description: string): string[] {
		const risks: string[] = [];

		if (description.toLowerCase().includes("no specifications")) {
			risks.push("Limited technical specifications available");
		}
		if (description.toLowerCase().includes("no drawings")) {
			risks.push("No technical drawings provided");
		}
		if (description.toLowerCase().includes("hard copies")) {
			risks.push("No hard copy documentation available");
		}

		return risks;
	}

	private extractBasicOpportunityHighlights(description: string): string[] {
		const highlights: string[] = [];

		if (description.toLowerCase().includes("sba")) {
			highlights.push("Small business set-aside advantage");
		}
		if (description.toLowerCase().includes("electronically")) {
			highlights.push("Streamlined electronic submission process");
		}
		if (description.toLowerCase().includes("responsible sources")) {
			highlights.push("Open to all responsible sources");
		}

		return highlights;
	}

	private rewriteDescriptionBasic(description: string): string {
		// Basic rewriting to improve readability
		let rewritten = description
			.replace(/\n\s*\n/g, "\n\n") // Clean up multiple newlines
			.replace(/\s+/g, " ") // Clean up multiple spaces
			.trim();

		// Add some basic structure if it's just a wall of text
		if (rewritten.length > 200 && !rewritten.includes("\n")) {
			// Try to break into logical paragraphs
			rewritten = rewritten
				.replace(/\.\s+(?=[A-Z])/g, ".\n\n") // Break at sentence boundaries
				.replace(/\n\s*\n\s*\n/g, "\n\n"); // Clean up excessive breaks
		}

		return rewritten;
	}

	private async callOpenAICompletion(prompt: string): Promise<string> {
		try {
			// Use the general completion method for description rewriting
			return await openaiService.callOpenAICompletion(prompt);
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn("OpenAI completion failed:", errorMessage);
			throw error;
		}
	}
}

export default new DescriptionRewritingService();
