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
    const valid = await verifyPassword(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { sub: user.id, email: user.email, role: user.role as UserRole };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.jwt.signAsync(
      { ...payload, type: 'refresh' },
      { expiresIn: this.config.getOrThrow<string>('JWT_REFRESH_EXPIRY') },
    );
    return { accessToken, refreshToken };
  }

  /**
   * Exchanges a refresh JWT for a new access token. Used by the web app to
   * restore its session after a browser reload without ever storing the
   * refresh token in web storage — it lives only in an httpOnly cookie
   * managed by this API (see auth.controller REFRESH_COOKIE).
   */
  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: { sub?: string; type?: string };
    try {
      payload = (await this.jwt.verifyAsync(refreshToken)) as { sub?: string; type?: string };
    } catch {
      throw new UnauthorizedException('Session expired — please log in again');
    }
    if (payload.type !== 'refresh' || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Invalid session token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });
    if (!user) {
      throw new UnauthorizedException('Session expired — please log in again');
    }
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
    });
    return { accessToken };
  }
}
