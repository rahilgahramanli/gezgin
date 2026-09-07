import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { ERROR_CODES } from '@gezgin/shared';

export interface SocialIdentity {
  provider: 'google' | 'apple';
  subject: string;
  email: string | null;
  emailVerified: boolean;
  fullName: string | null;
  picture: string | null;
}

/**
 * Sosial girişin yoxlanması. Ödəniş qatındakı ilə eyni yanaşma:
 * interfeys arxasında, kredensiallar gələnə qədər mock ilə işləyir.
 *
 * SOCIAL_MODE=mock  → `mock:<email>` formatlı token qəbul edir (yalnız dev)
 * SOCIAL_MODE=live  → Google id_token və Apple identity_token real yoxlanılır
 */
@Injectable()
export class SocialVerifier {
  private readonly logger = new Logger(SocialVerifier.name);
  /**
   * `google-auth-library` və `jwks-rsa` yalnız SOCIAL_MODE=live-də lazımdır və
   * ESM asılılıqları gətirir. Modul səviyyəsində import etsək, mock rejimdə də
   * (və testlərdə) yüklənərdi — ona görə tələb olunanda gec yüklənir.
   */
  private appleJwksClient?: { getSigningKey(kid?: string): Promise<{ getPublicKey(): string }> };

  private async getAppleJwks() {
    if (!this.appleJwksClient) {
      const { JwksClient } = await import('jwks-rsa');
      this.appleJwksClient = new JwksClient({
        jwksUri: 'https://appleid.apple.com/auth/keys',
        cache: true,
        cacheMaxAge: 6 * 60 * 60 * 1000,
        rateLimit: true,
      });
    }
    return this.appleJwksClient;
  }

  constructor(private readonly config: ConfigService) {}

  private get isMock(): boolean {
    return (this.config.get<string>('SOCIAL_MODE') ?? 'mock') === 'mock';
  }

  private mockIdentity(provider: 'google' | 'apple', token: string): SocialIdentity {
    if (!token.startsWith('mock:')) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Mock rejimdə token "mock:<email>" formatında olmalıdır',
      });
    }
    const email = token.slice(5).trim().toLowerCase();
    if (!email.includes('@')) {
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHORIZED, message: 'Mock tokendə e-mail yanlışdır' });
    }
    this.logger.warn(`Sosial giriş MOCK rejimdədir (${provider}) — production-da SOCIAL_MODE=live olmalıdır`);
    return {
      provider,
      subject: `mock-${provider}-${email}`,
      email,
      emailVerified: true,
      fullName: email.split('@')[0].replace(/[._-]/g, ' '),
      picture: null,
    };
  }

  async verifyGoogle(idToken: string): Promise<SocialIdentity> {
    if (this.isMock) return this.mockIdentity('google', idToken);

    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHORIZED, message: 'GOOGLE_CLIENT_ID konfiqurasiya olunmayıb' });
    }
    try {
      const { OAuth2Client } = await import('google-auth-library');
      const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken, audience: clientId });
      const p = ticket.getPayload();
      if (!p?.sub) throw new Error('payload boşdur');
      return {
        provider: 'google',
        subject: p.sub,
        email: p.email ?? null,
        emailVerified: Boolean(p.email_verified),
        fullName: p.name ?? null,
        picture: p.picture ?? null,
      };
    } catch (e) {
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHORIZED, message: `Google token yoxlanmadı: ${(e as Error).message}` });
    }
  }

  async verifyApple(identityToken: string): Promise<SocialIdentity> {
    if (this.isMock) return this.mockIdentity('apple', identityToken);

    const clientId = this.config.get<string>('APPLE_CLIENT_ID');
    if (!clientId) {
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHORIZED, message: 'APPLE_CLIENT_ID konfiqurasiya olunmayıb' });
    }
    try {
      const jwks = await this.getAppleJwks();
      const payload = await new Promise<jwt.JwtPayload>((resolve, reject) => {
        jwt.verify(
          identityToken,
          (header, cb) => {
            jwks
              .getSigningKey(header.kid)
              .then((key) => cb(null, key.getPublicKey()))
              .catch((err: Error) => cb(err));
          },
          { issuer: 'https://appleid.apple.com', audience: clientId, algorithms: ['RS256'] },
          (err, decoded) => (err ? reject(err) : resolve(decoded as jwt.JwtPayload)),
        );
      });
      return {
        provider: 'apple',
        subject: String(payload.sub),
        email: (payload.email as string | undefined) ?? null,
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
        fullName: null, // Apple adı yalnız ilk girişdə client tərəfindən göndərir
        picture: null,
      };
    } catch (e) {
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHORIZED, message: `Apple token yoxlanmadı: ${(e as Error).message}` });
    }
  }
}
