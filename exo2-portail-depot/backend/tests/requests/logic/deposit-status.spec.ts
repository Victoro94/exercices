import {
  computeStatus,
  isExpired,
  isLocked,
  nextLockoutDate,
  shouldLockout,
} from '../../../src/requests/logic/deposit-status';

describe('deposit-status (logique métier)', () => {
  const now = new Date('2026-03-12T10:00:00Z');

  it('PENDING quand lien valide et dépôt incomplet', () => {
    const expires = new Date('2026-03-19T10:00:00Z');
    expect(computeStatus(expires, 2, 4, now)).toBe('PENDING');
  });

  it('COMPLETE quand le nombre attendu est atteint', () => {
    const expires = new Date('2026-03-19T10:00:00Z');
    expect(computeStatus(expires, 4, 4, now)).toBe('COMPLETE');
    expect(computeStatus(expires, 5, 4, now)).toBe('COMPLETE');
  });

  it('EXPIRED prime sur COMPLETE quand la date est dépassée', () => {
    const expires = new Date('2026-03-10T10:00:00Z');
    expect(isExpired(expires, now)).toBe(true);
    expect(computeStatus(expires, 4, 4, now)).toBe('EXPIRED');
    expect(computeStatus(expires, 0, 4, now)).toBe('EXPIRED');
  });

  it('verrou PIN après N échecs', () => {
    expect(shouldLockout(3)).toBe(false);
    expect(shouldLockout(4)).toBe(true);
    expect(isLocked(null, now)).toBe(false);
    expect(isLocked(new Date('2026-03-12T09:00:00Z'), now)).toBe(false);
    expect(isLocked(nextLockoutDate(now), now)).toBe(true);
  });
});
