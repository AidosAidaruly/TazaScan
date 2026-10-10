import { prisma } from '../prisma/client';

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
}
