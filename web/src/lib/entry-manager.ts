import { parseEntries, parseLine, type ParsedEntry } from './accounts';
import { encodeBase32 } from './base32';

export const LOCAL_ENTRIES_KEY = 'mfa-totp-manager.clockwork.local.v1';
export type Passwords = Record<string, string>;
export interface EntryBackup {
  format: 'clockwork-local-v1';
  text: string;
  passwords: Passwords;
}

export function backup(text: string, passwords: Passwords): EntryBackup {
  const allowed: Passwords = {};
  for (const entry of parseEntries(text)) {
    if (passwords[entry.key]) allowed[entry.key] = passwords[entry.key]!;
  }
  return { format: 'clockwork-local-v1', text, passwords: allowed };
}

export function readBackup(raw: string): EntryBackup {
  const value: unknown = JSON.parse(raw);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('format' in value) ||
    value.format !== 'clockwork-local-v1' ||
    !('text' in value) ||
    typeof value.text !== 'string'
  )
    throw new Error('Invalid Clockwork backup');
  const passwords: Passwords = {};
  if ('passwords' in value && typeof value.passwords === 'object' && value.passwords !== null) {
    for (const [key, password] of Object.entries(value.passwords)) {
      if (typeof password === 'string') passwords[key] = password;
    }
  }
  return backup(value.text, passwords);
}

function identity(entry: ParsedEntry): string {
  if (entry.kind === 'error') return entry.source;
  const account = entry.account;
  return [
    encodeBase32(account.secret, { padding: false }),
    account.algorithm,
    account.digits,
    account.period,
  ].join(':');
}

/** Preserve attached passwords when users rename a line in the batch editor. */
export function reconcilePasswords(
  previous: string,
  next: string,
  passwords: Passwords,
): Passwords {
  const old = parseEntries(previous);
  const used = new Set<number>();
  const result: Passwords = {};
  for (const entry of parseEntries(next)) {
    let index = old.findIndex((candidate, i) => !used.has(i) && candidate.key === entry.key);
    if (index < 0) {
      index = old.findIndex(
        (candidate, i) => !used.has(i) && identity(candidate) === identity(entry),
      );
    }
    if (index >= 0) {
      used.add(index);
      const password = passwords[old[index]!.key];
      if (password) result[entry.key] = password;
    }
  }
  return result;
}

/** Address the visible record, preserving comments and duplicate-line passwords. */
export function amendEntry(
  text: string,
  passwords: Passwords,
  ordinal: number,
  replacement: string | null,
  password = '',
): EntryBackup {
  const entries = parseEntries(text);
  if (!entries[ordinal]) throw new Error('Entry no longer exists');
  const lines = text.split(/\r?\n/);
  const lineIndices = lines.flatMap((line, i) => {
    const value = line.trim();
    return value && !value.startsWith('#') ? [i] : [];
  });
  const orderedPasswords = entries.map((entry) => passwords[entry.key] ?? '');
  const line = lineIndices[ordinal]!;
  if (replacement === null) {
    lines.splice(line, 1);
    orderedPasswords.splice(ordinal, 1);
  } else {
    if (/[\r\n]/.test(replacement)) throw new Error('Use batch input for multiple entries');
    lines[line] = replacement;
    orderedPasswords[ordinal] = password;
  }
  const next = lines.join('\n');
  const result: Passwords = {};
  parseEntries(next).forEach((entry, i) => {
    if (orderedPasswords[i]) result[entry.key] = orderedPasswords[i]!;
  });
  return backup(next, result);
}

export function nameEntry(source: string, name: string): string {
  const entry = parseLine(source.trim());
  if (entry.kind === 'error') throw new Error(entry.message);
  const account = entry.account;
  const label = name.trim() || account.issuer || account.accountName || 'Account';
  const uri = new URL(`otpauth://totp/${encodeURIComponent(label)}`);
  uri.searchParams.set('secret', encodeBase32(account.secret, { padding: false }));
  uri.searchParams.set('algorithm', account.algorithm.replaceAll('-', ''));
  uri.searchParams.set('digits', String(account.digits));
  uri.searchParams.set('period', String(account.period));
  return uri.href;
}
