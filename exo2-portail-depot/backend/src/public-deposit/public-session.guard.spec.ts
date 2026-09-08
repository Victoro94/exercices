import { UnauthorizedException } from '@nestjs/common';
import { PublicSessionGuard } from './public-session.guard';

function ctxWith(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}

describe('PublicSessionGuard', () => {
  const jwt = { verifyAsync: jest.fn() };
  const config = { get: jest.fn().mockReturnValue('test-secret') };
  const guard = new PublicSessionGuard(jwt as never, config as never);

  beforeEach(() => jest.clearAllMocks());

  it('laisse passer une session valide scopée au token', async () => {
    jwt.verifyAsync.mockResolvedValue({ scope: 'public-deposit', token: 'tok123' });
    const req: Record<string, unknown> = {
      headers: { authorization: 'Bearer sess' },
      params: { token: 'tok123' },
    };
    await expect(guard.canActivate(ctxWith(req))).resolves.toBe(true);
    expect(req.publicSession).toMatchObject({ token: 'tok123' });
  });

  it('accepte le header x-public-session sans préfixe Bearer', async () => {
    jwt.verifyAsync.mockResolvedValue({ scope: 'public-deposit', token: 'tok123' });
    const req: Record<string, unknown> = {
      headers: { 'x-public-session': 'sess' },
      params: { token: 'tok123' },
    };
    await expect(guard.canActivate(ctxWith(req))).resolves.toBe(true);
  });

  it('rejette : header absent, mauvais scope, token différent', async () => {
    await expect(
      guard.canActivate(ctxWith({ headers: {}, params: { token: 'tok123' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    jwt.verifyAsync.mockResolvedValue({ scope: 'lawyer', token: 'tok123' });
    await expect(
      guard.canActivate(
        ctxWith({ headers: { authorization: 'Bearer x' }, params: { token: 'tok123' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    jwt.verifyAsync.mockResolvedValue({ scope: 'public-deposit', token: 'autre' });
    await expect(
      guard.canActivate(
        ctxWith({ headers: { authorization: 'Bearer x' }, params: { token: 'tok123' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    jwt.verifyAsync.mockRejectedValue(new Error('expired'));
    await expect(
      guard.canActivate(
        ctxWith({ headers: { authorization: 'Bearer x' }, params: { token: 'tok123' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
