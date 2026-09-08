import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createDeposit, createTestApp, loginAsLawyer, makeStorageMock } from './setup';
import { makeFakeDb } from './fake-db';

describe('API demandes (avocat)', () => {
  let app: INestApplication;
  let lawyerToken = '';

  beforeAll(async () => {
    app = await createTestApp(makeFakeDb(), makeStorageMock());
    lawyerToken = await loginAsLawyer(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${lawyerToken}` });
  const server = () => app.getHttpServer();

  it('POST /api/requests OK -> 201', async () => {
    const body = await createDeposit(server(), lawyerToken, {
      title: 'Dossier A',
      pin: '4816',
      expectedDocs: 4,
    });
    expect(body.publicUrlPath).toMatch(/^\/d\//);
  });

  it('POST /api/requests PIN invalide -> 400', async () => {
    await request(server())
      .post('/api/requests')
      .set(auth())
      .send({ title: 'Dossier B', pin: '12' })
      .expect(400);
  });

  it('POST /api/requests sans JWT -> 401', async () => {
    await request(server()).post('/api/requests').send({ title: 'D', pin: '1234' }).expect(401);
  });

  it('GET /api/requests -> 200, sans JWT -> 401', async () => {
    const res = await request(server()).get('/api/requests').set(auth()).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    await request(server()).get('/api/requests').expect(401);
  });

  it('GET /api/requests/:id inclut les documents, DELETE supprime -> 200 puis 404', async () => {
    const created = await createDeposit(server(), lawyerToken, {
      title: 'Dossier Cycle de vie',
      pin: '4242',
    });

    const before = await request(server())
      .get(`/api/requests/${created.id}`)
      .set(auth())
      .expect(200);
    expect(before.body.documents).toEqual([]);

    await request(server()).delete(`/api/requests/${created.id}`).set(auth()).expect(200);
    await request(server()).get(`/api/requests/${created.id}`).set(auth()).expect(404);
    await request(server()).delete(`/api/requests/${created.id}`).expect(401);
  });

  it('GET /api/requests/:id inconnu -> 404', async () => {
    await request(server()).get('/api/requests/req-inexistante').set(auth()).expect(404);
  });

  it('PATCH partiel (titre seul) conserve le reste -> 200', async () => {
    const created = await createDeposit(server(), lawyerToken, {
      title: 'Titre initial',
      pin: '5656',
    });
    const res = await request(server())
      .patch(`/api/requests/${created.id}`)
      .set(auth())
      .send({ title: 'Titre modifié' })
      .expect(200);
    expect(res.body.title).toBe('Titre modifié');
    expect(res.body.expectedDocs).toBe(created.expectedDocs);
    expect(res.body.token).toBe(created.token);
  });

  it('PATCH prolonge l’expiration -> 200', async () => {
    const created = await createDeposit(server(), lawyerToken, {
      title: 'À prolonger',
      pin: '1111',
      expiresInDays: 1,
    });
    const future = new Date(Date.now() + 30 * 86400000).toISOString();
    const res = await request(server())
      .patch(`/api/requests/${created.id}`)
      .set(auth())
      .send({ expiresAt: future, expectedDocs: 2 })
      .expect(200);
    expect(new Date(res.body.expiresAt).toISOString()).toBe(future);
    expect(res.body.expectedDocs).toBe(2);
    expect(res.body.status).toBe('PENDING');
  });

  it('PATCH date invalide -> 400, sans JWT -> 401, inconnu -> 404', async () => {
    await request(server())
      .patch('/api/requests/r1')
      .set(auth())
      .send({ expiresAt: 'pas-une-date' })
      .expect(400);
    await request(server()).patch('/api/requests/r1').send({ title: 'X' }).expect(401);
    await request(server())
      .patch('/api/requests/req-inexistante')
      .set(auth())
      .send({ title: 'Nouveau titre valide' })
      .expect(404);
  });

  it('avocat voit les pièces et les re-télécharge -> 200', async () => {
    const created = await createDeposit(server(), lawyerToken, {
      title: 'Dossier Vue avocat',
      pin: '7777',
    });
    const unlocked = await request(server())
      .post(`/api/public/${created.token}/unlock`)
      .send({ pin: '7777' })
      .expect(200);
    const pre = await request(server())
      .post(`/api/public/${created.token}/files/presign`)
      .set('Authorization', `Bearer ${unlocked.body.session}`)
      .send({ filename: 'vue.pdf', mime: 'application/pdf', size: 10 })
      .expect(201);
    await request(server())
      .post(`/api/public/${created.token}/files/${pre.body.documentId}/complete`)
      .set('Authorization', `Bearer ${unlocked.body.session}`)
      .send({})
      .expect(200);

    const files = await request(server())
      .get(`/api/requests/${created.id}/files`)
      .set(auth())
      .expect(200);
    expect(files.body).toHaveLength(1);
    expect(files.body[0]).toMatchObject({ id: pre.body.documentId, filename: 'vue.pdf' });
    expect(files.body[0]).not.toHaveProperty('s3Key');

    const dl = await request(server())
      .get(`/api/requests/${created.id}/files/${pre.body.documentId}/download`)
      .set(auth())
      .expect(200);
    expect(dl.body.downloadUrl).toBeDefined();
  });

  it('fichiers avocat : 401 sans JWT, 404 demande/doc inconnus', async () => {
    await request(server()).get('/api/requests/r1/files').expect(401);
    await request(server())
      .get('/api/requests/req-inexistante/files')
      .set(auth())
      .expect(404);
    await request(server())
      .get('/api/requests/req-inexistante/files/d1/download')
      .set(auth())
      .expect(404);
  });
});
