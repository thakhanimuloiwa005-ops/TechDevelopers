import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as incidentService from "./incident.service.js";
import * as evidenceService from "../evidence/evidence.service.js";
import * as locationService from "../location/location.service.js";
import { assertIncidentAccess } from "./incidents.access.js";

export const incidentsRouter = Router();
incidentsRouter.use(requireAuth);

incidentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await incidentService.listForUser(req.userId!, req.userEmail!));
  })
);

incidentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await incidentService.getIncidentDetail(req.params.id, req.userId!, req.userEmail!));
  })
);

incidentsRouter.get(
  "/:id/evidence",
  asyncHandler(async (req, res) => {
    await assertIncidentAccess(req.params.id, req.userId!, req.userEmail!);
    res.json(await evidenceService.listForIncident(req.params.id));
  })
);

incidentsRouter.get(
  "/:id/locations",
  asyncHandler(async (req, res) => {
    await assertIncidentAccess(req.params.id, req.userId!, req.userEmail!);
    res.json(await locationService.getHistoryForIncident(req.params.id));
  })
);

incidentsRouter.post(
  "/:id/acknowledge",
  asyncHandler(async (req, res) => {
    await incidentService.acknowledgeIncident(req.params.id, req.userEmail!);
    res.status(204).send();
  })
);

incidentsRouter.post(
  "/:id/respond",
  asyncHandler(async (req, res) => {
    await incidentService.respondIncident(req.params.id, req.userEmail!);
    res.status(204).send();
  })
);

const escalateSchema = z.object({ reason: z.string().optional() });
incidentsRouter.post(
  "/:id/escalate",
  asyncHandler(async (req, res) => {
    const { reason } = escalateSchema.parse(req.body ?? {});
    await incidentService.escalateIncident(req.params.id, req.userEmail!, reason);
    res.status(204).send();
  })
);

const resolveSchema = z.object({ notes: z.string().optional() });
incidentsRouter.post(
  "/:id/resolve",
  asyncHandler(async (req, res) => {
    const { notes } = resolveSchema.parse(req.body ?? {});
    await incidentService.resolveIncident(req.params.id, req.userEmail!, notes);
    res.status(204).send();
  })
);

const cancelSchema = z.object({ reason: z.string().optional() });
incidentsRouter.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const { reason } = cancelSchema.parse(req.body ?? {});
    await incidentService.cancelIncident(req.params.id, req.userId!, reason);
    res.status(204).send();
  })
);
