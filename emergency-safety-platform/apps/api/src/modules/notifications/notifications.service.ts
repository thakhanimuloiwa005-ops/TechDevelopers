import { prisma } from "../../db/prisma.js";
import { emitToUser } from "../../realtime/socket.js";
import { SocketEvents, type NotificationDTO, type NotificationType } from "@esp/types";
import type { Notification } from "@prisma/client";

function toDTO(row: Notification): NotificationDTO {
  return {
    id: row.id,
    userId: row.userId,
    incidentId: row.incidentId,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createNotification(input: {
  userId: string;
  incidentId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
}) {
  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      incidentId: input.incidentId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
    },
  });
  const dto = toDTO(row);
  emitToUser(input.userId, SocketEvents.NOTIFICATION_CREATED, dto);
  return dto;
}

export async function listNotifications(userId: string): Promise<NotificationDTO[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map(toDTO);
}

export async function markNotificationRead(userId: string, id: string) {
  await prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
}
