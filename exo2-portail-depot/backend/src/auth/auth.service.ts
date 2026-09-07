import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async validateLawyer(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Identifiants invalides');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Identifiants invalides');
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateLawyer(email, password);
    const payload = { sub: user.id, email: user.email, role: 'lawyer' };
    return {
      access_token: await this.jwt.signAsync(payload),
      user: { id: user.id, email: user.email },
    };
  }
}
