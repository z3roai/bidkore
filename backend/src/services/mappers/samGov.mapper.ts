import loggingService from "@/services/loggingService";
import {
	type SamGovOpportunity,
	SamGovOpportunitySchema,
} from "@/services/mappers/samGov.schema";
import type { CanonicalOpportunity } from "@/types/canonicalOpportunity";

const getEstimatedValue = (award: unknown): number | null => {
	if (!award || typeof award !== "object") {
		return null;
	}
	const a = award as { value?: number; amount?: number; totalValue?: number };
	return a.value ?? a.amount ?? a.totalValue ?? null;
};

const getLocationFromPerformance = (
	placeOfPerformance: unknown
): string | null => {
	if (!placeOfPerformance) {
		return null;
	}
	if (typeof placeOfPerformance === "string") {
		return placeOfPerformance;
	}
	const perf = placeOfPerformance as {
		city?: { name?: string };
		state?: { name?: string };
		streetAddress?: string;
		zip?: string;
	};
	const city = perf.city?.name;
	const state = perf.state?.name;
	const street = perf.streetAddress;
	const zip = perf.zip;

	// Build a more detailed location string
	const parts = [street, city, state, zip].filter(Boolean);
	return parts.length > 0 ? parts.join(", ") : null;
};

const getContactInfo = (pointOfContact: unknown): string | null => {
	if (!pointOfContact) {
		return null;
	}

	if (typeof pointOfContact === "string") {
		return pointOfContact;
	}

	if (Array.isArray(pointOfContact)) {
		const contacts = pointOfContact
			.map(contact => {
				if (typeof contact === "object" && contact !== null) {
					const c = contact as {
						fullname?: string;
						fullName?: string;
						email?: string;
						phone?: string;
						title?: string;
					};
					// Use fullName if available, otherwise fall back to fullname
					const name = c.fullName || c.fullname;
					const parts = [name, c.title, c.email, c.phone].filter(Boolean);
					return parts.length > 0 ? parts.join(" - ") : null;
				}
				return null;
			})
			.filter(Boolean);

		return contacts.length > 0 ? contacts.join("; ") : null;
	}

	return null;
};

export function mapSamGovToCanonical(
	raw: unknown
): CanonicalOpportunity | null {
	const parsed = SamGovOpportunitySchema.safeParse(raw);
	if (!parsed.success) {
		loggingService.error("[ERROR] SAM.gov mapping failed:", {
			error: parsed.error,
			raw,
		});
		return null;
	}
	const opp: SamGovOpportunity = parsed.data;

	const result: CanonicalOpportunity = {
		noticeId: opp.noticeId,
		title: opp.title,
		responseDeadline:
			opp.responseDeadLine !== null && opp.responseDeadLine !== undefined
				? opp.responseDeadLine
				: null,
		estimatedValue: getEstimatedValue(opp.award),
		hasAttachments:
			(Array.isArray((opp as unknown as { links?: unknown[] }).links) &&
				((opp as unknown as { links?: unknown[] }).links?.length ?? 0) > 0) ||
			(Array.isArray(
				(opp as unknown as { resourceLinks?: unknown[] }).resourceLinks
			) &&
				((opp as unknown as { resourceLinks?: unknown[] }).resourceLinks
					?.length ?? 0) > 0),
	};

	// Only include optional properties if they have values
	if (opp.description) {
		result.description = opp.description;
	}
	if (opp.fullParentPathName !== null && opp.fullParentPathName !== undefined) {
		result.agencyName = opp.fullParentPathName;
	}
	if (opp.fullParentPathCode !== null && opp.fullParentPathCode !== undefined) {
		result.agencyCode = opp.fullParentPathCode;
	}
	if (opp.naicsCode !== null && opp.naicsCode !== undefined) {
		result.naicsCode = opp.naicsCode;
	}
	if (opp.classificationCode !== null && opp.classificationCode !== undefined) {
		result.classificationCode = opp.classificationCode;
	}
	if (opp.postedDate !== null && opp.postedDate !== undefined) {
		result.postedDate = opp.postedDate;
	}
	if (opp.active !== null && opp.active !== undefined) {
		result.status = opp.active;
	}
	if (opp.solicitationNumber !== null && opp.solicitationNumber !== undefined) {
		result.solicitationNumber = opp.solicitationNumber;
	}
	if (opp.type !== null && opp.type !== undefined) {
		result.type = opp.type;
	}
	if (opp.baseType !== null && opp.baseType !== undefined) {
		result.baseType = opp.baseType;
	}
	if (opp.archiveType !== null && opp.archiveType !== undefined) {
		result.archiveType = opp.archiveType;
	}
	if (opp.archiveDate !== null && opp.archiveDate !== undefined) {
		result.archiveDate = opp.archiveDate;
	}
	if (opp.typeOfSetAside !== null && opp.typeOfSetAside !== undefined) {
		result.setAside = opp.typeOfSetAside;
	}
	if (
		opp.typeOfSetAsideDescription !== null &&
		opp.typeOfSetAsideDescription !== undefined
	) {
		result.setAsideDescription = opp.typeOfSetAsideDescription;
	}
	const location = getLocationFromPerformance(opp.placeOfPerformance);
	if (location) {
		result.location = location;
	}
	const attachmentsCount = ((): number | undefined => {
		const linksLen = Array.isArray(
			(opp as unknown as { links?: unknown[] }).links
		)
			? ((opp as unknown as { links?: unknown[] }).links as unknown[]).length
			: 0;
		const resLen = Array.isArray(
			(opp as unknown as { resourceLinks?: unknown[] }).resourceLinks
		)
			? (
					(opp as unknown as { resourceLinks?: unknown[] })
						.resourceLinks as unknown[]
			  ).length
			: 0;
		const total = linksLen + resLen;
		return total > 0 ? total : undefined;
	})();
	if (attachmentsCount !== undefined) {
		result.attachmentsCount = attachmentsCount;
	}
	if (opp.uiLink !== null && opp.uiLink !== undefined) {
		result.uiLink = opp.uiLink;
	}

	const contactInfo = getContactInfo(opp.pointOfContact);
	if (contactInfo !== null && contactInfo !== undefined) {
		result.pointOfContact = contactInfo;
	}

	return result;
}
