import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing (Issue #31)', () => {
  it('hashes passwords so the plaintext is not stored', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(hash).not.toBe('correct-horse-battery');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifies the correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('s3cret-pass');
    await expect(verifyPassword('s3cret-pass', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-pass', hash)).resolves.toBe(false);
  });
});
