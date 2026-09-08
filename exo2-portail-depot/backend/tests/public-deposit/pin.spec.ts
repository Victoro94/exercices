import * as bcrypt from 'bcryptjs';

describe('PIN verification (bcrypt)', () => {
  it('accepte le bon PIN, refuse un mauvais PIN', async () => {
    const hash = await bcrypt.hash('4816', 10);
    await expect(bcrypt.compare('4816', hash)).resolves.toBe(true);
    await expect(bcrypt.compare('0000', hash)).resolves.toBe(false);
  });

  it('le hash ne fuite jamais le PIN en clair', async () => {
    const hash = await bcrypt.hash('1234', 10);
    expect(hash).not.toContain('1234');
  });
});
