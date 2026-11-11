import { getLocale } from './runtime';

const strings = {
  add: ['添加账号', 'Add account'],
  import: ['导入备份', 'Import backup'],
  export: ['导出备份', 'Export backup'],
  edit: ['编辑', 'Edit'],
  secret: ['查看密钥', 'View secret'],
  password: ['账号密码', 'Account password'],
  remove: ['删除', 'Delete'],
  clear: ['清空全部', 'Clear all'],
  cancel: ['取消', 'Cancel'],
  save: ['保存', 'Save'],
  confirm: ['确认删除', 'Confirm deletion'],
  name: ['显示名称', 'Display name'],
  source: ['密钥或 otpauth 链接', 'Secret or otpauth link'],
  optionalPassword: ['账号密码（可选）', 'Account password (optional)'],
  show: ['显示', 'Show'],
  copy: ['复制', 'Copy'],
  copied: ['已复制', 'Copied'],
  close: ['关闭', 'Close'],
  plain: ['免密 · 已自动保存在此浏览器', 'No password · saved in this browser'],
  locked: ['本地保险箱已锁定', 'Local vault locked'],
  encrypted: ['保险箱已解锁 · 修改后请点“重新保存”', 'Vault open · save changes in the vault'],
  plainHelp: [
    '免密模式会在当前浏览器保存密钥和账号密码。可在下方保险箱改用密码加密。',
    'No-password mode stores secrets and account passwords in this browser. Use the vault below to encrypt them.',
  ],
  vaultOff: ['保险箱未启用 · 当前免密保存', 'Vault disabled · using no-password storage'],
  footer: ['仅本地计算与保存 · 无数据上传', 'Local computation and storage · no uploads'],
  blocked: [
    '浏览器保存失败，请立即导出备份。当前条目仅在内存中。',
    'Browser storage failed. Export a backup now; current entries are only in memory.',
  ],
  corrupt: [
    '本地数据无法读取，未覆盖原数据。请先导出原始备份。',
    'Local data could not be read and has not been overwritten. Export a raw backup first.',
  ],
  deleteTitle: ['删除这个账号？', 'Delete this account?'],
  deleteHelp: [
    '将同时删除这条记录的密钥和账号密码。删除后可在 15 秒内撤销。',
    'This removes its secret and account password. You can undo within 15 seconds.',
  ],
  clearTitle: ['清空所有账号？', 'Clear all accounts?'],
  clearHelp: [
    '将清空当前输入和所有账号密码。确认后可在 15 秒内撤销。',
    'This clears the input and all account passwords. You can undo within 15 seconds.',
  ],
  undo: ['撤销', 'Undo'],
  removed: ['已删除，可撤销', 'Deleted. Undo is available.'],
  changed: ['账号已保存', 'Account saved'],
  changedWhileEditing: [
    '账号列表已变化，请关闭后重新编辑。',
    'The account list changed. Close and edit again.',
  ],
  empty: ['请填写一个有效密钥或链接。', 'Enter one valid secret or link.'],
  invalidImport: [
    '备份格式不正确，原账号未修改。',
    'Invalid backup; existing entries were not changed.',
  ],
  restoreTitle: ['导入备份并合并账号？', 'Import and merge accounts?'],
  restoreHelp: [
    '现有账号会保留，重复条目会跳过。',
    'Existing accounts are kept; duplicate entries are skipped.',
  ],
  importConfirm: ['合并导入', 'Merge import'],
  exported: [
    '备份包含密钥和账号密码，请妥善保存。',
    'The backup includes secrets and account passwords.',
  ],
  exportTitle: ['导出未加密备份？', 'Export an unencrypted backup?'],
  exportHelp: [
    'JSON 文件包含所有密钥和账号密码。',
    'The JSON file contains all secrets and account passwords.',
  ],
  exportConfirm: ['导出文件', 'Export file'],
  unsaved: [
    '输入框保持原来的直接粘贴方式，每行一个账号；新增与修改会自动保存。',
    'Paste directly below, one account per line. Additions and edits are saved automatically.',
  ],
} as const;
export type Label = keyof typeof strings;
export function word(key: Label): string {
  return strings[key][getLocale().startsWith('zh') ? 0 : 1];
}
