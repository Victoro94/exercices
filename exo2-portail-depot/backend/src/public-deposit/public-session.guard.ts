import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface PublicSessionPayload {
  scope: 'public-deposit';
  token: string;
}

@Injectable()
export class PublicSessionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      params: Record<string, string | undefined>;
      publicSession?: PublicSessionPayload;
    }>();
    const header = req.headers['authorization'] ?? req.headers['x-public-session'];
    if (!header) throw new UnauthorizedException('Session publique requise');
    const raw = header.startsWith('Bearer ') ? header.slice(7) : header;
    try {
      const payload = await this.jwt.verifyAsync<PublicSessionPayload>(raw, {
        secret: this.config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
      });
      if (payload.scope !== 'public-deposit') throw new Error('scope');
      if (payload.token !== req.params['token']) throw new Error('token mismatch');
      req.publicSession = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Session publique invalide ou expirée');
    }
  }
}
