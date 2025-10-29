import { Router } from "express";

import teamChatRoutes, { setWebSocketService } from "@/routes/teams/teamChat";
import teamInvitationsRoutes from "@/routes/teams/teamInvitations";
import teamManagementRoutes from "@/routes/teams/teamManagement";
import teamMembersRoutes from "@/routes/teams/teamMembers";
import teamWizardRoutes from "@/routes/teams/teamWizard";

const router = Router();

// Mount all team-related routes
router.use("/", teamManagementRoutes);
router.use("/", teamMembersRoutes);
router.use("/", teamInvitationsRoutes);
router.use("/", teamWizardRoutes);
router.use("/", teamChatRoutes);

export default router;
export { setWebSocketService };
