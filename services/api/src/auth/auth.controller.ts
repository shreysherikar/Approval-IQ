import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * Session restore (documented in apps/web/src/auth.tsx): the web app keeps the
 * ACCESS token in memory only. The long-lived REFRESH token never touches web
 * storage — it is delivered as an httpOnly cookie managed by this API, and
 * POST /auth/refresh mints a fresh access token after a browser reload.
 */
const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // matches JWT_REFRESH_EXPIRY (7d)

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 409, description: 'Email is already registered' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and receive JWT access + refresh tokens' })
  @ApiResponse({ status: 200, description: 'JWT token pair issued' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(dto).then((r) => {
      this.setRefreshCookie(res, r.refreshToken);
      return r;
    });
  }

  /**
   * Session restore endpoint. Reads the httpOnly refresh cookie, returns a new
   * access token. Public by design (like login) — the cookie IS the proof.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange the httpOnly refresh cookie for a new access token' })
  @ApiResponse({ status: 200, description: 'New access token issued' })
  @ApiResponse({ status: 401, description: 'No valid session cookie' })
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookie = this.readCookie(req, REFRESH_COOKIE);
    if (!cookie) {
      throw new UnauthorizedException('No session to restore — please log in');
    }
    const result = this.auth.refresh(cookie);
    return result.then(
      (r) => r,
      (err: unknown) => {
        // Invalid/expired session — remove the stale cookie before responding.
        this.clearRefreshCookie(res);
        throw err;
      },
    );
  }

  /** Clears the session cookie (web logout). */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear the session cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    this.clearRefreshCookie(res);
    return;
  }

  private setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      path: '/auth',
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/auth',
    });
  }

  /** Minimal single-cookie reader (avoids a cookie-parser dependency). */
  private readCookie(req: Request, name: string): string | undefined {
    const raw = req.headers.cookie;
    if (!raw) return undefined;
    for (const part of raw.split(';')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      if (part.slice(0, idx).trim() === name) {
        return decodeURIComponent(part.slice(idx + 1).trim());
      }
    }
    return undefined;
  }
}
