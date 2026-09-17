import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { listAuditLogsForUser } from "./auditLog.service.js";

export const auditLogRouter = Router();

auditLogRouter.use(requireAuth);

auditLogRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const logs = await listAuditLogsForUser(req.userId!);
    res.json(logs);
  })
);
