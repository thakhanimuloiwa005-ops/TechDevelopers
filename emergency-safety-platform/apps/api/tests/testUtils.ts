import { prisma } from "../src/db/prisma.js";

let counter = 0;

export function uniqueEmail(prefix: string) {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@test.local`;
}

export async function cleanupUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) await prisma.user.delete({ where: { id: user.id } });
}
