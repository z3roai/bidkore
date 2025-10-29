import {
	isTeamAdmin as checkIsTeamAdmin,
	isTeamMember as checkIsTeamMember,
	isTeamOwner as checkIsTeamOwner,
} from "../../models/TeamMember";

// Helper function to check if user is team admin or owner
export const isTeamAdmin = async(
	userId: string,
	teamId: string,
): Promise<boolean> => {
	return checkIsTeamAdmin(userId, teamId);
};

// Helper function to check if user is team owner
export const isTeamOwner = async(
	userId: string,
	teamId: string,
): Promise<boolean> => {
	return checkIsTeamOwner(userId, teamId);
};

// Helper function to check if user is team member
export const isTeamMember = async(
	userId: string,
	teamId: string,
): Promise<boolean> => {
	return checkIsTeamMember(userId, teamId);
};
