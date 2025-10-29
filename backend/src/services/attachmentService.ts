import loggingService from "@/services/loggingService";
import type { SAMOpportunity } from "@/services/samGovService";

interface LinkObject {
	href?: string;
	rel?: string;
	url?: string;
}

export interface AttachmentInfo {
	fileName: string;
	fileType: string;
	fileSize?: string;
	description: string;
	priority: "High" | "Medium" | "Low";
	category:
		| "Solicitation"
		| "Technical"
		| "Compliance"
		| "Evaluation"
		| "Other";
	downloadUrl?: string;
	reviewDeadline?: string;
	complianceRequired: boolean;
}

export interface AttachmentAnalysis {
	hasAttachments: boolean;
	attachmentCount: number;
	criticalAttachments: AttachmentInfo[];
	allAttachments: AttachmentInfo[];
	reviewPriority: string[];
	complianceRequirements: string[];
	technicalSpecifications: string[];
	evaluationCriteria: string[];
}

class AttachmentService {
	/**
	 * Analyzes attachments for a SAM opportunity
	 */
	analyzeAttachments(opportunity: SAMOpportunity): AttachmentAnalysis {
		try {
			// Check if opportunity has attachments
			const hasAttachments = this.checkForAttachments(opportunity);

			if (!hasAttachments) {
				return this.generateNoAttachmentsAnalysis(opportunity);
			}

			// Extract attachment information from opportunity data
			const attachments = this.extractAttachmentInfo(opportunity);

			// Categorize and prioritize attachments
			const criticalAttachments = this.identifyCriticalAttachments(attachments);

			// Generate analysis
			return {
				hasAttachments: true,
				attachmentCount: attachments.length,
				criticalAttachments,
				allAttachments: attachments,
				reviewPriority: this.generateReviewPriority(attachments),
				complianceRequirements: this.extractComplianceRequirements(attachments),
				technicalSpecifications:
					this.extractTechnicalSpecifications(attachments),
				evaluationCriteria: this.extractEvaluationCriteria(attachments),
			};
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn("Attachment analysis failed:", errorMessage);
			return this.generateNoAttachmentsAnalysis(opportunity);
		}
	}

	/**
	 * Generates real attachment links from SAM.gov opportunity data
	 */
	generateAttachmentLinks(opportunity: SAMOpportunity): string[] {
		const links: string[] = [];

		try {
			// Use the UI link if available (this is the real SAM.gov link)
			if (opportunity.uiLink) {
				links.push(opportunity.uiLink);
			}

			// Use real links from SAM.gov API if available
			if (opportunity.links && Array.isArray(opportunity.links)) {
				opportunity.links.forEach((link: LinkObject | string) => {
					if (typeof link === "string" && link.startsWith("http")) {
						links.push(link);
					} else if (typeof link === "object" && link.href) {
						links.push(link.href);
					}
				});
			}

			// Use resource links if available
			if (
				opportunity.resourceLinks &&
				Array.isArray(opportunity.resourceLinks)
			) {
				opportunity.resourceLinks.forEach((link: LinkObject | string) => {
					if (typeof link === "string" && link.startsWith("http")) {
						links.push(link);
					} else if (typeof link === "object" && link.href) {
						links.push(link.href);
					}
				});
			}

			// Add additional info link if available
			if (opportunity.additionalInfoLink) {
				links.push(opportunity.additionalInfoLink);
			}

			// Remove duplicates and return
			return [...new Set(links)];
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn("Attachment link generation failed:", errorMessage);
			// Fallback to UI link only
			return opportunity.uiLink ? [opportunity.uiLink] : [];
		}
	}

	/**
	 * Generates specific attachment file links based on opportunity type
	 */
	private extractRealAttachments(
		opportunity: SAMOpportunity
	): AttachmentInfo[] {
		const attachments: AttachmentInfo[] = [];

		try {
			// Extract real attachments from SAM.gov data
			if (opportunity.links && Array.isArray(opportunity.links)) {
				opportunity.links.forEach(
					(link: LinkObject | string, index: number) => {
						if (typeof link === "string" && link.startsWith("http")) {
							attachments.push({
								fileName: `Attachment ${index + 1}`,
								fileType: this.getFileTypeFromUrl(link),
								description: "Document from SAM.gov",
								priority: "Medium",
								category: "Other",
								downloadUrl: link,
								complianceRequired: false,
							});
						} else if (typeof link === "object" && link.href) {
							attachments.push({
								fileName: link.rel || `Attachment ${index + 1}`,
								fileType: this.getFileTypeFromUrl(link.href),
								description: link.rel || "Document from SAM.gov",
								priority: "Medium",
								category: "Other",
								downloadUrl: link.href,
								complianceRequired: false,
							});
						}
					}
				);
			}

			// Extract resource links
			if (
				opportunity.resourceLinks &&
				Array.isArray(opportunity.resourceLinks)
			) {
				opportunity.resourceLinks.forEach(
					(link: LinkObject | string, index: number) => {
						if (typeof link === "string" && link.startsWith("http")) {
							attachments.push({
								fileName: `Resource ${index + 1}`,
								fileType: this.getFileTypeFromUrl(link),
								description: "Resource from SAM.gov",
								priority: "Low",
								category: "Other",
								downloadUrl: link,
								complianceRequired: false,
							});
						}
					}
				);
			}

			return attachments;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn("Real attachment extraction failed:", errorMessage);
			return [];
		}
	}

