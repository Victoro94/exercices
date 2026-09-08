import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateRequestDto } from '../../../src/requests/dto/create-request.dto';

async function errorsOf(dto: object) {
  return validate(plainToInstance(CreateRequestDto, dto));
}

describe('CreateRequestDto', () => {
  it('accepte un DTO valide', async () => {
    expect(await errorsOf({ title: 'Dossier Martin', pin: '4816' })).toHaveLength(0);
  });

  it('refuse un PIN qui n’a pas exactement 4 chiffres', async () => {
    for (const pin of ['12', '12345', 'abcd', '12a4']) {
      const errors = await errorsOf({ title: 'Dossier Martin', pin });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('refuse un titre trop court et expectedDocs hors borne', async () => {
    expect(await errorsOf({ title: 'ab', pin: '4816' })).not.toHaveLength(0);
    expect(await errorsOf({ title: 'Dossier', pin: '4816', expectedDocs: 0 })).not.toHaveLength(
      0,
    );
    expect(await errorsOf({ title: 'Dossier', pin: '4816', expectedDocs: 51 })).not.toHaveLength(
      0,
    );
  });
});
