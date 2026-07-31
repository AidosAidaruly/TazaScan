import type { RequestHandler } from 'express';
import { UserRepository } from '../repositories/user.repository';
import { AuthService } from '../services/auth.service';
import { PasswordService } from '../services/password.service';
import { TokenService } from '../services/token.service';

const authService = new AuthService(
  new UserRepository(),
  new PasswordService(),
  new TokenService()
);

export const login: RequestHandler = async (request, response) => {
  const result = await authService.login(request.body);

  response.status(200).json({
    data: result
  });
};

export const getMe: RequestHandler = async (request, response) => {
  response.status(200).json({
    data: request.user
  });
};
