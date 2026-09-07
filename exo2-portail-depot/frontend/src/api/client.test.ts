import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './client';

function jsonResponse(body: unknown, init: { status: number; ok: boolean }) {
  return { ...init, json: async () => body } as Response;
}

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  it('login envoie email/password en POST', async () => {
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValue(
      jsonResponse({ access_token: 't', user: { id: 'u', email: 'a@t.test' } }, { status: 200, ok: true }),
    );
    await api.login('a@t.test', 'Secret123!');
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'a@t.test', password: 'Secret123!' }),
      }),
    );
  });

  it('remonte le message serveur en cas d’erreur', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse({ message: 'Identifiants invalides' }, { status: 401, ok: false }),
    );
    await expect(api.login('a@t.test', 'bad')).rejects.toThrow('Identifiants invalides');
  });

  it('joint le JWT avocat quand il est stocké', async () => {
    localStorage.setItem('div_token', 'jwt-123');
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValue(jsonResponse([], { status: 200, ok: true }));
    await api.listRequests();
    expect(fetch).toHaveBeenCalledWith(
      '/api/requests',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-123' }),
      }),
    );
  });
});
