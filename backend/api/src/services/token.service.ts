import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import type { AuthTokenPayload } from '../types/auth';
import { HttpError } from '../utils/http-error';

// The only accepted algorithm; verification rejects tokens signed with anything else.
export const jwtAlgorithm = 'HS256';

export class TokenService {
  signAccessToken(payload: AuthTokenPayload) {
    const options: SignOptions = {
      algorithm: jwtAlgorithm,
      expiresIn: env.JWT_ACCESS_TOKEN_TTL as NonNullable<SignOptions['expiresIn']>
    };

    return jwt.sign(payload, env.jwtSecret, options);
  }

  verifyAccessToken(token: string): AuthTokenPayload {
    try {
      const decoded = jwt.verify(token, env.jwtSecret, { algorithms: [jwtAlgorithm] });

      if (!this.isAuthTokenPayload(decoded)) {
        throw new HttpError(401, 'Invalid token');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new HttpError(401, 'Token expired');
      }

      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(401, 'Invalid token');
    }
  }

  private isAuthTokenPayload(value: unknown): value is AuthTokenPayload {
    return (
      typeof value === 'object' &&
      value !== null &&
      'sub' in value &&
      typeof value.sub === 'string' &&
      'role' in value &&
      (value.role === 'admin' || value.role === 'user')
    );
  }
}
