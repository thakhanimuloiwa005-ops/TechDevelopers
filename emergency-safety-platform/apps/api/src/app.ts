import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiRateLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { keywordsRouter } from "./modules/keywords/keywords.routes.js";
import { trustedMembersRouter } from "./modules/trustedMembers/trustedMembers.routes.js";
import { incidentsRouter } from "./modules/incidents/incident.routes.js";
import { wearablesRouter } from "./modules/wearables/wearables.routes.js";
import { demoRouter } from "./modules/demo/demo.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { auditLogRouter } from "./modules/auditLogs/auditLog.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.isAllowedOrigin(origin)) return callback(null, true);
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
  app.use(apiRateLimiter);

  app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  app.use("/auth", authRouter);
  app.use("/users", usersRouter);
  app.use("/keywords", keywordsRouter);
  app.use("/trusted-members", trustedMembersRouter);
  app.use("/incidents", incidentsRouter);
  app.use("/wearables", wearablesRouter);
  app.use("/demo", demoRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/audit-logs", auditLogRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
