import bcrypt from 'bcryptjs';

const saltRounds = 12;

export class PasswordService {
  hash(password: string) {
    return bcrypt.hash(password, saltRounds);
  }

  verify(password: string, passwordHash: string) {
    return bcrypt.compare(password, passwordHash);
  }
}
