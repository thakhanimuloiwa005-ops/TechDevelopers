import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  listTrustedMembers,
  addTrustedMember,
  removeTrustedMember,
  updateTrustedMember,
} from "./trustedMembers.service.js";

export const trustedMembersRouter = Router();
trustedMembersRouter.use(requireAuth);

trustedMembersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await listTrustedMembers(req.userId!));
  })
);

const addSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  relationship: z.string().min(2),
  priority: z.number().int().min(1).max(10).optional(),
});

trustedMembersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = addSchema.parse(req.body);
    res.status(201).json(await addTrustedMember(req.userId!, input));
  })
);

const updateSchema = z.object({
  priority: z.number().int().min(1).max(10).optional(),
  enabled: z.boolean().optional(),
  relationship: z.string().min(2).optional(),
});

trustedMembersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    res.json(await updateTrustedMember(req.userId!, req.params.id, input));
  })
);

trustedMembersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await removeTrustedMember(req.userId!, req.params.id);
    res.status(204).send();
  })
);
