import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getKeywordForUser, upsertKeyword, setKeywordEnabled, deleteKeyword, testKeyword } from "./keywords.service.js";

export const keywordsRouter = Router();
keywordsRouter.use(requireAuth);

keywordsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getKeywordForUser(req.userId!));
  })
);

const upsertSchema = z.object({
  keyword: z.string().min(2).max(40),
  enabled: z.boolean().optional().default(true),
});

keywordsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const input = upsertSchema.parse(req.body);
    res.json(await upsertKeyword(req.userId!, input.keyword, input.enabled));
  })
);

keywordsRouter.patch(
  "/enabled",
  asyncHandler(async (req, res) => {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    res.json(await setKeywordEnabled(req.userId!, enabled));
  })
);

keywordsRouter.delete(
  "/",
  asyncHandler(async (req, res) => {
    await deleteKeyword(req.userId!);
    res.status(204).send();
  })
);

keywordsRouter.post(
  "/test",
  asyncHandler(async (req, res) => {
    const { phrase } = z.object({ phrase: z.string() }).parse(req.body);
    const matched = await testKeyword(req.userId!, phrase);
    res.json({ matched });
  })
);
