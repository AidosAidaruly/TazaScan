import type { User } from '../generated/prisma/client';

export type AuthUser = {
  id: string;
  email: string;
  role: User['role'];
};

export type AuthTokenPayload = {
  sub: string;
  role: User['role'];
};

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role
  };
}
