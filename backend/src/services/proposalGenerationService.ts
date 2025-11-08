import prisma from "@/config/prisma";
import loggingService from "@/services/loggingService";
import openaiService from "@/services/openaiService";
import insightsEngine from "@/services/insightsEngine";
import type { Opportunity } from "@prisma/client";
import type { CompanyProfile } from "@prisma/client";

interface ProposalSections {
	executiveSummary: string;
	technicalApproach: string;
	pastPerformance: string;
	keyPersonnel: string;
	managementPlan: string;
}

interface GenerateProposalRequest {
	opportunityId: string;
	userId: string;
}

interface GenerateProposalResponse {
	id: string;
	title: string;
	sections: ProposalSections;
	complianceScore: number;
	aiRecommendations: string[];
	status: string;
	createdAt: Date;
	updatedAt: Date;
}

interface ComplianceCheckResult {
	score: number;
	checks: Array<{
		requirement: string;
		status: "met" | "partial" | "missing";
		details: string;
	}>;
	recommendations: string[];
}

interface ImprovementSuggestion {
	improvedText: string;
	changes: string[];
	score: number;
}

interface ExtractedRequirements {
	technical: string[];
	compliance: string[];
	qualifications: string[];
	deliverables: string[];
}

class ProposalGenerationService {
	private async fetchOpportunityWithInsights(opportunityId: string) {
		const opportunity = await prisma.opportunity.findUnique({
			where: { id: opportunityId },
		});

		if (!opportunity) {
			throw new Error("Opportunity not found");
		}

		const insights = await insightsEngine.generateInsights(opportunity as any);

		return { opportunity, insights };
	}

	private async fetchCompanyProfile(userId: string) {
		return await prisma.companyProfile.findUnique({
			where: { userId },
		});
	}

	private buildProposalPrompt(
		opportunity: Opportunity,
		companyProfile: CompanyProfile | null,
		insights: any
	): string {
		const companyInfo = companyProfile
			? `Company Name: ${companyProfile.companyName || "Not specified"}
DUNS: ${companyProfile.dunsNumber || "Not specified"}
CAGE Code: ${companyProfile.cageCode || "Not specified"}
UEI: ${companyProfile.ueiNumber || "Not specified"}
Certifications: ${companyProfile.certifications.join(", ") || "None"}
NAICS Codes: ${companyProfile.naicsCodes.join(", ") || "None"}
Employees: ${companyProfile.numberOfEmployees || "Not specified"}
Description: ${companyProfile.description || "Not specified"}`
			: "Company information not available";

		return `Generate a professional government contract proposal for the following opportunity.

OPPORTUNITY DETAILS:
Title: ${opportunity.title}
Agency: ${opportunity.fullParentPathName || "Not specified"}
Type: ${opportunity.type || "Not specified"}
NAICS Code: ${opportunity.naicsCode || "Not specified"}
Response Deadline: ${opportunity.responseDeadLine ? new Date(opportunity.responseDeadLine).toLocaleDateString() : "Not specified"}
Description: ${opportunity.description || "Not specified"}
Set-Aside: ${opportunity.typeOfSetAsideDescription || "None"}

COMPANY INFORMATION:
${companyInfo}

WIN PROBABILITY ANALYSIS:
Overall Score: ${insights.winProbability.score}/100
Competition Level: ${insights.competitionAnalysis.competitionDensity}
Expected Bidders: ${insights.competitionAnalysis.expectedBidders}
Key Recommendations: ${insights.winProbability.recommendations.join("; ")}

REQUIREMENTS:
Generate a comprehensive proposal with the following sections:

1. EXECUTIVE SUMMARY
   - Brief overview of your company and qualifications
   - Clear statement of understanding the requirement
   - Value proposition and key differentiators
   - Competitive advantages

2. TECHNICAL APPROACH
   - Detailed methodology and approach
   - Timeline and milestones
   - Risk mitigation strategies
   - Quality assurance processes
   - Technical capabilities demonstration

3. PAST PERFORMANCE
   - Relevant similar projects
   - Demonstrated success metrics
   - Client references context
   - Lessons learned and improvements

4. KEY PERSONNEL
   - Team structure and roles
   - Qualifications summary
   - Relevant experience
   - Management approach

5. MANAGEMENT PLAN
   - Project management methodology
   - Communication strategy
   - Reporting structure
   - Resource allocation

STYLE REQUIREMENTS:
- Professional, formal government contracting language
- Clear, concise, and well-structured
- Address all stated requirements
- Demonstrate understanding and capability
- Focus on value delivery
- Use active voice
- Include specific metrics and examples where possible

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure:
{
  "executiveSummary": "content here",
  "technicalApproach": "content here",
  "pastPerformance": "content here",
  "keyPersonnel": "content here",
  "managementPlan": "content here"
}

Generate the proposal now.`;
	}

