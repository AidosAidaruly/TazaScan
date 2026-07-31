import { prisma } from '../prisma/client';
import type { UserRole } from '../generated/prisma/client';

export class UserRepository {
  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email }
    });
  }

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id }
    });
  }

  upsertSeedAdmin(email: string, passwordHash: string) {
    return prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        role: 'admin' satisfies UserRole,
        isActive: true
      },
      create: {
        email,
        passwordHash,
        role: 'admin',
        isActive: true
      }
    });
  }
}
