import type { AuditLog } from '../types';
import { actionLabel, auditActor, entityLabel } from './audit';
import { formatIst } from './time';

/**
 * One RFC 4180 field: always quoted, inner quotes doubled; objects become JSON. A leading = + @ tab or CR
 * or - gets a ' so a spreadsheet does not run it as a formula; plain numbers such as -12 are left alone.
 */
export function csvField(value: unknown): string {
  let s = value === null || value === undefined ? '' : typeof value === 'string' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return `${[header, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n')}\r\n`;
}

export function auditCsv(logs: AuditLog[]): string {
  return toCsv(
    ['Time (IST)', 'Time (UTC)', 'Admin', 'Admin email', 'Action', 'Entity type', 'Entity ID', 'Before', 'After'],
    logs.map((l) => [
      formatIst(l.timestamp), l.timestamp, auditActor(l), l.users?.email ?? '', actionLabel(l.action), entityLabel(l.entity_type),
      l.entity_id, l.old_value ?? '', l.new_value ?? '',
    ]),
  );
}

/** Hands `text` to the browser as a download. The BOM makes Excel read it as UTF-8. */
export function downloadCsv(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob(['\ufeff', text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