	private calculateComplianceScore(
		sections: ProposalSections,
		opportunity: Opportunity
	): number {
		let score = 0;
		const maxScore = 100;
		const sectionWeight = maxScore / 5;

		if (sections.executiveSummary && sections.executiveSummary.length > 200)
			score += sectionWeight;
		if (sections.technicalApproach && sections.technicalApproach.length > 500)
			score += sectionWeight;
		if (sections.pastPerformance && sections.pastPerformance.length > 300)
			score += sectionWeight;
		if (sections.keyPersonnel && sections.keyPersonnel.length > 200)
			score += sectionWeight;
		if (sections.managementPlan && sections.managementPlan.length > 300)
			score += sectionWeight;

		return Math.round(score);
	}

	private async generateAIRecommendations(
		sections: ProposalSections,
		opportunity: Opportunity,
		complianceScore: number
	): Promise<string[]> {
		const recommendations: string[] = [];

		if (complianceScore < 70) {
			recommendations.push(
				"Expand content in all sections to meet minimum requirements"
			);
		}

		if (sections.technicalApproach.length < 500) {
			recommendations.push(
				"Add more technical depth and specific methodologies"
			);
		}

		if (sections.pastPerformance.length < 300) {
			recommendations.push(
				"Include quantified outcomes from past projects and specific metrics"
			);
		}

		if (!sections.executiveSummary.includes("qualif")) {
			recommendations.push(
				"Highlight key qualifications more prominently in executive summary"
			);
		}

		if (complianceScore >= 85) {
			recommendations.push("Strong technical depth demonstrated");
		}

		return recommendations;
	}

	async generateProposal(
		request: GenerateProposalRequest
	): Promise<GenerateProposalResponse> {
		try {
			loggingService.info("Starting proposal generation", {
				opportunityId: request.opportunityId,
				userId: request.userId,
			});

			const { opportunity, insights } =
				await this.fetchOpportunityWithInsights(request.opportunityId);
			const companyProfile = await this.fetchCompanyProfile(request.userId);

			const prompt = this.buildProposalPrompt(
				opportunity,
				companyProfile,
				insights
			);

			loggingService.info("Calling OpenAI for proposal generation");

			const aiResponse = await openaiService.callOpenAICompletion(prompt);

			let sections: ProposalSections;
			try {
				const cleanResponse = aiResponse
					.replace(/```json\n?/g, "")
					.replace(/```\n?/g, "")
					.trim();
				sections = JSON.parse(cleanResponse);
			} catch (parseError) {
				loggingService.error("Failed to parse AI response", {
					error: parseError,
					response: aiResponse.substring(0, 500),
				});
				throw new Error("Failed to generate structured proposal content");
			}

			const complianceScore = this.calculateComplianceScore(
				sections,
				opportunity
			);
			const aiRecommendations = await this.generateAIRecommendations(
				sections,
				opportunity,
				complianceScore
			);

			const proposal = await prisma.proposal.create({
				data: {
					userId: request.userId,
					opportunityId: request.opportunityId,
					title: `${opportunity.title} - Proposal`,
					sections: sections as any,
					complianceScore,
					aiRecommendations: aiRecommendations as any,
					status: "DRAFT",
				},
			});

			loggingService.info("Proposal generated successfully", {
				proposalId: proposal.id,
				complianceScore,
			});

			return {
				id: proposal.id,
				title: proposal.title,
				sections,
				complianceScore,
				aiRecommendations,
				status: proposal.status,
				createdAt: proposal.createdAt,
				updatedAt: proposal.updatedAt,
			};
		} catch (error) {
			loggingService.error("Proposal generation failed", { error });
			throw error;
		}
	}

