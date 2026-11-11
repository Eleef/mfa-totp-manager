import { describe, expect, it } from 'vitest';
import { parseEntries, parseLine } from './accounts';
import { encodeBase32 } from './base32';
import {
  amendEntry,
  backup,
  nameEntry,
  readBackup,
  reconcilePasswords,
  submitEntries,
} from './entry-manager';

// RFC 4226 public test secret, not a real account.
const secret = encodeBase32(new TextEncoder().encode('12345678901234567890'), { padding: false });
const first = `GitHub: ${secret}`;
const second = `Email: ${secret}`;

describe('Clockwork local account management', () => {
  it('appends a submitted draft while retaining existing accounts and passwords', () => {
    const passwords = { [first]: 'demo-password' };
    const saved = submitEntries(first, passwords, second);
    expect(parseEntries(saved.text).map((entry) => entry.source)).toEqual([first, second]);
    expect(saved.passwords).toEqual(passwords);
  });

  it('rejects a partially invalid draft without changing saved data', () => {
    const saved = backup(first, { [first]: 'demo-password' });
    expect(() => submitEntries(saved.text, saved.passwords, `${second}\nnot-a-secret!`)).toThrow();
    expect(saved).toEqual(backup(first, { [first]: 'demo-password' }));
  });

  it('skips existing and repeated draft rows without losing account passwords', () => {
    const passwords = { [first]: 'demo-password' };
    const saved = submitEntries(first, passwords, `${first}\n${second}\n${second}`);
    expect(parseEntries(saved.text).map((entry) => entry.source)).toEqual([first, second]);
    expect(saved.passwords).toEqual(passwords);
  });

  it('refuses empty or comment-only submissions instead of replacing the saved list', () => {
    expect(() => submitEntries(first, {}, '')).toThrow();
    expect(() => submitEntries(first, {}, '# no accounts')).toThrow();
  });

  it('renames URI entries without changing their TOTP settings', () => {
    const source = `otpauth://totp/Old?secret=${secret}&algorithm=SHA512&digits=8&period=60`;
    const renamed = parseLine(nameEntry(source, '工作账号 <test>'));
    expect(renamed.kind).toBe('account');
    if (renamed.kind !== 'account') throw new Error('Expected account');
    expect(renamed.account.accountName).toBe('工作账号 <test>');
    expect(renamed.account.algorithm).toBe('SHA-512');
    expect(renamed.account.digits).toBe(8);
    expect(renamed.account.period).toBe(60);
  });

  it('removes the selected duplicate rather than its neighbour or password', () => {
    const text = `# personal list\n${first}\n\n${first}\n${second}`;
    const entries = parseEntries(text);
    const passwords = {
      [entries[0]!.key]: 'demo-first-password',
      [entries[1]!.key]: 'demo-second-password',
      [entries[2]!.key]: 'demo-email-password',
    };
    const changed = amendEntry(text, passwords, 0, null);
    const remaining = parseEntries(changed.text);
    expect(changed.text).toContain('# personal list');
    expect(remaining).toHaveLength(2);
    expect(changed.passwords[remaining[0]!.key]).toBe('demo-second-password');
    expect(changed.passwords[remaining[1]!.key]).toBe('demo-email-password');
  });

  it('preserves attached passwords when changing display names in the batch input', () => {
    const next = `Personal GitHub: ${secret}`;
    expect(reconcilePasswords(first, next, { [first]: 'demo-password' })).toEqual({
      [next]: 'demo-password',
    });
  });

  it('does not assign a removed account password to a different secret', () => {
    const other = encodeBase32(new TextEncoder().encode('different public test secret'));
    expect(reconcilePasswords(first, `GitHub: ${other}`, { [first]: 'demo-password' })).toEqual({});
  });

  it('allows clearing a password during an individual edit', () => {
    const changed = amendEntry(first, { [first]: 'demo-password' }, 0, first, '');
    expect(changed.passwords).toEqual({});
  });

  it('round trips names, raw inputs and passwords in a backup or encrypted vault payload', () => {
    const original = backup(`${first}\n${second}`, { [first]: 'demo-password' });
    expect(readBackup(JSON.stringify(original))).toEqual(original);
  });

  it('discards password metadata for accounts not present in the backup', () => {
    expect(
      readBackup(
        JSON.stringify({
          format: 'clockwork-local-v1',
          text: first,
          passwords: { [first]: 'demo-password', missing: 'should-not-survive' },
        }),
      ).passwords,
    ).toEqual({ [first]: 'demo-password' });
  });

  it('rejects unrelated JSON instead of overwriting browser history', () => {
    expect(() => readBackup('{"accounts": []}')).toThrow();
    expect(() => readBackup('{"format":"clockwork-local-v1","text":42}')).toThrow();
  });

  it('rejects multi-line edits so another account cannot be changed accidentally', () => {
    expect(() => amendEntry(first, {}, 0, `${first}\n${second}`)).toThrow();
    expect(() => amendEntry(first, {}, 5, null)).toThrow();
  });
});
