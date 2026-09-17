import { prisma } from "../../db/prisma.js";
import type { AuditLogDTO } from "@esp/types";

export async function recordAuditLog(entry: {
  userId: string | null;
  action: string;
  resource: string;
  result: "SUCCESS" | "FAILURE";
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      result: entry.result,
      metadata: entry.metadata as never,
    },
  });
}

export async function listAuditLogsForUser(userId: string, limit = 100): Promise<AuditLogDTO[]> {
  const rows = await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    action: row.action,
    resource: row.resource,
    result: row.result,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.createdAt.toISOString(),
  }));
}
