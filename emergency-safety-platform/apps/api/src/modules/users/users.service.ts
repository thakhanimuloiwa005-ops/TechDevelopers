import { prisma } from "../../db/prisma.js";
import { HttpError } from "../../middleware/errorHandler.js";

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "User not found");
  return user;
}

export async function updateProfile(
  userId: string,
  data: { fullName?: string; phone?: string; avatarUrl?: string }
) {
  return prisma.user.update({ where: { id: userId }, data });
}
