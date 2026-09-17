import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getUserById, updateProfile } from "./users.service.js";
import { toUserDTO } from "./users.mapper.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.userId!);
    res.json(toUserDTO(user));
  })
);

const updateSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

usersRouter.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const user = await updateProfile(req.userId!, input);
    res.json(toUserDTO(user));
  })
);
