import { describe, it, expect } from 'vitest';
import { tryGetSessionKeys } from './postern-source';

/**
 * The session-keys reader feeds the EmergencyStopCard's "session keys" count
 * and the /app/settings/session-keys list. Its single most important property
 * is honesty: when there is no user, it must return an empty list flagged
 * `pending`, never a fabricated key and never a thrown error that the UI would
 * have to paper over. This locks that path (it is pure - no RPC, no registry).
 */
describe('tryGetSessionKeys', () => {
  it('returns an honest empty pending result when no wallet is given', async () => {
    const res = await tryGetSessionKeys(null);
    expect(res.source).toBe('pending');
    expect(res.keys).toEqual([]);
  });

  it('returns an honest empty pending result for an empty-string wallet', async () => {
    const res = await tryGetSessionKeys('');
    expect(res.source).toBe('pending');
    expect(res.keys).toEqual([]);
  });
});
