import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../../src/auth/auth.service';

describe('AuthService', () => {
  let prisma: { user: { findUnique: jest.Mock } };
  let jwt: { signAsync: jest.Mock };
  let svc: AuthService;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('Secret123!', 4);
  });

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    jwt = { signAsync: jest.fn().mockResolvedValue('jwt-token') };
    svc = new AuthService(prisma as any, jwt as any);
  });

  it('login OK retourne access_token + user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@t.test', passwordHash });
    const r = await svc.login('a@t.test', 'Secret123!');
    expect(r.access_token).toBe('jwt-token');
    expect(r.user).toEqual({ id: 'u1', email: 'a@t.test' });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u1', role: 'lawyer' }),
    );
  });

  it('mot de passe faux -> 401 générique', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@t.test', passwordHash });
    await expect(svc.login('a@t.test', 'WrongPass1!')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('utilisateur inconnu -> même 401 (pas d’oracle)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(svc.login('x@t.test', 'Secret123!')).rejects.toThrow(
      'Identifiants invalides',
    );
  });
});
