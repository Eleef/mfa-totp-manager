import { onLocaleChange } from '../i18n/runtime';
import { word, type Label } from '../i18n/manager';
import { translateLibMessage } from '../i18n/lib-text';
import { parseEntries, type ParsedEntry } from '../lib/accounts';
import { encodeBase32 } from '../lib/base32';
import {
  LOCAL_ENTRIES_KEY,
  amendEntry,
  backup,
  nameEntry,
  readBackup,
  reconcilePasswords,
  type Passwords,
  type EntryBackup,
} from '../lib/entry-manager';
import { copyText, requireElement } from './dom';
import './entry-manager.css';

type VaultState = 'off' | 'locked' | 'open';
interface Handlers {
  read(): string;
  write(text: string): void;
  vaultState(): VaultState;
}
export function startEntryManager(handlers: Handlers) {
  const input = requireElement<HTMLTextAreaElement>(document, '#secrets');
  const host = requireElement(document, '#strips');
  const zone = requireElement(document, '#zone-input');
  const clear = requireElement<HTMLButtonElement>(document, '#key-clear');
  const state = requireElement(document, '#state-text');
  const footer = requireElement(document, '.colophon__note');
  footer.removeAttribute('data-i18n');
  let knownText = '';
  let passwords: Passwords = {};
  let storageProblem: 'blocked' | 'corrupt' | null = null;
  let undoData: EntryBackup | null = null;
  let undoTimer = 0;
  let previousState = handlers.vaultState();
  const toolbar = document.createElement('div');
  toolbar.className = 'manager-toolbar';
  toolbar.id = 'manager-toolbar';
  const help = document.createElement('p');
  help.className = 'manager-help';
  help.id = 'manager-storage-help';
  const toast = document.createElement('div');
  toast.className = 'manager-notice';
  toast.setAttribute('role', 'status');
  toast.hidden = true;
  const toastText = document.createElement('span');
  const undoButton = button('undo', () => undo());
  undoButton.id = 'manager-undo';
  toast.append(toastText, undoButton);
  zone.insertBefore(toolbar, zone.children[1] ?? null);
  toolbar.after(help);
  zone.append(toast);

  const dialog = document.createElement('dialog');
  dialog.className = 'manager-dialog';
  dialog.id = 'manager-dialog';
  document.body.append(dialog);
  dialog.addEventListener('close', () => {
    // Remove sensitive field values from the DOM after every close.
    dialog.replaceChildren();
  });
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.json,.txt';
  file.hidden = true;
  document.body.append(file);
  let toastTimer = 0;
  function notify(text: string, canUndo = false): void {
    window.clearTimeout(toastTimer);
    toast.hidden = false;
    toastText.textContent = text;
    undoButton.hidden = !canUndo;
    if (!canUndo)
      toastTimer = window.setTimeout(() => {
        toast.hidden = true;
      }, 8_000);
  }
  function button(label: Label, action: () => void, danger = false): HTMLButtonElement {
    const node = document.createElement('button');
    node.type = 'button';
    node.classList.add('key', danger ? 'key--danger' : 'key--default');
    node.textContent = word(label);
    node.addEventListener('click', action);
    return node;
  }
  function showDialog(title: string, message: string, confirm: Label, action: () => void): void {
    dialog.replaceChildren();
    const heading = document.createElement('h2');
    heading.id = 'manager-dialog-title';
    heading.textContent = title;
    dialog.setAttribute('aria-labelledby', heading.id);
    const body = document.createElement('p');
    body.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'manager-dialog-actions';
    actions.append(
      button('cancel', () => dialog.close()),
      button(
        confirm,
        () => {
          dialog.close();
          action();
        },
        confirm === 'confirm',
      ),
    );
    dialog.append(heading, body, actions);
    dialog.showModal();
  }
  function snapshot(): void {
    undoData = backup(handlers.read(), passwords);
    window.clearTimeout(undoTimer);
    undoTimer = window.setTimeout(() => {
      undoData = null;
      toast.hidden = true;
    }, 15_000);
  }
  function apply(data: EntryBackup): void {
    knownText = data.text;
    passwords = data.passwords;
    handlers.write(data.text);
  }
  function undo(): void {
    if (!undoData || handlers.vaultState() === 'locked') return;
    const data = undoData;
    undoData = null;
    window.clearTimeout(undoTimer);
    apply(data);
    toast.hidden = true;
  }
  function persist(): void {
    if (handlers.vaultState() !== 'off') {
      try {
        localStorage.removeItem(LOCAL_ENTRIES_KEY);
      } catch {
        storageProblem = 'blocked';
      }
      return;
    }
    if (storageProblem === 'corrupt') return;
    try {
      localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(backup(handlers.read(), passwords)));
      storageProblem = null;
    } catch {
      storageProblem = 'blocked';
    }
  }
  function paint(): void {
    const vaultState = handlers.vaultState();
    toolbar.replaceChildren();
    const add = button('add', () => edit());
    add.id = 'manager-add';
    const importButton = button('import', () => file.click());
    importButton.id = 'manager-import';
    const exportButton = button('export', () => {
      if (storageProblem === 'corrupt') {
        download(localStorage.getItem(LOCAL_ENTRIES_KEY) ?? '', 'clockwork-recovery.json');
        return;
      }
      showDialog(word('exportTitle'), word('exportHelp'), 'exportConfirm', () => {
        download(
          JSON.stringify(backup(handlers.read(), passwords), null, 2),
          'clockwork-backup.json',
        );
        notify(word('exported'));
      });
    });
    exportButton.id = 'manager-export';
    add.disabled = vaultState === 'locked';
    importButton.disabled = vaultState === 'locked';
    exportButton.disabled = vaultState === 'locked';
    toolbar.append(add, importButton, exportButton);
    clear.removeAttribute('data-i18n');
    clear.textContent = word('clear');
    state.textContent = storageProblem
      ? word(storageProblem)
      : word(vaultState === 'off' ? 'plain' : vaultState === 'open' ? 'encrypted' : 'locked');
    help.textContent = storageProblem ? word(storageProblem) : word('unsaved');
    help.classList.toggle('manager-help--error', storageProblem !== null);
    footer.textContent = word('footer');
    const intro = document.querySelector('#vault-explain');
    if (intro) intro.textContent = word('plainHelp');
    const vaultStateText = document.querySelector('#vault-state-text');
    if (vaultState === 'off' && vaultStateText) vaultStateText.textContent = word('vaultOff');
    const entries = parseEntries(handlers.read());
    [...host.children].forEach((element, index) => {
      element.querySelector('.manager-entry-actions')?.remove();
      const entry = entries[index];
      if (!entry) return;
      const actions = document.createElement('div');
      actions.className = 'manager-entry-actions';
      const editButton = button('edit', () => edit(index));
      editButton.setAttribute('aria-label', `${word('edit')} ${entryLabel(entry, index)}`);
      actions.append(editButton);
      if (entry.kind === 'account') {
        actions.append(
          button('secret', () =>
            reveal(word('secret'), encodeBase32(entry.account.secret, { padding: false })),
          ),
        );
      }
      if (passwords[entry.key]) {
        actions.append(button('password', () => reveal(word('password'), passwords[entry.key]!)));
      }
      const remove = button(
        'remove',
        () => {
          showDialog(
            word('deleteTitle'),
            `${entryLabel(entry, index)}. ${word('deleteHelp')}`,
            'confirm',
            () => {
              snapshot();
              apply(amendEntry(handlers.read(), passwords, index, null));
              notify(word('removed'), true);
            },
          );
        },
        true,
      );
      remove.setAttribute('aria-label', `${word('remove')} ${entryLabel(entry, index)}`);
      actions.append(remove);
      element.append(actions);
    });
  }
  function entryLabel(entry: ParsedEntry, index: number): string {
    return entry.kind === 'account'
      ? (entry.account.issuer ?? entry.account.accountName ?? `#${index + 1}`)
      : `#${index + 1}`;
  }
  function field(label: Label, value: string, type = 'text') {
    const wrap = document.createElement('label');
    wrap.className = 'manager-field';
    const caption = document.createElement('span');
    caption.textContent = word(label);
    const control = document.createElement('input');
    control.type = type;
    control.value = value;
    control.autocomplete = 'off';
    control.spellcheck = false;
    wrap.append(caption, control);
    return { wrap, control };
  }
  function edit(index?: number): void {
    const entries = parseEntries(handlers.read());
    const existing = index === undefined ? undefined : entries[index];
    const original = handlers.read();
    dialog.replaceChildren();
    const form = document.createElement('form');
    const title = document.createElement('h2');
    title.id = 'manager-dialog-title';
    title.textContent = word(existing ? 'edit' : 'add');
    dialog.setAttribute('aria-labelledby', title.id);
    const name = field('name', existing ? entryLabel(existing, index!) : '');
    name.control.id = 'manager-name';
    const source = field('source', existing?.source ?? '');
    source.control.id = 'manager-source';
    source.control.required = true;
    const password = field(
      'optionalPassword',
      existing ? (passwords[existing.key] ?? '') : '',
      'password',
    );
    password.control.id = 'manager-password';
    const show = button('show', () => {
      password.control.type = password.control.type === 'password' ? 'text' : 'password';
    });
    const error = document.createElement('p');
    error.className = 'manager-error';
    error.setAttribute('role', 'alert');
    const actions = document.createElement('div');
    actions.className = 'manager-dialog-actions';
    const save = document.createElement('button');
    save.type = 'submit';
    save.classList.add('key', 'key--primary');
    save.id = 'manager-save';
    save.textContent = word('save');
    actions.append(
      button('cancel', () => dialog.close()),
      save,
    );
    form.append(title, name.wrap, source.wrap, password.wrap, show, error, actions);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (handlers.read() !== original) {
        error.textContent = word('changedWhileEditing');
        return;
      }
      try {
        const line = nameEntry(source.control.value, name.control.value);
        const value = password.control.value;
        if (index === undefined) {
          const next = [handlers.read().trimEnd(), line].filter(Boolean).join('\n');
          const nextPasswords = { ...passwords };
          const added = parseEntries(next).at(-1)!;
          if (value) nextPasswords[added.key] = value;
          apply(backup(next, nextPasswords));
        } else {
          apply(amendEntry(handlers.read(), passwords, index, line, value));
        }
        dialog.close();
        notify(word('changed'));
      } catch (problem) {
        error.textContent =
          problem instanceof Error ? translateLibMessage(problem.message) : word('empty');
      }
    });
    dialog.append(form);
    dialog.showModal();
    name.control.focus();
  }
  function reveal(title: string, value: string): void {
    dialog.replaceChildren();
    const heading = document.createElement('h2');
    heading.id = 'manager-dialog-title';
    heading.textContent = title;
    dialog.setAttribute('aria-labelledby', heading.id);
    const content = document.createElement('input');
    content.type = 'password';
    content.value = value;
    content.readOnly = true;
    content.className = 'manager-secret';
    content.setAttribute('aria-label', title);
    dialog.append(
      heading,
      content,
      button('show', () => {
        content.type = content.type === 'password' ? 'text' : 'password';
      }),
      button('copy', () => {
        void copyText(value).then(() => notify(word('copied')));
      }),
      button('close', () => dialog.close()),
    );
    dialog.showModal();
  }
  function download(text: string, name: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
  file.addEventListener('change', () => {
    const selected = file.files?.[0];
    if (!selected) return;
    void selected
      .text()
      .then((raw) => {
        let imported: EntryBackup;
        try {
          imported = selected.name.endsWith('.json') ? readBackup(raw) : backup(raw, {});
          if (parseEntries(imported.text).some((entry) => entry.kind === 'error'))
            throw new Error('Invalid');
        } catch {
          notify(word('invalidImport'));
          return;
        }
        showDialog(word('restoreTitle'), word('restoreHelp'), 'importConfirm', () => {
          snapshot();
          let text = handlers.read();
          const merged = { ...passwords };
          for (const entry of parseEntries(imported.text)) {
            if (parseEntries(text).some((existing) => existing.source === entry.source)) continue;
            text = [text.trimEnd(), entry.source].filter(Boolean).join('\n');
            const added = parseEntries(text).at(-1)!;
            const value = imported.passwords[entry.key];
            if (value) merged[added.key] = value;
          }
          apply(backup(text, merged));
          notify(word('changed'));
        });
      })
      .finally(() => {
        file.value = '';
      });
  });
  function sync(): void {
    const text = handlers.read();
    if (text !== knownText) {
      passwords = reconcilePasswords(knownText, text, passwords);
      knownText = text;
    }
    persist();
    paint();
  }
  function vaultChanged(): void {
    const nextState = handlers.vaultState();
    if (nextState === 'locked') {
      undoData = null;
      passwords = {};
      dialog.close();
      toast.hidden = true;
    }
    if (nextState !== previousState) {
      previousState = nextState;
      persist();
    }
    paint();
  }
  onLocaleChange(() => paint());
  // Synchronous typing persistence also covers immediate tab close before reparse's debounce.
  input.addEventListener('input', sync);
  input.addEventListener('paste', () => {
    window.setTimeout(sync, 0);
  });
  window.addEventListener('pagehide', persist);
  if (handlers.vaultState() === 'off') {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LOCAL_ENTRIES_KEY);
    } catch {
      storageProblem = 'blocked';
    }
    if (saved !== null) {
      try {
        apply(readBackup(saved));
      } catch {
        storageProblem = 'corrupt';
      }
    }
  } else {
    try {
      localStorage.removeItem(LOCAL_ENTRIES_KEY);
    } catch {
      storageProblem = 'blocked';
    }
  }
  paint();
  return {
    sync,
    vaultChanged,
    requestClear(): void {
      showDialog(word('clearTitle'), word('clearHelp'), 'confirm', () => {
        snapshot();
        apply(backup('', {}));
        notify(word('removed'), true);
      });
    },
    serializeForVault(): string {
      return handlers.read().trim() ? JSON.stringify(backup(handlers.read(), passwords)) : '';
    },
    restoreVault(raw: string): void {
      try {
        apply(readBackup(raw));
      } catch {
        apply(backup(raw, {}));
      } // Support original Clockwork text-only vaults.
    },
  };
}
