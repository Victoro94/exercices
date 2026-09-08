import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UnlockDto } from '../../../src/public-deposit/dto/unlock.dto';
import { PresignDto } from '../../../src/public-deposit/dto/presign.dto';

describe('DTO dépôt public', () => {
  it('unlock : PIN 4 chiffres uniquement', async () => {
    expect(await validate(plainToInstance(UnlockDto, { pin: '4816' }))).toHaveLength(0);
    for (const pin of ['12', '12345', 'abcd', '']) {
      expect(await validate(plainToInstance(UnlockDto, { pin }))).not.toHaveLength(0);
    }
  });

  it('presign : taille 1..20Mo, nom borné', async () => {
    expect(
      await validate(plainToInstance(PresignDto, { filename: 'a.pdf', mime: 'application/pdf', size: 100 })),
    ).toHaveLength(0);
    expect(
      await validate(plainToInstance(PresignDto, { filename: 'a.pdf', mime: 'application/pdf', size: 0 })),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(PresignDto, { filename: 'a.pdf', mime: 'application/pdf', size: 21 * 1024 * 1024 }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(PresignDto, { filename: 'x'.repeat(200), mime: 'application/pdf', size: 100 }),
      ),
    ).not.toHaveLength(0);
  });
});
