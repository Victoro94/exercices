export type RequestStatus = 'PENDING' | 'COMPLETE' | 'EXPIRED';

export const MAX_PIN_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() > new Date(expiresAt).getTime();
}

export function computeStatus(
  expiresAt: Date,
  readyCount: number,
  expectedDocs: number,
  now: Date = new Date(),
): RequestStatus {
  if (isExpired(expiresAt, now)) return 'EXPIRED';
  if (readyCount >= expectedDocs) return 'COMPLETE';
  return 'PENDING';
}

export function isLocked(lockedUntil: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lockedUntil) return false;
  return new Date(lockedUntil).getTime() > now.getTime();
}

export function shouldLockout(failedAttempts: number): boolean {
  return failedAttempts + 1 >= MAX_PIN_ATTEMPTS;
}

export function nextLockoutDate(now: Date = new Date()): Date {
  return new Date(now.getTime() + LOCKOUT_MS);
}
