import bcrypt from "bcryptjs";
import { prisma } from "../../db/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import { HttpError } from "../../middleware/errorHandler.js";
import { recordAuditLog } from "../auditLogs/auditLog.service.js";
import type { RegisterInput, LoginInput } from "./auth.validation.js";
import { toUserDTO } from "../users/users.mapper.js";

const SALT_ROUNDS = 12;

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError(409, "An account with this email already exists");
  }
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phone: input.phone,
    },
  });

  await prisma.emergencyKeyword.create({
    data: { userId: user.id, keyword: "HELP", enabled: true },
  });
  await prisma.wearableDevice.create({
    data: { userId: user.id, name: "SafeWatch Demo", deviceType: "Smartwatch" },
  });

  await recordAuditLog({ userId: user.id, action: "REGISTER", resource: "user", result: "SUCCESS" });

  return issueTokens(user.id, user.email, user);
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    await recordAuditLog({ userId: null, action: "LOGIN", resource: "user", result: "FAILURE", metadata: { email: input.email } });
    throw new HttpError(401, "Invalid email or password");
  }
  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    await recordAuditLog({ userId: user.id, action: "LOGIN", resource: "user", result: "FAILURE" });
    throw new HttpError(401, "Invalid email or password");
  }
  await recordAuditLog({ userId: user.id, action: "LOGIN", resource: "user", result: "SUCCESS" });
  return issueTokens(user.id, user.email, user);
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new HttpError(401, "Invalid refresh token");
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new HttpError(401, "Invalid refresh token");
  return issueTokens(user.id, user.email, user);
}

function issueTokens(userId: string, email: string, user: Awaited<ReturnType<typeof prisma.user.findUnique>>) {
  const accessToken = signAccessToken({ sub: userId, email });
  const refreshToken = signRefreshToken({ sub: userId, email });
  return { accessToken, refreshToken, user: user ? toUserDTO(user) : null };
}
