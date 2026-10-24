import type { BillItem, BillView, Participant, ReceiptDraft } from '@workspace/api-client-react';

export const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

/** Parses a dollar string into integer cents. Returns null when invalid. */
export function parseCents(text: string, allowNegative = false): number | null {
  const t = text.trim();
  const re = allowNegative ? /^-?\d*(\.\d{0,2})?$/ : /^\d*(\.\d{0,2})?$/;
  if (!t || t === '-' || t === '.' || !re.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
export const centsText = (cents: number) => (cents / 100).toFixed(2);

export function distribute(total: number, weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const exact = weights.map(w => total * w / sum);
  const result = exact.map(Math.floor);
  const order = exact.map((v, i) => ({ i, f: v - result[i] })).sort((a, b) => b.f - a.f || a.i - b.i);
  const rem = total - result.reduce((a, b) => a + b, 0);
  for (let n = 0; n < rem; n++) result[order[n % order.length].i]++;
  return result;
}

export const subtotalOf = (items: { cents: number }[]) => items.reduce((s, i) => s + i.cents, 0);
export const tipCentsOf = (subtotal: number, mode: 'amount' | 'percent', value: number) => mode === 'percent' ? Math.round(subtotal * value / 10000) : value;
export function computedTotal(r: ReceiptDraft) {
  const sub = subtotalOf(r.items);
  return sub + r.taxCents + tipCentsOf(sub, r.tipMode, r.tipValue) + r.adjustmentCents;
}

/** Per-participant cents for one item, keyed by participant id. */
export function itemShares(item: BillItem, participantIds?: string[]): Record<string, number> {
  const allocs = item.allocations.filter(a => a.value > 0);
  if (participantIds) allocs.sort((a, b) => participantIds.indexOf(a.participantId) - participantIds.indexOf(b.participantId));
  const out: Record<string, number> = {};
  if (!allocs.length) return out;
  const amounts = item.mode === 'amount' ? allocs.map(a => a.value)
    : item.mode === 'equal' ? distribute(item.cents, allocs.map(() => 1))
    : item.mode === 'percent' ? distribute(item.cents, [...allocs.map(a => a.value), Math.max(0, 10000 - allocs.reduce((sum, a) => sum + a.value, 0))])
    : distribute(item.cents, [...allocs.map(a => a.value), Math.max(0, item.units - allocs.reduce((sum, a) => sum + a.value, 0))]);
  allocs.forEach((a, i) => { out[a.participantId] = amounts[i]; });
  return out;
}
export const isClaimedBy = (item: BillItem, pid: string) => item.allocations.some(a => a.participantId === pid && a.value > 0);

export const initial = (name: string) => (name.trim().slice(0, 1) || '?').toUpperCase();
export const avatarIndex = (bill: BillView, pid: string) => Math.max(0, bill.participants.findIndex(p => p.id === pid)) % 4;
export const findPerson = (bill: BillView, pid: string): Participant | undefined => bill.participants.find(p => p.id === pid);

export function errorStatus(e: unknown): number | undefined {
  return typeof e === 'object' && e && 'status' in e && typeof (e as { status: unknown }).status === 'number' ? (e as { status: number }).status : undefined;
}
export function errorMessage(e: unknown, fallback = 'Something went wrong. Try again.') {
  if (typeof e === 'object' && e && 'data' in e) {
    const d = (e as { data: unknown }).data;
    if (d && typeof d === 'object') {
      const m = (d as Record<string, unknown>).error ?? (d as Record<string, unknown>).message;
      if (typeof m === 'string' && m) return m;
    }
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You appear to be offline. Reconnect and try again.';
  return fallback;
}
export const billUrl = (id: string, shareCode?: string) => window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '') + (shareCode ? '/s/' + shareCode : '/b/' + id);
export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2));

export const billReady = (bill: BillView) => bill.receiptConfirmed && bill.splitMode === 'itemized' && bill.receipt.items.length > 0 && bill.receipt.items.every(i => i.mode === 'equal');
