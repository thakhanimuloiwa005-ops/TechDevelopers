import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { verifyAccessToken } from "../utils/jwt.js";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let io: SocketIOServer | null = null;

/**
 * Rooms:
 *  - user:<userId>        the account owner's own devices/tabs
 *  - trusted:<ownerId>    every trusted member who is also a registered
 *                         user joins the room of each owner that lists
 *                         their email as a trusted contact
 */
export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || env.isAllowedOrigin(origin)) return callback(null, true);
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("Missing auth token"));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.email = payload.email;
      next();
    } catch {
      next(new Error("Invalid auth token"));
    }
  });

  io.on("connection", async (socket) => {
    const { userId, email } = socket.data as { userId: string; email: string };
    socket.join(`user:${userId}`);

    const trustedFor = await prisma.trustedMember.findMany({
      where: { email, enabled: true },
      select: { ownerId: true },
    });
    trustedFor.forEach(({ ownerId }) => socket.join(`trusted:${ownerId}`));

    logger.info("socket connected", { userId, rooms: [...socket.rooms] });

    socket.on("disconnect", () => {
      logger.info("socket disconnected", { userId });
    });
  });

  return io;
}

/**
 * Returns the live Socket.IO server, or null before `initSocket` has run
 * (e.g. the HTTP-only test suite, or a request that lands during startup).
 * Real-time delivery is a side channel on top of the REST API, not a
 * dependency of it — an incident must still be created, notified, and
 * timestamped correctly even if nobody is listening on a socket yet, so
 * callers degrade to a no-op rather than failing the request.
 */
export function getIO(): SocketIOServer | null {
  return io;
}

/** Notify the incident owner's own connected clients. */
export function emitToUser(userId: string, event: string, payload: unknown) {
  getIO()?.to(`user:${userId}`).emit(event, payload);
}

/** Notify the owner and every accepted/enabled trusted member watching them. */
export function emitToOwnerAndTrustedNetwork(ownerId: string, event: string, payload: unknown) {
  getIO()?.to(`user:${ownerId}`).to(`trusted:${ownerId}`).emit(event, payload);
}
