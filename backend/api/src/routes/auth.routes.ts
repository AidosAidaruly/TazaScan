import { Router } from 'express';
import { login, getMe } from '../controllers/auth.controller';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/authenticate';
import { loginRateLimit } from '../middleware/login-rate-limit';
import { validate } from '../middleware/validate';
import { loginBodySchema } from '../schemas/auth.schema';

export const authRouter = Router();

authRouter.post('/login', loginRateLimit, validate(loginBodySchema), asyncHandler(login));
authRouter.get('/me', authenticate, asyncHandler(getMe));