	async generateSection(
		sectionName: keyof ProposalSections,
		context: {
			opportunityId: string;
			existingContent?: string;
			userId: string;
		}
	): Promise<string> {
		try {
			const { opportunity, insights } =
				await this.fetchOpportunityWithInsights(context.opportunityId);
			const companyProfile = await this.fetchCompanyProfile(context.userId);

			const sectionPrompts: Record<keyof ProposalSections, string> = {
				executiveSummary: `Generate an executive summary for a government contract proposal.
Opportunity: ${opportunity.title}
Agency: ${opportunity.fullParentPathName}
Company: ${companyProfile?.companyName || "Your Company"}
Win Probability: ${insights.winProbability.score}/100

Include:
- Brief company introduction and qualifications
- Understanding of the requirement
- Value proposition
- Key differentiators

Length: 300-500 words`,

				technicalApproach: `Generate a technical approach section for a government contract proposal.
Opportunity: ${opportunity.title}
Description: ${opportunity.description}
Company Capabilities: ${companyProfile?.description || "Not specified"}

Include:
- Detailed methodology
- Implementation timeline
- Risk mitigation
- Quality assurance
- Technical capabilities

Length: 800-1200 words`,

				pastPerformance: `Generate a past performance section for a government contract proposal.
Opportunity: ${opportunity.title}
Similar NAICS: ${opportunity.naicsCode}
Company: ${companyProfile?.companyName || "Your Company"}

Include:
- Relevant similar projects
- Success metrics and outcomes
- Client satisfaction indicators
- Lessons learned

Length: 500-800 words`,

				keyPersonnel: `Generate a key personnel section for a government contract proposal.
Opportunity: ${opportunity.title}
Required Skills: ${opportunity.naicsCode}

Include:
- Team structure
- Key roles and responsibilities
- Qualifications overview
- Relevant experience

Length: 400-600 words`,

				managementPlan: `Generate a management plan section for a government contract proposal.
Opportunity: ${opportunity.title}
Company: ${companyProfile?.companyName || "Your Company"}

Include:
- Project management methodology
- Communication strategy
- Reporting structure
- Resource allocation

Length: 500-700 words`,
			};

			const prompt = sectionPrompts[sectionName];
			const content = await openaiService.callOpenAICompletion(prompt);

			return content.trim();
		} catch (error) {
			loggingService.error("Section generation failed", { error, sectionName });
			throw error;
		}
	}

	async improveText(
		text: string,
		context: { opportunityId?: string; sectionType?: string }
	): Promise<ImprovementSuggestion> {
		try {
			const prompt = `Improve the following government contract proposal text.
${context.sectionType ? `Section Type: ${context.sectionType}` : ""}

Original Text:
${text}

Requirements:
- Enhance clarity and professionalism
- Strengthen technical language
- Add specific examples or metrics where appropriate
- Maintain formal government contracting tone
- Ensure active voice
- Improve structure and flow

Return ONLY valid JSON with this structure:
{
  "improvedText": "the improved version",
  "changes": ["description of key changes made"],
  "score": 85
}`;

			const response = await openaiService.callOpenAICompletion(prompt);

			const cleanResponse = response
				.replace(/```json\n?/g, "")
				.replace(/```\n?/g, "")
				.trim();
			const result = JSON.parse(cleanResponse);

			return {
				improvedText: result.improvedText,
				changes: result.changes,
				score: result.score,
			};
		} catch (error) {
			loggingService.error("Text improvement failed", { error });
			throw error;
		}
	}

