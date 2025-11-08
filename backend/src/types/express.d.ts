import type { User } from "@prisma/client";

declare global {
	namespace Express {
		interface Request {
			user?: User;
			subscription?: any;
			premiumAttachmentAccess?: boolean;
			emailVerificationRequired?: boolean;
		}
	}
}

export {};
