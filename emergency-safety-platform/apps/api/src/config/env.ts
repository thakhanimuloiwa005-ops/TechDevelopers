import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
const nodeEnv = process.env.NODE_ENV ?? "development";

const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Vite bumps to a new port (5174, 5175, ...) whenever the one it wants is
 * already taken by another process, and browsers treat `localhost` and
 * `127.0.0.1` as different origins even though they're the same machine.
 * Allowlisting one exact WEB_ORIGIN string caused repeated "cannot create
 * account" failures that only showed up as a silent CORS rejection in the
 * browser, never as a real API error — so in development, accept any
 * localhost/127.0.0.1 origin regardless of port. Production still requires
 * an exact match against the configured WEB_ORIGIN.
 */
function isAllowedOrigin(origin: string): boolean {
  if (nodeEnv !== "production") return LOCAL_ORIGIN_PATTERN.test(origin);
  return origin === webOrigin;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv,
  webOrigin,
  isAllowedOrigin,
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
  evidenceIntervalNormalMs: Number(process.env.EVIDENCE_INTERVAL_NORMAL_MS ?? 10000),
  evidenceIntervalDemoMs: Number(process.env.EVIDENCE_INTERVAL_DEMO_MS ?? 3000),
  wearableTelemetryIntervalMs: Number(process.env.WEARABLE_TELEMETRY_INTERVAL_MS ?? 4000),
};
