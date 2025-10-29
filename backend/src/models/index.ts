// Export Prisma types and models directly

// Export Prisma types
export type {
	EmailVerification as EmailVerificationType,
	Filter as FilterType,
	Job as JobType,
	Notification as NotificationType,
	Opportunity as OpportunityType,
	Subscription as SubscriptionType,
	Team as TeamType,
	TeamChatMessage as TeamChatMessageType,
	TeamInvitation as TeamInvitationType,
	TeamMember as TeamMemberType,
	User as UserType,
	UserToken as UserTokenType,
	WebAuthnCredential as WebAuthnCredentialType,
} from "@prisma/client";
export { default as ArchivedOpportunity } from "./ArchivedOpportunity";
export {
	default as EmailVerification,
	VerificationType,
} from "./EmailVerification";
export { default as Filter } from "./Filter";
export { default as Job } from "./Job";
// Use custom Keyword type since Prisma client doesn't generate it properly
export type { Keyword as KeywordType } from "./Keyword";
export { default as KeywordUtils } from "./Keyword";
export { default as Notification } from "./Notification";
export { default as Opportunity } from "./Opportunity";
// Re-export enums from prisma.ts
export type * from "./prisma";
// Export Stripe models
export type {
	StripeCustomer,
	StripePayment,
	StripeSubscription,
} from "./Stripe";
export { default as Subscription } from "./Subscription";
export { default as Team } from "./Team";
export { MessageType } from "./TeamChatMessage";
export { InvitationStatus } from "./TeamInvitation";
export * as TeamMemberUtils from "./TeamMember";
export { TeamRole } from "./TeamMember";
export type { User } from "./User";
export { UserRole } from "./User";
export { default as UserToken } from "./UserToken";
export { default as WebAuthnCredential } from "./WebAuthnCredential";
