import type { User } from '../generated/prisma/client';
import type { LoginBody } from '../schemas/auth.schema';
import { toAuthUser } from '../types/auth';
import { HttpError } from '../utils/http-error';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

type UserRepositoryContract = {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
};

export class AuthService {
  constructor(
    private readonly userRepository: UserRepositoryContract,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService
  ) {}

  async login(credentials: LoginBody) {
    const user = await this.userRepository.findByEmail(credentials.email);
    // Exactly one bcrypt comparison on every path, so an unknown email takes the same work
    // as a known one.
    const isPasswordValid = user
      ? await this.passwordService.verify(credentials.password, user.passwordHash)
      : await this.passwordService.verifyDummy(credentials.password);

    // Unknown email, wrong password and inactive account share one generic failure, so
    // the response never reveals whether an account exists or its state.
    if (!user || !isPasswordValid || !user.isActive) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const authUser = toAuthUser(user);
    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      role: user.role
    });

    return {
      accessToken,
      user: authUser
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new HttpError(401, 'User not found');
    }

    if (!user.isActive) {
      throw new HttpError(403, 'User account is inactive');
    }

    return toAuthUser(user);
  }
}
