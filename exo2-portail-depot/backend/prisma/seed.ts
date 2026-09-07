import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL manquante. Copie backend/.env.example vers backend/.env.');
  process.exit(1);
}

const prisma = new PrismaClient();

function newToken(): string {
  return randomBytes(5).toString('hex');
}

async function main() {
  const email = process.env.DEMO_LAWYER_EMAIL ?? 'avocat@example.test';
  const password = process.env.DEMO_LAWYER_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  const existing = await prisma.depositRequest.findFirst({
    where: { userId: user.id },
  });
  if (!existing) {
    const pin = '1234';
    const token = newToken();
    await prisma.depositRequest.create({
      data: {
        title: 'Dossier Martin, pièces 2026',
        token,
        pinHash: await bcrypt.hash(pin, 10),
        expectedDocs: 4,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        userId: user.id,
      },
    });
    console.log(`Seed demande créée: token=${token} pin=${pin}`);
  }
  console.log(`Seed OK: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
