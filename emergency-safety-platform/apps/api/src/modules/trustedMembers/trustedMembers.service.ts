import { prisma } from "../../db/prisma.js";
import { HttpError } from "../../middleware/errorHandler.js";
import { recordAuditLog } from "../auditLogs/auditLog.service.js";
import type { TrustedMemberDTO } from "@esp/types";
import type { TrustedMember } from "@prisma/client";

function toDTO(row: TrustedMember): TrustedMemberDTO {
  return {
    id: row.id,
    ownerId: row.ownerId,
    memberUserId: row.memberUserId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    relationship: row.relationship,
    priority: row.priority,
    enabled: row.enabled,
    status: row.status as TrustedMemberDTO["status"],
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTrustedMembers(ownerId: string): Promise<TrustedMemberDTO[]> {
  const rows = await prisma.trustedMember.findMany({
    where: { ownerId },
    orderBy: { priority: "asc" },
  });
  return rows.map(toDTO);
}

export async function addTrustedMember(
  ownerId: string,
  input: { name: string; email: string; phone?: string; relationship: string; priority?: number }
) {
  const memberAccount = await prisma.user.findUnique({ where: { email: input.email } });
  const row = await prisma.trustedMember.create({
    data: {
      ownerId,
      memberUserId: memberAccount?.id,
      name: input.name,
      email: input.email,
      phone: input.phone,
      relationship: input.relationship,
      priority: input.priority ?? 1,
      // Auto-accept when the invitee already has a platform account, mirroring
      // "invite accepted instantly" for the demo; a real product would email a link.
      status: memberAccount ? "ACCEPTED" : "PENDING",
    },
  });
  await recordAuditLog({ userId: ownerId, action: "TRUSTED_MEMBER_ADDED", resource: "trusted_member", result: "SUCCESS", metadata: { email: input.email } });
  return toDTO(row);
}

export async function removeTrustedMember(ownerId: string, memberId: string) {
  const existing = await prisma.trustedMember.findFirst({ where: { id: memberId, ownerId } });
  if (!existing) throw new HttpError(404, "Trusted member not found");
  await prisma.trustedMember.delete({ where: { id: memberId } });
  await recordAuditLog({ userId: ownerId, action: "TRUSTED_MEMBER_REMOVED", resource: "trusted_member", result: "SUCCESS" });
}

export async function updateTrustedMember(
  ownerId: string,
  memberId: string,
  data: Partial<{ priority: number; enabled: boolean; relationship: string }>
) {
  const existing = await prisma.trustedMember.findFirst({ where: { id: memberId, ownerId } });
  if (!existing) throw new HttpError(404, "Trusted member not found");
  const row = await prisma.trustedMember.update({ where: { id: memberId }, data });
  return toDTO(row);
}

/** Incidents where the acting user is a registered, accepted trusted contact for someone else. */
export async function listOwnersTrustingUser(email: string) {
  return prisma.trustedMember.findMany({ where: { email, enabled: true } });
}