	private generateBasicAttachmentAnalysis(
		opportunity: SAMOpportunity
	): AttachmentInfo[] {
		const attachments: AttachmentInfo[] = [];

		try {
			// Only provide the main solicitation link if available
			if (opportunity.uiLink) {
				attachments.push({
					fileName: "Solicitation Document",
					fileType: "Web",
					description: "Main solicitation page on SAM.gov",
					priority: "High",
					category: "Solicitation",
					downloadUrl: opportunity.uiLink,
					complianceRequired: true,
				});
			}

			// Add additional info link if available
			if (opportunity.additionalInfoLink) {
				attachments.push({
					fileName: "Additional Information",
					fileType: "Web",
					description: "Additional information and resources",
					priority: "Medium",
					category: "Other",
					downloadUrl: opportunity.additionalInfoLink,
					complianceRequired: false,
				});
			}

			return attachments;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn("Basic attachment analysis failed:", errorMessage);
			return [];
		}
	}

	private getFileTypeFromUrl(url: string): string {
		const extension = url.split(".").pop()?.toLowerCase();
		switch (extension) {
			case "pdf":
				return "PDF";
			case "doc":
			case "docx":
				return "Word";
			case "xls":
			case "xlsx":
				return "Excel";
			case "ppt":
			case "pptx":
				return "PowerPoint";
			case "txt":
				return "Text";
			case "zip":
				return "ZIP";
			default:
				return "Web";
		}
	}

	private checkForAttachments(opportunity: SAMOpportunity): boolean {
		// Check various fields that might indicate attachments
		return !!(
			opportunity.noticeId ||
			opportunity.solicitationNumber ||
			opportunity.description?.toLowerCase().includes("attachment") ||
			opportunity.description?.toLowerCase().includes("document") ||
			opportunity.description?.toLowerCase().includes("pdf")
		);
	}

	private extractAttachmentInfo(opportunity: SAMOpportunity): AttachmentInfo[] {
		// Check if we have real attachment data from SAM.gov
		const realAttachments = this.extractRealAttachments(opportunity);

		if (realAttachments.length > 0) {
			return realAttachments;
		}

		// If no real attachments, provide a basic analysis without fake data
		return this.generateBasicAttachmentAnalysis(opportunity);
	}

	private identifyCriticalAttachments(
		attachments: AttachmentInfo[]
	): AttachmentInfo[] {
		return attachments.filter(attachment => attachment.priority === "High");
	}

	private generateReviewPriority(attachments: AttachmentInfo[]): string[] {
		const priorities: string[] = [];

		// High priority items
		const highPriority = attachments.filter(a => a.priority === "High");
		if (highPriority.length > 0) {
			priorities.push(
				"Review solicitation document and technical specifications immediately"
			);
			priorities.push(
				"Download and analyze evaluation criteria for scoring methodology"
			);
		}

		// Medium priority items
		const mediumPriority = attachments.filter(a => a.priority === "Medium");
		if (mediumPriority.length > 0) {
			priorities.push(
				"Review compliance requirements and past performance criteria"
			);
			priorities.push("Check for amendments and Q&A documents");
		}

		// General priorities
		priorities.push(
			"Ensure all required documents are downloaded and reviewed"
		);
		priorities.push("Verify compliance with all regulatory requirements");
		priorities.push("Prepare questions for clarification if needed");

		return priorities;
	}

	private extractComplianceRequirements(
		attachments: AttachmentInfo[]
	): string[] {
		const complianceAttachments = attachments.filter(
			a => a.category === "Compliance"
		);
		const requirements: string[] = [];

		complianceAttachments.forEach(attachment => {
			requirements.push(
				`Review ${attachment.fileName} for compliance requirements`
			);
		});

		// Add general compliance requirements
		requirements.push("Verify all required certifications and qualifications");
		requirements.push(
			"Ensure compliance with applicable regulations and standards"
		);
		requirements.push("Review security clearance requirements if applicable");

		return requirements;
	}

	private extractTechnicalSpecifications(
		attachments: AttachmentInfo[]
	): string[] {
		const technicalAttachments = attachments.filter(
			a => a.category === "Technical"
		);
		const specifications: string[] = [];

		technicalAttachments.forEach(attachment => {
			specifications.push(
				`Analyze ${attachment.fileName} for technical requirements`
			);
		});

		// Add general technical requirements
		specifications.push(
			"Review performance standards and quality requirements"
		);
		specifications.push(
			"Identify required technical capabilities and equipment"
		);
		specifications.push(
			"Assess technical complexity and resource requirements"
		);

		return specifications;
	}

	private extractEvaluationCriteria(attachments: AttachmentInfo[]): string[] {
		const evaluationAttachments = attachments.filter(
			a => a.category === "Evaluation"
		);
		const criteria: string[] = [];

		evaluationAttachments.forEach(attachment => {
			criteria.push(`Study ${attachment.fileName} for evaluation methodology`);
		});

		// Add general evaluation criteria
		criteria.push("Understand scoring methodology and evaluation factors");
		criteria.push("Identify key differentiators and competitive advantages");
		criteria.push("Prepare response strategy based on evaluation criteria");

		return criteria;
	}

	private generateNoAttachmentsAnalysis(
		_opportunity: SAMOpportunity
	): AttachmentAnalysis {
		return {
			hasAttachments: false,
			attachmentCount: 0,
			criticalAttachments: [],
			allAttachments: [],
			reviewPriority: [
				"Check SAM.gov for official solicitation documents",
				"Contact contracting officer for additional information",
				"Review opportunity description for requirements",
			],
			complianceRequirements: [
				"Verify compliance requirements from opportunity description",
				"Contact agency for detailed compliance information",
			],
			technicalSpecifications: [
				"Extract technical requirements from opportunity description",
				"Request detailed specifications from contracting officer",
			],
			evaluationCriteria: [
				"Review opportunity description for evaluation factors",
				"Contact contracting officer for evaluation methodology",
			],
		};
	}
}

export default new AttachmentService();
