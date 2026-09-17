import { prisma } from "../../db/prisma.js";
import { HttpError } from "../../middleware/errorHandler.js";
import { recordAuditLog } from "../auditLogs/auditLog.service.js";
import type { EmergencyKeywordDTO } from "@esp/types";
import type { EmergencyKeyword } from "@prisma/client";

function toDTO(row: EmergencyKeyword): EmergencyKeywordDTO {
  return {
    id: row.id,
    userId: row.userId,
    keyword: row.keyword,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Each user has exactly one active keyword row; "changing" it updates in place. */
export async function getKeywordForUser(userId: string): Promise<EmergencyKeywordDTO | null> {
  const row = await prisma.emergencyKeyword.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  return row ? toDTO(row) : null;
}

export async function upsertKeyword(userId: string, keyword: string, enabled: boolean) {
  const existing = await prisma.emergencyKeyword.findFirst({ where: { userId } });
  const row = existing
    ? await prisma.emergencyKeyword.update({
        where: { id: existing.id },
        data: { keyword, enabled },
      })
    : await prisma.emergencyKeyword.create({ data: { userId, keyword, enabled } });

  await recordAuditLog({ userId, action: "KEYWORD_CHANGED", resource: "emergency_keyword", result: "SUCCESS", metadata: { keyword, enabled } });
  return toDTO(row);
}

export async function setKeywordEnabled(userId: string, enabled: boolean) {
  const existing = await prisma.emergencyKeyword.findFirst({ where: { userId } });
  if (!existing) throw new HttpError(404, "No keyword configured yet");
  const row = await prisma.emergencyKeyword.update({ where: { id: existing.id }, data: { enabled } });
  await recordAuditLog({ userId, action: enabled ? "KEYWORD_ENABLED" : "KEYWORD_DISABLED", resource: "emergency_keyword", result: "SUCCESS" });
  return toDTO(row);
}

export async function deleteKeyword(userId: string) {
  const existing = await prisma.emergencyKeyword.findFirst({ where: { userId } });
  if (!existing) throw new HttpError(404, "No keyword configured yet");
  await prisma.emergencyKeyword.delete({ where: { id: existing.id } });
  await recordAuditLog({ userId, action: "KEYWORD_DELETED", resource: "emergency_keyword", result: "SUCCESS" });
}

/** Test mode: checks a phrase against the configured keyword WITHOUT creating an incident. */
export async function testKeyword(userId: string, phrase: string): Promise<boolean> {
  const row = await prisma.emergencyKeyword.findFirst({ where: { userId } });
  if (!row || !row.enabled) return false;
  return phrase.trim().toLowerCase() === row.keyword.trim().toLowerCase();
}
