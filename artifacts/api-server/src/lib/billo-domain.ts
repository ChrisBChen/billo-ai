import type { BillChange, BillItem, BillView, ReceiptDraft, Participant } from "@workspace/api-zod";

export class BillError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type Member = { id: string; name: string; finished: boolean; paid: boolean };
export type BillState = {
  id: string; title: string; payerId: string; status: "open" | "closed";
  revision: number; splitMode: "equal" | "itemized"; receipt: ReceiptDraft;
  participants: Member[]; venmo: string; zelle: string;
  scans: number[]; finalParticipants?: Participant[]; receiptRevision?: number; receiptConfirmed?: boolean; selectionVersion?: number; shareCode?: string;
};
export function requireThat(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new BillError(status, message);
}
// Stable largest-remainder allocation; final cents never disappear.
export function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const magnitude = Math.abs(total);
  const exact = weights.map(w => magnitude * w / sum);
  const result = exact.map(Math.floor);
  const order = exact.map((v, i) => ({ i, r: v - result[i]! })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let n = magnitude - result.reduce((a, b) => a + b, 0), i = 0; i < n; i++) result[order[i % order.length]!.i]!++;
  return result.map(n => total < 0 ? -n : n);
}
export function receiptTotals(r: ReceiptDraft) {
  const subtotal = r.items.reduce((s, i) => s + i.cents, 0);
  const tip = r.tipMode === "percent" ? Math.round(subtotal * r.tipValue / 10000) : r.tipValue;
  return { subtotal, tip, total: subtotal + r.taxCents + tip + r.adjustmentCents };
}
export function validateReceipt(r: ReceiptDraft) {
  requireThat(r.items.length > 0, "Add at least one receipt item.");
  requireThat(new Set(r.items.map(i => i.id)).size === r.items.length, "Each receipt item needs a unique ID.");
  requireThat(r.items.every(i => i.name.trim() && i.id.length > 0 && i.id.length < 80), "Enter an item name.");
  requireThat(r.tipMode !== "percent" || r.tipValue <= 10000, "Tip percentage must be between 0 and 100.");
  const totals = receiptTotals(r);
  requireThat(totals.total >= 0 && totals.total === r.totalCents, "Items, tax, tip and adjustments must match the bill total.");
  requireThat(totals.subtotal > 0 || totals.total === 0, "A nonzero bill needs priced items.");
}
export function setupReady(s: BillState) {
  // Previously saved receipts predate the explicit flag and were already reviewed.
  return s.receiptConfirmed !== false && s.splitMode === "itemized" && s.receipt.items.length > 0 && s.receipt.items.every(i => i.mode === "equal");
}
function allocationTarget(item: BillItem) {
  return item.mode === "amount" ? item.cents : item.mode === "percent" ? 10000 : item.units;
}
export function calculate(s: BillState): Participant[] {
  const n = s.participants.length;
  const totals = receiptTotals(s.receipt);
  if (s.splitMode === "equal") {
    // Split the final total first so tax/tip rounding cannot make equal shares
    // differ by more than one cent. Then fit each breakdown into those shares.
    const equal = s.participants.map(() => 1);
    const shares = distribute(totals.total, equal);
    const discounts = distribute(Math.max(0, -s.receipt.adjustmentCents), equal);
    let capacity = shares.map((v, i) => v + discounts[i]!);
    const parts = [totals.subtotal, s.receipt.taxCents, totals.tip, Math.max(0, s.receipt.adjustmentCents)].map(total => {
      const part = distribute(total, capacity);
      capacity = capacity.map((v, i) => v - part[i]!);
      return part;
    });
    return s.participants.map((p, i) => ({
      ...p, isPayer: p.id === s.payerId, totalCents: shares[i]!,
      itemCents: parts[0]![i]!, taxCents: parts[1]![i]!, tipCents: parts[2]![i]!,
      adjustmentCents: parts[3]![i]! - discounts[i]!,
    }));
  }
  let items = new Array<number>(n).fill(0);
  for (const item of s.receipt.items) {
    const weights = s.participants.map(p => item.allocations.find(a => a.participantId === p.id)?.value ?? 0);
    const amounts = item.mode === "amount" ? weights : distribute(item.cents,
      item.mode === "percent" || item.mode === "units" ? [...weights, Math.max(0, allocationTarget(item) - weights.reduce((a, b) => a + b, 0))] : weights).slice(0, n);
    amounts.forEach((amount, i) => { items[i]! += amount; });
  }
  // Include unclaimed subtotal in proportional calculations to avoid shifting
  // its tax/tip onto people before anybody claims it.
  const unclaimed = Math.max(0, totals.subtotal - items.reduce((a, b) => a + b, 0));
  const weights = [...items, unclaimed];
  const tax = distribute(s.receipt.taxCents, weights);
  const tip = distribute(totals.tip, weights);
  const adjustment = distribute(s.receipt.adjustmentCents, weights);
  return s.participants.map((p, i) => ({
    ...p, isPayer: p.id === s.payerId,
    itemCents: items[i]!, taxCents: tax[i]!, tipCents: tip[i]!, adjustmentCents: adjustment[i]!,
    totalCents: items[i]! + tax[i]! + tip[i]! + adjustment[i]!,
  }));
}
export function unclaimedItems(s: BillState) {
  return s.splitMode === "equal" ? [] : s.receipt.items.filter(i => i.mode !== "equal"
    ? i.allocations.reduce((sum, a) => sum + a.value, 0) < allocationTarget(i)
    : !i.allocations.some(a => a.value > 0));
}
export function view(s: BillState, meId: string): BillView {
  const participants = (s.finalParticipants ?? calculate(s)).map(p => ({ ...p, paid: s.participants.find(m => m.id === p.id)!.paid }));
  const mine = participants.find(p => p.id === meId)!;
  const paymentNote = `Billo: ${s.title}`.slice(0, 140);
  const canPay = s.status === "closed" && meId !== s.payerId && mine.totalCents > 0 && !!s.venmo;
  const params = new URLSearchParams({ txn: "pay", recipients: s.venmo, amount: (mine.totalCents / 100).toFixed(2), note: paymentNote });
  return {
    id: s.id, shareCode: s.shareCode, title: s.title, payerId: s.payerId, meId, status: s.status,
    revision: s.revision, splitMode: s.splitMode, receipt: s.receipt, receiptConfirmed: s.status === "closed" || setupReady(s), participants,
    unclaimedItemIds: unclaimedItems(s).map(i => i.id), venmo: s.venmo, zelle: s.zelle, paymentNote,
    venmoUrl: canPay ? `venmo://paycharge?${params}` : "",
    venmoWebUrl: canPay ? `https://venmo.com/${encodeURIComponent(s.venmo)}?${new URLSearchParams({ txn: "pay", amount: (mine.totalCents / 100).toFixed(2), note: paymentNote })}` : "",
    outstandingCents: participants.filter(p => !p.isPayer && !p.paid).reduce((sum, p) => sum + p.totalCents, 0),
  };
}
export function invalidate(s: BillState) { s.participants.forEach(p => { p.finished = false; }); }
// Lazy, persisted upgrade under the store's row lock. Never rewrite closed bills.
export function upgradeSelections(s: BillState) {
  if (s.status === "closed" || s.selectionVersion === 1) return;
  s.receipt.items = s.receipt.items.map(item => ({
    ...item, mode: "equal", units: 1,
    allocations: s.participants.filter(p => s.splitMode === "equal" || item.allocations.some(a => a.participantId === p.id && a.value > 0))
      .map(p => ({ participantId: p.id, value: 1 })),
  }));
  s.splitMode = "itemized";
  s.selectionVersion = 1;
  invalidate(s);
  s.revision++;
  s.receiptRevision = s.revision;
}
export function change(s: BillState, meId: string, input: BillChange) {
  // mutate() holds a database row lock: independent own-share writes are queued
  // and validated against current capacity, not rejected for unrelated revisions.
  if (input.action === "receipt") requireThat(input.revision >= (s.receiptRevision ?? 0),
    "The receipt was edited in another session. Review it before replacing it.", 409);
  const me = s.participants.find(p => p.id === meId)!;
  const host = () => requireThat(meId === s.payerId, "Only the payer can do this.", 403);
  if (input.action === "payment") {
    requireThat(s.status === "closed" && meId !== s.payerId, "Only a participant on a closed bill can report payment.");
    requireThat(typeof input.paid === "boolean", "Choose a payment status.");
    me.paid = input.paid!;
  } else {
    requireThat(s.status === "open", "This bill is closed. Amounts are locked.", 409);
    switch (input.action) {
      case "receipt": {
        host(); requireThat(input.receipt, "Receipt is required.");
        const receipt = input.receipt!;
        validateReceipt(receipt);
        requireThat(receipt.items.every(i => i.mode === "equal"), "Items now split equally among the people who select them. Refresh to use the new receipt editor.");
        const previousItems = new Map(s.receipt.items.map(i => [i.id, i]));
        s.receipt = { ...receipt, title: receipt.title.trim(), items: receipt.items.map(i => {
          const previous = previousItems.get(i.id);
          const unchanged = previous && previous.cents === i.cents;
          return { ...i, mode: "equal", units: 1, name: i.name.trim(), allocations: unchanged ? previous.allocations : [] };
        }), warnings: [] };
        s.receiptRevision = s.revision + 1;
        s.receiptConfirmed = true;
        s.splitMode = "itemized";
        s.title = s.receipt.title; invalidate(s); break;
      }
      case "claim": {
        const item = s.receipt.items.find(i => i.id === input.itemId);
        requireThat(item && typeof input.claimed === "boolean", "Choose an item and whether you ate it.");
        requireThat(setupReady(s), "The payer must confirm the receipt and tip first.", 409);
        requireThat(input.allocations === undefined && input.itemMode === undefined && input.units === undefined, "You can only select or deselect items for yourself.", 403);
        const had = item.allocations.some(a => a.participantId === meId);
        if (had !== input.claimed) {
          item.allocations = item.allocations.filter(a => a.participantId !== meId);
          if (input.claimed) item.allocations.push({ participantId: meId, value: 1 });
          invalidate(s);
        }
        break;
      }
      case "mode":
      case "allocate":
        throw new BillError(400, "Items now split equally among the people who select them. Refresh and tap your items.");
      case "finish":
        requireThat(setupReady(s), "The payer must confirm the receipt and tip first.", 409);
        requireThat(typeof input.finished === "boolean", "Choose a confirmation status.");
        requireThat(s.receipt.items.length, "The payer has not added the receipt yet.");
        me.finished = input.finished!; break;
      case "reopen":
        host(); invalidate(s); break;
      case "close": {
        host(); requireThat(setupReady(s), "Confirm the receipt and tip before closing.", 409); validateReceipt(s.receipt);
        // The payer's Close action itself confirms their current share.
        requireThat(input.force || s.participants.filter(p => p.id !== s.payerId).every(p => p.finished), "Some participants are still selecting. Use Force finish to close early.");
        const remaining = unclaimedItems(s);
        requireThat(!remaining.length || input.takeRemaining, "Resolve unclaimed items, or explicitly take remaining items.");
        remaining.forEach(i => {
          if (i.mode !== "equal") {
            const rest = allocationTarget(i) - i.allocations.reduce((sum, a) => sum + a.value, 0);
            const payer = i.allocations.find(a => a.participantId === s.payerId);
            if (payer) payer.value += rest;
            else i.allocations.push({ participantId: s.payerId, value: rest });
          } else {
            i.mode = "equal"; i.allocations = [{ participantId: s.payerId, value: 1 }];
          }
        });
        const amounts = calculate(s);
        requireThat(amounts.every(p => p.totalCents >= 0), "Adjustments would make a participant's share negative. Correct the receipt.");
        requireThat(amounts.reduce((t, p) => t + p.totalCents, 0) === s.receipt.totalCents, "Shares do not reconcile with the bill total.");
        s.finalParticipants = amounts.map(p => ({ ...p, finished: true })); s.status = "closed";
        s.participants.forEach(p => { p.finished = true; }); break;
      }
    }
  }
  s.revision++;
}
