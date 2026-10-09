import bcrypt from 'bcryptjs';

export const saltRounds = 12;

// Fixed bcrypt hash of a random, discarded value, at the same cost as real password hashes.
// Login compares against it when the email is unknown, so that path does the same bcrypt
// work as a real account. Precomputed: never generated per request. It matches no password
// anyone knows, and its comparison result is always ignored.
export const dummyPasswordHash = '$2b$12$eIDruQfla0aNficT9eZa0.kDzBtKSUTIQr85PZ2Tm8wSmqlOn0t6q';

export class PasswordService {
  hash(password: string) {
    return bcrypt.hash(password, saltRounds);
  }

  verify(password: string, passwordHash: string) {
    return bcrypt.compare(password, passwordHash);
  }

  /** Performs a full bcrypt comparison that can never succeed (timing equalization). */
  async verifyDummy(password: string): Promise<false> {
    await bcrypt.compare(password, dummyPasswordHash);
    return false;
  }
}
