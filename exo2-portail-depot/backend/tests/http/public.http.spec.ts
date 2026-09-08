import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createDeposit, createTestApp, loginAsLawyer, makeStorageMock } from './setup';
import { makeFakeDb, seedLockedExpired, type FakeDb } from './fake-db';

describe('API dépôt public (anonyme)', () => {
  let app: INestApplication;
  let storageMock: ReturnType<typeof makeStorageMock>;
  let lawyerToken = '';
  let tokenA = '';
  let sessionA = '';

  beforeAll(async () => {
    const fake: FakeDb = makeFakeDb();
    seedLockedExpired(fake);
    storageMock = makeStorageMock();
    app = await createTestApp(fake, storageMock);
    lawyerToken = await loginAsLawyer(app.getHttpServer());
    const created = await createDeposit(app.getHttpServer(), lawyerToken, {
      title: 'Dossier A',
      pin: '4816',
      expectedDocs: 4,
    });
    tokenA = created.token;
    const unlocked = await request(app.getHttpServer())
      .post(`/api/public/${tokenA}/unlock`)
      .send({ pin: '4816' })
      .expect(200);
    expect(unlocked.body.session).toBeDefined();
    sessionA = unlocked.body.session;
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const pubAuth = () => ({ Authorization: `Bearer ${sessionA}` });

  it('POST unlock OK -> 200 (préparé en beforeAll)', () => {
    expect(sessionA).toBeDefined();
  });

  it('POST presign OK -> 201', async () => {
    const res = await request(server())
      .post(`/api/public/${tokenA}/files/presign`)
      .set(pubAuth())
      .send({ filename: 'a.pdf', mime: 'application/pdf', size: 100 })
      .expect(201);
    expect(res.body.uploadUrl).toBe('http://minio.test/put');
  });

  it('GET /api/public/:token inclut la progression', async () => {
    const res = await request(server()).get(`/api/public/${tokenA}`).expect(200);
    expect(res.body).toMatchObject({ title: 'Dossier A', expectedDocs: 4 });
  });

  it('POST unlock PIN mal formé -> 400', async () => {
    await request(server()).post(`/api/public/${tokenA}/unlock`).send({ pin: 'abc' }).expect(400);
  });

  it('POST presign mime refusé -> 400', async () => {
    await request(server())
      .post(`/api/public/${tokenA}/files/presign`)
      .set(pubAuth())
      .send({ filename: 'a.exe', mime: 'application/x-msdownload', size: 10 })
      .expect(400);
  });

  it('POST complete objet absent de MinIO -> 400', async () => {
    const pre = await request(server())
      .post(`/api/public/${tokenA}/files/presign`)
      .set(pubAuth())
      .send({ filename: 'b.pdf', mime: 'application/pdf', size: 10 })
      .expect(201);
    storageMock.exists.mockResolvedValueOnce(false);
    await request(server())
      .post(`/api/public/${tokenA}/files/${pre.body.documentId}/complete`)
      .set(pubAuth())
      .send({})
      .expect(400);
  });

  it('POST unlock mauvais PIN -> 401', async () => {
    await request(server()).post(`/api/public/${tokenA}/unlock`).send({ pin: '0000' }).expect(401);
  });

  it('POST presign sans session publique -> 401', async () => {
    await request(server())
      .post(`/api/public/${tokenA}/files/presign`)
      .send({ filename: 'a.pdf', mime: 'application/pdf', size: 10 })
      .expect(401);
  });

  it('POST presign avec JWT avocat (mauvais scope) -> 401', async () => {
    await request(server())
      .post(`/api/public/${tokenA}/files/presign`)
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({ filename: 'a.pdf', mime: 'application/pdf', size: 10 })
      .expect(401);
  });

  it('POST unlock lien expiré -> 403', async () => {
    await request(server()).post('/api/public/expiredtok/unlock').send({ pin: '9999' }).expect(403);
  });

  it('POST unlock lien verrouillé -> 403', async () => {
    await request(server())
      .post('/api/public/lockedtokk/unlock')
      .send({ pin: '9999' })
      .expect(403);
  });

  it('POST presign sur lien expiré -> 403', async () => {
    const jwt = new JwtService({ secret: 'test-secret' });
    const session = await jwt.signAsync(
      { scope: 'public-deposit', token: 'expiredtok' },
      { expiresIn: '15m' },
    );
    await request(server())
      .post('/api/public/expiredtok/files/presign')
      .set('Authorization', `Bearer ${session}`)
      .send({ filename: 'a.pdf', mime: 'application/pdf', size: 10 })
      .expect(403);
  });

  it('GET /api/public/:token inconnu -> 404', async () => {
    await request(server()).get('/api/public/nope-nope').expect(404);
  });

  it('POST unlock token inconnu -> 404', async () => {
    await request(server()).post('/api/public/nope-nope/unlock').send({ pin: '1234' }).expect(404);
  });

  it('POST complete document inconnu -> 404', async () => {
    await request(server())
      .post(`/api/public/${tokenA}/files/doc-inconnu/complete`)
      .set(pubAuth())
      .send({})
      .expect(404);
  });

  it('GET /api/public/:token/files sans session -> 401', async () => {
    await request(server()).get(`/api/public/${tokenA}/files`).expect(401);
  });

  it('DELETE sans session -> 401, document inconnu -> 404', async () => {
    await request(server()).delete(`/api/public/${tokenA}/files/doc-inconnu`).expect(401);
    await request(server())
      .delete(`/api/public/${tokenA}/files/doc-inconnu`)
      .set(pubAuth())
      .expect(404);
  });

  it('fichiers déjà déposés visibles puis supprimables -> 200', async () => {
    const pre = await request(server())
      .post(`/api/public/${tokenA}/files/presign`)
      .set(pubAuth())
      .send({ filename: 'garde.pdf', mime: 'application/pdf', size: 10 })
      .expect(201);
    await request(server())
      .post(`/api/public/${tokenA}/files/${pre.body.documentId}/complete`)
      .set(pubAuth())
      .send({})
      .expect(200);

    const listed = await request(server())
      .get(`/api/public/${tokenA}/files`)
      .set(pubAuth())
      .expect(200);
    expect(listed.body.map((d: any) => d.id)).toContain(pre.body.documentId);
    expect(listed.body[0]).not.toHaveProperty('s3Key');

    const del = await request(server())
      .delete(`/api/public/${tokenA}/files/${pre.body.documentId}`)
      .set(pubAuth())
      .expect(200);
    expect(del.body.readyCount).toBe(0);

    const relisted = await request(server())
      .get(`/api/public/${tokenA}/files`)
      .set(pubAuth())
      .expect(200);
    expect(relisted.body).toHaveLength(0);
  });

  it('GET download sans session -> 401, document inconnu -> 404', async () => {
    await request(server()).get(`/api/public/${tokenA}/files/doc-inconnu/download`).expect(401);
    await request(server())
      .get(`/api/public/${tokenA}/files/doc-inconnu/download`)
      .set(pubAuth())
      .expect(404);
  });

  it('GET download OK -> 200 avec URL presignée', async () => {
    const pre = await request(server())
      .post(`/api/public/${tokenA}/files/presign`)
      .set(pubAuth())
      .send({ filename: 'dl.pdf', mime: 'application/pdf', size: 10 })
      .expect(201);
    await request(server())
      .post(`/api/public/${tokenA}/files/${pre.body.documentId}/complete`)
      .set(pubAuth())
      .send({})
      .expect(200);
    const res = await request(server())
      .get(`/api/public/${tokenA}/files/${pre.body.documentId}/download`)
      .set(pubAuth())
      .expect(200);
    expect(res.body.downloadUrl).toBeDefined();
    expect(res.body.filename).toBe('dl.pdf');
  });

  it('parcours complet : unlock -> presign -> complete = COMPLETE', async () => {
    const created = await createDeposit(server(), lawyerToken, {
      title: 'Dossier Solo',
      pin: '1357',
      expectedDocs: 1,
    });
    const unlocked = await request(server())
      .post(`/api/public/${created.token}/unlock`)
      .send({ pin: '1357' })
      .expect(200);
    const pre = await request(server())
      .post(`/api/public/${created.token}/files/presign`)
      .set('Authorization', `Bearer ${unlocked.body.session}`)
      .send({ filename: 'solo.pdf', mime: 'application/pdf', size: 10 })
      .expect(201);
    const done = await request(server())
      .post(`/api/public/${created.token}/files/${pre.body.documentId}/complete`)
      .set('Authorization', `Bearer ${unlocked.body.session}`)
      .send({})
      .expect(200);
    expect(done.body).toMatchObject({ status: 'COMPLETE', readyCount: 1 });
  });

  it('flood unlock (6 tentatives) -> 429', async () => {
    // App dédiée au rate-limit : le compteur du throttle est par instance.
    const app2 = await createTestApp(makeFakeDb(), makeStorageMock(), true);
    try {
      const token2 = await loginAsLawyer(app2.getHttpServer());
      const created = await createDeposit(app2.getHttpServer(), token2, {
        title: 'Dossier Flood',
        pin: '2468',
      });
      const codes: number[] = [];
      for (let i = 0; i < 6; i++) {
        const r = await request(app2.getHttpServer())
          .post(`/api/public/${created.token}/unlock`)
          .send({ pin: '0000' });
        codes.push(r.status);
      }
      expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(codes[5]).toBe(429);
    } finally {
      await app2.close();
    }
  });
});
