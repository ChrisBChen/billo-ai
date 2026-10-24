import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ScanReceiptResponse, type ReceiptDraft } from "@workspace/api-zod";
import { BillError } from "./billo-domain";

const cents = z.number().int().min(0).max(1000000000).nullable().optional();
const signedCents = z.number().int().min(-1000000000).max(1000000000).nullable().optional();
const extraction = z.object({
  restaurantName: z.string().max(1000).nullable().optional(),
  title: z.string().max(1000).nullable().optional(),
  currency: z.string().optional(),
  items: z.array(z.object({
    name: z.string().trim().min(1).max(120), cents: signedCents,
    units: z.number().int().min(1).max(10000).optional(),
  })).max(100),
  charges: z.array(z.object({
    label: z.string().trim().min(1).max(120), kind: z.string().optional(), cents: signedCents,
  })).max(100).optional(),
  taxCents: cents, tipCents: cents, adjustmentCents: signedCents,
  printedSubtotalCents: cents, totalCents: cents,
  warnings: z.array(z.string().max(500)).max(20).optional(),
});

type Kind = "gratuity" | "tip" | "fee" | "discount" | "tax" | "ignore" | "item";
type Charge = { label: string; cents: number; kind: Kind };
const dollars = (n: number) => `$${(n / 100).toFixed(2)}`;
function restaurantName(value: string | null | undefined): string {
  const name = (value ?? "").replace(/\s+/g, " ").trim();
  if (/^(?:restaurant(?: name| receipt)?|receipt|unknown(?: restaurant)?|not (?:readable|available)|unreadable|n\/a|none|null|guest check|merchant copy|customer copy|payment receipt|sales receipt|tax invoice)[.!]?$/i.test(name)) return "";
  return name.slice(0, 100);
}
function classify(label: string, kind?: string): Kind {
  const name = label.toLowerCase().replace(/[_-]/g, " ");
  if (/suggest|recommend|tip guide|gratuity guide/.test(name) || kind === "suggested_tip") return "ignore";
  if (/^(?:sub\s*total|grand\s*total|total(?:\s+due)?|balance\s+due|amount\s+(?:due|paid))\s*[:$0-9., ]*$/.test(name)) return "ignore";
  if (/\b(?:discount|coupon|promo)\b/.test(name) || kind === "discount") return "discount";
  // Label evidence takes precedence if a gratuity was misclassified as a fee.
  if (/\b(?:auto(?:matic)?\s*grat(?:uity|uities)?|gratuity|gratuities|grat|hospitality (?:charge|fee)|service included)\b/.test(name) ||
    (/\bservice (?:charge|fee)\b/.test(name) && !/\b(?:delivery|processing|card|convenience|packaging)\b/.test(name))) return "gratuity";
  // "Tri-tip steak" and "Tip Top IPA" are purchases, not gratuities.
  if (/^(?:(?:additional|extra|voluntary|handwritten|total)\s+)?tips?(?:\s+(?:amount|added|included|paid|total))?\s*[:$%0-9.,() -]*$/.test(name)) return "tip";
  if (/\b(?:tax|gst|hst|vat)\b/.test(name)) return "tax";
  if (kind === "gratuity" || kind === "tip") return kind;
  if (/\b(?:fee|charge|surcharge)\b/.test(name) || kind === "fee") return "fee";
  return "item";
}