	async checkCompliance(proposalId: string): Promise<ComplianceCheckResult> {
		try {
			const proposal = await prisma.proposal.findUnique({
				where: { id: proposalId },
				include: { opportunity: true },
			});

			if (!proposal) {
				throw new Error("Proposal not found");
			}

			const sections = proposal.sections as unknown as ProposalSections;
			const checks: ComplianceCheckResult["checks"] = [];

			checks.push({
				requirement: "Executive Summary",
				status:
					sections.executiveSummary && sections.executiveSummary.length > 200
						? "met"
						: "missing",
				details:
					sections.executiveSummary && sections.executiveSummary.length > 200
						? "Executive summary is complete and comprehensive"
						: "Executive summary needs expansion",
			});

			checks.push({
				requirement: "Technical Approach",
				status:
					sections.technicalApproach && sections.technicalApproach.length > 500
						? "met"
						: "partial",
				details:
					sections.technicalApproach && sections.technicalApproach.length > 500
						? "Technical approach is detailed and comprehensive"
						: "Technical approach needs more detail",
			});

			checks.push({
				requirement: "Past Performance",
				status:
					sections.pastPerformance && sections.pastPerformance.length > 300
						? "met"
						: "missing",
				details:
					sections.pastPerformance && sections.pastPerformance.length > 300
						? "Past performance section is adequate"
						: "Past performance section needs more examples",
			});

			const metCount = checks.filter(c => c.status === "met").length;
			const score = Math.round((metCount / checks.length) * 100);

			const recommendations: string[] = [];
			checks
				.filter(c => c.status !== "met")
				.forEach(c => {
					recommendations.push(`Address ${c.requirement}: ${c.details}`);
				});

			if (score >= 85) {
				recommendations.push("Proposal meets high compliance standards");
			}

			await prisma.proposal.update({
				where: { id: proposalId },
				data: { complianceScore: score },
			});

			return { score, checks, recommendations };
		} catch (error) {
			loggingService.error("Compliance check failed", { error });
			throw error;
		}
	}

	async extractRequirements(
		opportunityId: string
	): Promise<ExtractedRequirements> {
		try {
			const opportunity = await prisma.opportunity.findUnique({
				where: { id: opportunityId },
			});

			if (!opportunity) {
				throw new Error("Opportunity not found");
			}

			const prompt = `Extract and categorize requirements from this government opportunity.

Title: ${opportunity.title}
Description: ${opportunity.description || "Not provided"}
Type: ${opportunity.type || "Not specified"}
NAICS: ${opportunity.naicsCode || "Not specified"}

Extract and return requirements in ONLY valid JSON format:
{
  "technical": ["requirement 1", "requirement 2"],
  "compliance": ["compliance 1", "compliance 2"],
  "qualifications": ["qualification 1", "qualification 2"],
  "deliverables": ["deliverable 1", "deliverable 2"]
}

Focus on extracting actual requirements, not assumptions.`;

			const response = await openaiService.callOpenAICompletion(prompt);

			const cleanResponse = response
				.replace(/```json\n?/g, "")
				.replace(/```\n?/g, "")
				.trim();
			const requirements = JSON.parse(cleanResponse);

			return {
				technical: requirements.technical || [],
				compliance: requirements.compliance || [],
				qualifications: requirements.qualifications || [],
				deliverables: requirements.deliverables || [],
			};
		} catch (error) {
			loggingService.error("Requirements extraction failed", { error });
			throw error;
		}
	}
}

export default new ProposalGenerationService();
