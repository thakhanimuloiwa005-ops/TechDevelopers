import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authRateLimiter } from "../../middleware/rateLimit.js";
import { registerSchema, loginSchema } from "./auth.validation.js";
import { register, login, refresh } from "./auth.service.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await register(input);
    res.status(201).json(result);
  })
);

authRouter.post(
  "/login",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await login(input);
    res.json(result);
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) return res.status(400).json({ error: "refreshToken is required" });
    const result = await refresh(refreshToken);
    res.json(result);
  })
);
