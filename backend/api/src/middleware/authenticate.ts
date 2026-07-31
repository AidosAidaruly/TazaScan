import type { RequestHandler } from 'express';
import { UserRepository } from '../repositories/user.repository';
import { AuthService } from '../services/auth.service';
import { PasswordService } from '../services/password.service';
import { TokenService } from '../services/token.service';
import { HttpError } from '../utils/http-error';

const tokenService = new TokenService();
const authService = new AuthService(
  new UserRepository(),
  new PasswordService(),
  tokenService
);

export function createAuthenticate(
  service: Pick<AuthService, 'getCurrentUser'>,
  tokens: Pick<TokenService, 'verifyAccessToken'>
): RequestHandler {
  return async (request, _response, next) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        throw new HttpError(401, 'Missing token');
      }

      const [scheme, token] = authHeader.split(' ');

      if (scheme !== 'Bearer' || !token) {
        throw new HttpError(401, 'Malformed token');
      }

      const payload = tokens.verifyAccessToken(token);
      request.user = await service.getCurrentUser(payload.sub);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const authenticate = createAuthenticate(authService, tokenService);
