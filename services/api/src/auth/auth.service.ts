import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password.util';
import type { Role } from '@prisma/client';
import { UserRole } from '../common/decorators/roles.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
    const passwordHash = await hashPassword(dto.password);
    return this.prisma.user.create({
      data: { email: dto.email, passwordHash, role: dto.role as Role },
      select: { id: true, email: true, role: true, createdAt: true },
    });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('This account uses Google Sign-In. Please sign in with Google.');
    }
    const valid = await verifyPassword(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokensForUser(user);
  }

  /**
   * Helper to sign access and refresh JWT pair for a validated user.
   */
  async issueTokensForUser(user: { id: string; email: string; role: Role | string }) {
    const payload = { sub: user.id, email: user.email, role: user.role as UserRole };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.jwt.signAsync(
      { ...payload, type: 'refresh' },
      { expiresIn: this.config.getOrThrow<string>('JWT_REFRESH_EXPIRY') },
    );
    return { accessToken, refreshToken };
  }

  private readonly fallbackUsers = new Map<string, { id: string; email: string; googleId: string; role: Role | string }>();

  /**
   * Validates or creates a user authenticated via Google OAuth.
   * - If user with googleId exists -> returns user.
   * - If user with email exists without googleId -> links googleId and returns user.
   * - If user does not exist -> creates new user with role 'applicant'.
   * - If database is unreachable (e.g. local dev without Postgres), falls back gracefully.
   */
  async validateOrCreateGoogleUser(profile: { googleId: string; email: string }) {
    try {
      // 1. Check if user already linked by googleId
      let user = await this.prisma.user.findUnique({
        where: { googleId: profile.googleId },
      });
      if (user) {
        return user;
      }

      // 2. Check if user exists with matching email
      user = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });
      if (user) {
        // Link the Google ID to existing account
        return await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: profile.googleId,
          },
        });
      }

      // 3. Create new user via Google Sign-In
      return await this.prisma.user.create({
        data: {
          email: profile.email,
          googleId: profile.googleId,
          authProvider: 'google',
          role: 'applicant',
        },
      });
    } catch {
      // Offline / dev fallback when Postgres server is not running
      const id = `google-dev-${profile.googleId.slice(0, 12)}`;
      const user = { id, email: profile.email, googleId: profile.googleId, role: 'applicant' as Role };
      this.fallbackUsers.set(id, user);
      return user;
    }
  }

  /**
   * Exchanges a refresh JWT for a new access token. Used by the web app to
   * restore its session after a browser reload without ever storing the
   * refresh token in web storage — it lives only in an httpOnly cookie
   * managed by this API (see auth.controller REFRESH_COOKIE).
   */
  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: { sub?: string; email?: string; role?: string; type?: string };
    try {
      payload = (await this.jwt.verifyAsync(refreshToken)) as {
        sub?: string;
        email?: string;
        role?: string;
        type?: string;
      };
    } catch {
      throw new UnauthorizedException('Session expired — please log in again');
    }
    if (payload.type !== 'refresh' || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Invalid session token');
    }

    let email = payload.email;
    let role = (payload.role as UserRole) || 'applicant';

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true },
      });
      if (user) {
        email = user.email;
        role = user.role as UserRole;
      }
    } catch {
      // Database is offline; rely on validated JWT payload / in-memory fallback
      const fallback = this.fallbackUsers.get(payload.sub);
      if (fallback) {
        email = fallback.email;
        role = fallback.role as UserRole;
      }
    }

    if (!email) {
      throw new UnauthorizedException('Session expired — please log in again');
    }

    const accessToken = await this.jwt.signAsync({
      sub: payload.sub,
      email,
      role,
    });
    return { accessToken };
  }
}

