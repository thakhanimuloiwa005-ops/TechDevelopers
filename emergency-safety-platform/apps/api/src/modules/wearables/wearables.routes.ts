import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { WearableEventType } from "@esp/types";
import * as wearablesService from "./wearables.service.js";
import { triggerWearableEvent } from "./wearables.orchestrator.js";

export const wearablesRouter = Router();
wearablesRouter.use(requireAuth);

wearablesRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const device = await wearablesService.ensureDeviceForUser(req.userId!);
    const dto = await wearablesService.getDeviceForUser(req.userId!);
    const events = await wearablesService.listRecentEventsForUser(req.userId!);
    res.json({ device: dto ?? device, events });
  })
);

const simulateSchema = z.object({ type: z.nativeEnum(WearableEventType) });

wearablesRouter.post(
  "/simulate",
  asyncHandler(async (req, res) => {
    const { type } = simulateSchema.parse(req.body);
    const result = await triggerWearableEvent(req.userId!, type, false);
    res.json(result);
  })
);