/** Never use an unexplained printed-total difference as a tip or adjustment. */
export function normalizeReceiptExtraction(input: unknown, fallbackTitle = "Receipt"): ReceiptDraft {
  const result = extraction.safeParse(input);
  if (!result.success) throw new BillError(422, "The receipt could not be read reliably. Try a clearer photo or enter it manually.");
  const raw = result.data;
  const warnings: string[] = [];
  const detectedName = restaurantName(raw.restaurantName) || restaurantName(raw.title);
  const title = detectedName || fallbackTitle.trim().replace(/\s+/g, " ").slice(0, 100) || "Receipt";
  if (!detectedName) warnings.push("Restaurant name could not be read reliably. Review or edit the bill name before confirming.");
  if (raw.currency && raw.currency.toUpperCase() !== "USD") {
    return ScanReceiptResponse.parse({
      title, items: [], taxCents: 0, tipMode: "amount",
      tipValue: 0, adjustmentCents: 0, totalCents: 0, warnings: ["Only USD receipts are supported."],
    });
  }
  const charges: Charge[] = [];
  const items: ReceiptDraft["items"] = [];
  let unreadableItem = false, unreadableCharge = false;
  // Charges are the authoritative labelled ledger. Never sum their legacy
  // aggregate tip/adjustment fields a second time.
  for (const row of raw.charges ?? []) {
    const kind = classify(row.label, row.kind);
    if (kind === "ignore") continue;
    if (row.cents == null) { unreadableCharge = true; continue; }
    charges.push({ label: row.label, kind: kind === "item" ? "fee" : kind, cents: kind === "discount" ? -Math.abs(row.cents) : row.cents });
  }
  const ledger = [...charges];
  for (const row of raw.items) {
    const kind = classify(row.name);
    if (kind === "ignore") continue;
    if (kind !== "item" || (row.cents ?? 0) < 0) {
      if (row.cents == null) { unreadableCharge = true; continue; }
      const actualKind = (row.cents < 0 && kind === "item") ? "discount" : kind;
      const amount = actualKind === "discount" ? -Math.abs(row.cents) : row.cents;
      // OCR sometimes repeats the same auto-gratuity as both an item and a
      // labelled charge. Match the category and amount across those sources.
      if (!ledger.some(c => c.kind === actualKind && c.cents === amount &&
        (actualKind === "gratuity" || actualKind === "tip" || c.label.toLowerCase() === row.name.toLowerCase()))) {
        charges.push({ label: row.name, kind: actualKind, cents: amount });
      }
      continue;
    }
    if (row.cents == null) unreadableItem = true;
    items.push({ id: randomUUID(), name: row.name, cents: row.cents ?? 0, units: row.units ?? 1, mode: "equal", allocations: [] });
  }
  const tipSummary = (c: Charge) => /^(?:total|combined)\s+(?:gratuity|tips?)\b/i.test(c.label);
  const detailedTips = charges.filter(c => (c.kind === "gratuity" || c.kind === "tip") && !tipSummary(c));
  const detailedTipTotal = detailedTips.reduce((n, c) => n + c.cents, 0);
  const actualCharges = charges.filter(c => !((c.kind === "gratuity" || c.kind === "tip") &&
    tipSummary(c) && detailedTips.length > 0 && c.cents === detailedTipTotal));
  const sum = (kind: Kind) => actualCharges.filter(c => c.kind === kind).reduce((n, c) => n + c.cents, 0);
  const gratuity = sum("gratuity");
  const hasLabelledTip = actualCharges.some(c => c.kind === "gratuity" || c.kind === "tip");
  const tip = hasLabelledTip ? gratuity + sum("tip") : raw.tipCents ?? 0;
  const adjustment = sum("fee") + sum("discount");
  const tax = raw.taxCents ?? sum("tax");
  const subtotal = items.reduce((n, i) => n + i.cents, 0);
  const total = subtotal + tax + tip + adjustment;

  if (unreadableItem) warnings.push("An item price was unreadable and set to $0.00. Review the item prices.");
  if (unreadableCharge) warnings.push("A charge amount was unreadable and omitted. Review tax and gratuity.");
  if (actualCharges.length !== charges.length) warnings.push("A repeated combined gratuity total was counted only once.");
  if (raw.taxCents == null && !charges.some(c => c.kind === "tax")) warnings.push("Tax was not readable; set to $0.00. Enter it if needed.");
  if (gratuity > 0) warnings.push(`Detected gratuity of ${dollars(gratuity)} is included in the tip/gratuity total of ${dollars(tip)}.`);
  if (tip === 0) warnings.push("No actual tip/gratuity was found. Tip is $0.00; add one if needed.");
  if (hasLabelledTip && raw.tipCents != null && raw.tipCents !== tip) warnings.push("The extracted tip fields disagreed. Used labelled tip/gratuity lines; review the amount.");
  if (raw.adjustmentCents && raw.adjustmentCents !== adjustment) warnings.push("An unlabelled adjustment was not added. Only listed charges and discounts are included.");
  if (raw.printedSubtotalCents != null && raw.printedSubtotalCents !== subtotal && raw.printedSubtotalCents !== subtotal + Math.min(adjustment, 0)) {
    warnings.push(`Printed subtotal ${dollars(raw.printedSubtotalCents)} differs from the item sum ${dollars(subtotal)}. Used the item sum.`);
  }
  if (raw.totalCents == null) {
    warnings.push(`Printed total was not readable. Used the item-based total of ${dollars(total)}; review the receipt.`);
  } else if (raw.totalCents !== total) {
    warnings.push(raw.totalCents === total - tip && tip > 0
      ? `Printed total appears to exclude gratuity. Included the detected ${dollars(tip)} once; total is ${dollars(total)}.`
      : `Printed total ${dollars(raw.totalCents)} does not match items, tax, tip/gratuity and listed charges (${dollars(total)}). Used ${dollars(total)}; review the amounts.`);
  }
  if (!items.length) warnings.push("No purchase items were readable. Enter the items manually or try a clearer receipt.");
  const draft = ScanReceiptResponse.safeParse({
    title, items, taxCents: tax, tipMode: "amount", tipValue: tip,
    adjustmentCents: adjustment, totalCents: total,
    warnings: [...new Set([...warnings, ...(raw.warnings ?? [])])].slice(0, 20),
  });
  if (!draft.success) throw new BillError(422, "The receipt amounts could not be reconciled safely. Review the receipt manually.");
  return draft.data;
}
