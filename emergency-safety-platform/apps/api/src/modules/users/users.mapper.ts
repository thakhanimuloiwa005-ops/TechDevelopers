import type { User } from "@prisma/client";
import type { UserDTO } from "@esp/types";

export function toUserDTO(user: User): UserDTO {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}
