import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAsLawyer, makeStorageMock } from './setup';
import { makeFakeDb } from './fake-db';

describe('API auth & santé', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp(makeFakeDb(), makeStorageMock());
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health -> 200', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });

  it('GET /api/metrics -> 200', async () => {
    await request(app.getHttpServer()).get('/api/metrics').expect(200);
  });

  it('POST /api/auth/login OK -> 200', async () => {
    const token = await loginAsLawyer(app.getHttpServer());
    expect(token).toBeDefined();
  });

  it('POST /api/auth/login mauvais password -> 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'avocat@example.test', password: 'Mauvais123!' })
      .expect(401);
  });

  it('route inconnue -> 404', async () => {
    await request(app.getHttpServer()).get('/api/route-inexistante').expect(404);
  });
});
