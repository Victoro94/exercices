import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../src/api/client';

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

  it('unlock, meta, presign, complete, deleteRequest : URL + méthode + auth', async () => {
    sessionStorage.setItem('div_public_tok', 'sess-1');
    localStorage.setItem('div_token', 'jwt-123');
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValue(jsonResponse({ ok: true }, { status: 200, ok: true }));

    await api.unlock('tok', '1234');
    expect(fetch).toHaveBeenCalledWith(
      '/api/public/tok/unlock',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ pin: '1234' }) }),
    );
    await api.publicMeta('tok');
    expect(fetch).toHaveBeenCalledWith('/api/public/tok', expect.anything());
    await api.presign('tok', { filename: 'a.pdf', mime: 'application/pdf', size: 10 });
    expect(fetch).toHaveBeenCalledWith(
      '/api/public/tok/files/presign',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sess-1' }),
      }),
    );
    await api.complete('tok', 'd1');
    expect(fetch).toHaveBeenCalledWith(
      '/api/public/tok/files/d1/complete',
      expect.objectContaining({ method: 'POST' }),
    );
    await api.deleteRequest('r1');
    expect(fetch).toHaveBeenCalledWith(
      '/api/requests/r1',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-123' }),
      }),
    );
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

  it('listFiles joint la session publique du lien', async () => {
    sessionStorage.setItem('div_public_tok', 'sess-1');
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValue(jsonResponse([], { status: 200, ok: true }));
    await api.listFiles('tok');
    expect(fetch).toHaveBeenCalledWith(
      '/api/public/tok/files',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sess-1' }),
      }),
    );
  });

  it('deleteFile envoie DELETE sur le document', async () => {
    sessionStorage.setItem('div_public_tok', 'sess-1');
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValue(
      jsonResponse({ readyCount: 0, expectedDocs: 1, status: 'PENDING' }, { status: 200, ok: true }),
    );
    const r = await api.deleteFile('tok', 'd1');
    expect(fetch).toHaveBeenCalledWith(
      '/api/public/tok/files/d1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(r.readyCount).toBe(0);
  });

  it('downloadFile récupère l’URL presignée', async () => {
    sessionStorage.setItem('div_public_tok', 'sess-1');
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValue(
      jsonResponse(
        { downloadUrl: 'http://minio/get', filename: 'a.pdf', mime: 'application/pdf', expiresIn: 300 },
        { status: 200, ok: true },
      ),
    );
    const r = await api.downloadFile('tok', 'd1');
    expect(fetch).toHaveBeenCalledWith(
      '/api/public/tok/files/d1/download',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sess-1' }),
      }),
    );
    expect(r.downloadUrl).toBe('http://minio/get');
  });

  it('getRequestFiles + downloadRequestFile avocat (JWT)', async () => {
    localStorage.setItem('div_token', 'jwt-123');
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValue(jsonResponse([{ id: 'd1' }], { status: 200, ok: true }));
    await api.getRequestFiles('r1');
    expect(fetch).toHaveBeenCalledWith(
      '/api/requests/r1/files',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-123' }),
      }),
    );
    fetch.mockResolvedValue(
      jsonResponse({ downloadUrl: 'http://minio/get' }, { status: 200, ok: true }),
    );
    await api.downloadRequestFile('r1', 'd1');
    expect(fetch).toHaveBeenCalledWith(
      '/api/requests/r1/files/d1/download',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-123' }),
      }),
    );
  });

  it('createRequest envoie pièces attendues + expiration', async () => {
    localStorage.setItem('div_token', 'jwt-123');
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValue(
      jsonResponse({ id: 'r1' }, { status: 201, ok: true }),
    );
    await api.createRequest({ title: 'D', pin: '1234', expectedDocs: 6, expiresInDays: 14 });
    expect(fetch).toHaveBeenCalledWith(
      '/api/requests',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'D', pin: '1234', expectedDocs: 6, expiresInDays: 14 }),
      }),
    );
  });

  it('updateRequest envoie PATCH avec le DTO', async () => {
    localStorage.setItem('div_token', 'jwt-123');
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValue(
      jsonResponse({ id: 'r1', title: 'Nouveau' }, { status: 200, ok: true }),
    );
    await api.updateRequest('r1', { title: 'Nouveau', expectedDocs: 6 });
    expect(fetch).toHaveBeenCalledWith(
      '/api/requests/r1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ title: 'Nouveau', expectedDocs: 6 }),
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-123' }),
      }),
    );
  });
});
