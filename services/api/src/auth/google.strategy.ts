import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') || 'google-client-id-placeholder',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') || 'google-client-secret-placeholder',
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3001/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(new UnauthorizedException('No email returned from Google account'), false);
      }

      const user = await this.authService.validateOrCreateGoogleUser({
        googleId: profile.id,
        email: email.toLowerCase(),
      });

      return done(null, user);
    } catch (err) {
      return done(err as Error, false);
    }
  }
}
