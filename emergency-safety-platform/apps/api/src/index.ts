import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { initSocket } from "./realtime/socket.js";
import { iotSimulator } from "./modules/wearables/wearables.simulator.js";
import { logger } from "./utils/logger.js";

const app = createApp();
const httpServer = createServer(app);

initSocket(httpServer);
iotSimulator.start();

httpServer.listen(env.port, () => {
  logger.info(`API listening on http://localhost:${env.port}`);
});

process.on("SIGTERM", () => {
  iotSimulator.stop();
  httpServer.close(() => process.exit(0));
});
