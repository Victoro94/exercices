import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateRequestDto } from './update-request.dto';

async function errorsOf(dto: object) {
  return validate(plainToInstance(UpdateRequestDto, dto));
}

describe('UpdateRequestDto', () => {
  it('accepte un DTO vide (patch partiel)', async () => {
    expect(await errorsOf({})).toHaveLength(0);
  });

  it('accepte titre + pièces + expiration ISO', async () => {
    expect(
      await errorsOf({
        title: 'Nouveau titre',
        expectedDocs: 6,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    ).toHaveLength(0);
  });

  it('refuse date non ISO et bornes invalides', async () => {
    expect(await errorsOf({ expiresAt: 'demain' })).not.toHaveLength(0);
    expect(await errorsOf({ expectedDocs: 0 })).not.toHaveLength(0);
    expect(await errorsOf({ title: 'ab' })).not.toHaveLength(0);
  });
});
