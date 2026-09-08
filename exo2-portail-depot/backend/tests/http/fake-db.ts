import * as bcrypt from 'bcryptjs';

/** Fake Prisma en mémoire : remplace Postgres dans les tests HTTP. */
export function makeFakeDb() {
  const state: { users: any[]; requests: any[]; documents: any[]; audit: any[]; seq: number } = {
    users: [
      {
        id: 'u1',
        email: 'avocat@example.test',
        passwordHash: bcrypt.hashSync('Secret123!', 4),
      },
    ],
    requests: [],
    documents: [],
    audit: [],
    seq: 1,
  };
  const readyCount = (requestId: string) =>
    state.documents.filter((d) => d.requestId === requestId && d.status === 'READY').length;
  const withCount = (r: any) => (r ? { ...r, _count: { documents: readyCount(r.id) } } : r);
  const matches = (row: any, where: any) =>
    Object.entries(where ?? {}).every(([k, v]) => row[k] === v);

  return {
    state,
    user: {
      findUnique: async ({ where }: any) =>
        state.users.find((u) => u.email === where.email) ?? null,
    },
    depositRequest: {
      create: async ({ data }: any) => {
        const r = {
          id: `r${state.seq++}`,
          failedAttempts: 0,
          lockedUntil: null,
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        state.requests.push(r);
        return r;
      },
      findUnique: async ({ where }: any) =>
        withCount(state.requests.find((r) => matches(r, where)) ?? null),
      findFirst: async ({ where }: any) =>
        withCount(state.requests.find((r) => matches(r, where)) ?? null),
      findMany: async ({ where }: any) =>
        state.requests.filter((r) => matches(r, where)).map(withCount),
      update: async ({ where, data }: any) => {
        const r = state.requests.find((x) => matches(x, where));
        Object.assign(r, data);
        return r;
      },
      deleteMany: async ({ where }: any) => {
        const before = state.requests.length;
        state.requests = state.requests.filter((r) => !matches(r, where));
        return { count: before - state.requests.length };
      },
    },
    document: {
      create: async ({ data }: any) => {
        const d = { status: 'PENDING', createdAt: new Date(), ...data };
        state.documents.push(d);
        return d;
      },
      findFirst: async ({ where }: any) =>
        state.documents.find((d) => matches(d, where)) ?? null,
      findMany: async ({ where }: any) =>
        state.documents.filter((d) => matches(d, where)),
      update: async ({ where, data }: any) => {
        const d = state.documents.find((x) => matches(x, where));
        Object.assign(d, data);
        return d;
      },
      delete: async ({ where }: any) => {
        const i = state.documents.findIndex((d) => matches(d, where));
        const [d] = state.documents.splice(i, 1);
        return d;
      },
      count: async ({ where }: any) => state.documents.filter((d) => matches(d, where)).length,
    },
    auditLog: {
      create: async ({ data }: any) => {
        const a = { id: `a${state.seq++}`, createdAt: new Date(), ...data };
        state.audit.push(a);
        return a;
      },
    },
  };
}

export type FakeDb = ReturnType<typeof makeFakeDb>;

/** Demandes pré-existantes pour les cas 403 : une expirée, une verrouillée (PIN 9999). */
export function seedLockedExpired(fake: FakeDb) {
  const pinHash = bcrypt.hashSync('9999', 4);
  fake.state.requests.push(
    {
      id: 'rx',
      title: 'Expirée',
      token: 'expiredtok',
      pinHash,
      expectedDocs: 4,
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000),
      failedAttempts: 0,
      lockedUntil: null,
      userId: 'u1',
      createdAt: new Date(),
    },
    {
      id: 'rl',
      title: 'Verrouillée',
      token: 'lockedtokk',
      pinHash,
      expectedDocs: 4,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400000),
      failedAttempts: 5,
      lockedUntil: new Date(Date.now() + 600000),
      userId: 'u1',
      createdAt: new Date(),
    },
  );
}
