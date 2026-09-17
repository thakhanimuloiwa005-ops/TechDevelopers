import { prisma } from "../../db/prisma.js";
import { HttpError } from "../../middleware/errorHandler.js";

/**
 * Object-level authorization for a single incident: the owner can always see
 * their own incident; an accepted, enabled trusted member may see it only
 * because their registered email matches a trusted-member record for the
 * owner (the "authorized information sharing" boundary from the spec).
 */
export async function assertIncidentAccess(incidentId: string, actingUserId: string, actingEmail: string) {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId }, include: { user: true } });
  if (!incident) throw new HttpError(404, "Incident not found");

  if (incident.userId === actingUserId) return incident;

  const trustedLink = await prisma.trustedMember.findFirst({
    where: { ownerId: incident.userId, email: actingEmail, enabled: true },
  });
  if (!trustedLink) throw new HttpError(403, "You are not authorized to view this incident");

  return incident;
}

export async function findTrustedMemberLink(ownerId: string, email: string) {
  return prisma.trustedMember.findFirst({ where: { ownerId, email, enabled: true } });
}
