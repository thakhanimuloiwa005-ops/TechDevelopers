import type { Incident, User } from "@prisma/client";
import type { IncidentDTO } from "@esp/types";
import { toUserDTO } from "../users/users.mapper.js";

type IncidentWithUser = Incident & { user?: User };

export function toIncidentDTO(row: IncidentWithUser): IncidentDTO {
  return {
    id: row.id,
    userId: row.userId,
    user: row.user ? toUserDTO(row.user) : undefined,
    activationMethod: row.activationMethod as IncidentDTO["activationMethod"],
    activationDetail: row.activationDetail,
    status: row.status as IncidentDTO["status"],
    priority: row.priority as IncidentDTO["priority"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolutionNotes: row.resolutionNotes,
    acknowledgedById: row.acknowledgedById,
    respondingById: row.respondingById,
  };
}
