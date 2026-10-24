import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeReceiptExtraction } from "./billo-ocr-normalize";
import { change, receiptTotals, validateReceipt, view, type BillState } from "./billo-domain";

function raw(extra: Record<string, unknown> = {}) {
  return {
    title: "Synthetic receipt", currency: "USD",
    items: [{ name: "Dinner", cents: 10000, units: 1 }],
    taxCents: 800, charges: [], printedSubtotalCents: 10000, totalCents: 10800, warnings: [],
    ...extra,
  };
}
function normalize(extra: Record<string, unknown>) {
  const draft = normalizeReceiptExtraction(raw(extra));
  assert.equal(draft.totalCents, receiptTotals(draft).total, "Every returned total must reconcile exactly");
  validateReceipt(draft);
  return draft;
}

test("automatic gratuity and service-charge labels override erroneous fee classification", () => {
  for (const label of ["Auto Gratuity 18%", "Autograt", "AutoGratuity", "Mandatory gratuity", "18% Auto Grat", "Service Charge", "Hospitality fee", "Service included", "Grat. 18%"]) {
    const d = normalize({ charges: [{ label, kind: "fee", cents: 1800 }], totalCents: 12600 });
    assert.equal(d.tipValue, 1800, label);
    assert.equal(d.adjustmentCents, 0, label);
    assert.equal(d.items.length, 1, label);
  }
});
test("gratuity listed as an item and aggregate adjustment is moved into tip without double counting", () => {
  const d = normalize({
    items: [{ name: "Dinner", cents: 10000 }, { name: "Auto Gratuity", cents: 1800 }],
    charges: [{ label: "Service charge", kind: "gratuity", cents: 1800 }],
    tipCents: 1800, adjustmentCents: 1800, totalCents: 12600,
  });
  assert.equal(d.tipValue, 1800);
  assert.equal(d.adjustmentCents, 0);
  assert.equal(d.totalCents, 12600);
  assert.deepEqual(d.items.map(i => i.name), ["Dinner"]);
});
test("a gratuity item alone is recovered even when the model put it under adjustments", () => {
  const d = normalize({
    items: [{ name: "Dinner", cents: 10000 }, { name: "18% Auto Grat", cents: 1800 }],
    adjustmentCents: 1800, totalCents: 12600,
  });
  assert.equal(d.tipValue, 1800);
  assert.equal(d.adjustmentCents, 0);
});
test("automatic gratuity and an actual additional tip are both counted exactly once", () => {
  const d = normalize({
    charges: [{ label: "Auto Grat", kind: "gratuity", cents: 1800 }, { label: "Additional tip", kind: "tip", cents: 200 }],
    tipCents: 2000, totalCents: 12800,
  });
  assert.equal(d.tipValue, 2000);
  assert.equal(d.totalCents, 12800);
  assert.match(d.warnings.join(" "), /18\.00/);
});
test("a repeated combined gratuity total is not a second charge", () => {
  const d = normalize({
    charges: [
      { label: "Auto Grat", kind: "gratuity", cents: 1800 },
      { label: "Additional tip", kind: "tip", cents: 200 },
      { label: "Total tip", kind: "tip", cents: 2000 },
    ], totalCents: 12800,
  });
  assert.equal(d.tipValue, 2000);
  assert.match(d.warnings.join(" "), /only once/);
});
test("suggested gratuity tables are ignored, never used to fill a tip", () => {
  const d = normalize({
    items: [{ name: "Dinner", cents: 10000 }, { name: "Suggested 20% tip", cents: 2000 }],
    charges: [{ label: "Recommended gratuity 18%", kind: "tip", cents: 1800 }],
  });
  assert.equal(d.tipValue, 0);
  assert.equal(d.totalCents, 10800);
});
test("a missing tip defaults to zero, not the difference from the printed total", () => {
  const d = normalize({ taxCents: 800, totalCents: 12600 });
  assert.equal(d.tipValue, 0);
  assert.equal(d.adjustmentCents, 0);
  assert.equal(d.totalCents, 10800);
  assert.match(d.warnings.join(" "), /Tip is \$0\.00/);
  assert.match(d.warnings.join(" "), /Printed total.*does not match/);
});
test("unreadable gratuity defaults to zero and requests review", () => {
  const d = normalize({ charges: [{ label: "Auto gratuity", kind: "gratuity", cents: null }], totalCents: 12600 });
  assert.equal(d.tipValue, 0);
  assert.equal(d.totalCents, 10800);
  assert.match(d.warnings.join(" "), /unreadable and omitted/);
});
test("a printed pre-tip total does not discard real detected gratuity", () => {
  const d = normalize({ charges: [{ label: "Auto grat", kind: "gratuity", cents: 1800 }] });
  assert.equal(d.totalCents, 12600);
  assert.equal(d.tipValue, 1800);
  assert.match(d.warnings.join(" "), /exclude gratuity/);
});
test("a mismatched printed total and unexplained adjustment cannot override line-item arithmetic", () => {
  const d = normalize({
    items: [{ name: "Meal", cents: 4900 }], printedSubtotalCents: 5000, taxCents: 400,
    charges: [{ label: "Tip", kind: "tip", cents: 980 }], adjustmentCents: 50000, totalCents: 100000,
  });
  assert.equal(d.totalCents, 6280);
  assert.equal(d.adjustmentCents, 0);
  assert.match(d.warnings.join(" "), /Printed subtotal/);
  assert.match(d.warnings.join(" "), /Printed total/);
});
test("only actual labelled non-gratuity fees and discounts affect adjustments", () => {
  const d = normalize({
    charges: [
      { label: "Delivery service charge", kind: "fee", cents: 300 },
      { label: "Coupon", kind: "discount", cents: 1000 },
      { label: "Auto gratuity", kind: "gratuity", cents: 1800 },
    ], totalCents: 11900,
  });
  assert.equal(d.tipValue, 1800);
  assert.equal(d.adjustmentCents, -700);
  assert.equal(d.totalCents, 11900);
});
test("different equal-priced fees are not mistaken for duplicate gratuities", () => {
  const d = normalize({
    items: [{ name: "Dinner", cents: 10000 }, { name: "Delivery fee", cents: 200 }],
    charges: [{ label: "Packaging fee", kind: "fee", cents: 200 }], totalCents: 11200,
  });
  assert.equal(d.adjustmentCents, 400);
  assert.equal(d.tipValue, 0);
});
test("food names containing tip remain purchase items, and whole-line quantities are not multiplied twice", () => {
  const d = normalize({
    items: [{ name: "Tri-tip steak", cents: 8000, units: 2 }, { name: "Tip Top IPA", cents: 2000, units: 2 }],
  });
  assert.equal(d.items.length, 2);
  assert.equal(d.tipValue, 0);
  assert.equal(d.totalCents, 10800);
});
test("unreadable printed totals use the computed total and preserve review warnings", () => {
  const d = normalize({ totalCents: null, warnings: ["Check the blurry tax line."] });
  assert.equal(d.totalCents, 10800);
  assert.match(d.warnings.join(" "), /Printed total was not readable/);
  assert.ok(d.warnings.includes("Check the blurry tax line."));
});
test("non-USD receipts do not produce a misleading dollar bill", () => {
  const d = normalizeReceiptExtraction(raw({ currency: "CAD" }));
  assert.equal(d.items.length, 0);
  assert.equal(d.totalCents, 0);
  assert.match(d.warnings.join(" "), /Only USD/);
});
test("malformed money values fail explicitly rather than silently coercing dollars to cents", () => {
  assert.throws(() => normalizeReceiptExtraction(raw({ taxCents: "8.00" })), /could not be read reliably/);
});

test("dedicated restaurant identity takes precedence over a generic or legacy title", () => {
  const d = normalize({ restaurantName: "Lucia's Trattoria", title: "Receipt" });
  assert.equal(d.title, "Lucia's Trattoria");
});
test("multiline names are cleaned without losing accents, case or meaningful punctuation", () => {
  const d = normalize({ restaurantName: " \n Le Café \t d’André\n & Sons  ", title: null });
  assert.equal(d.title, "Le Café d’André & Sons");
});
test("unreadable names preserve the existing bill name rather than replacing it with a placeholder", () => {
  for (const name of [null, "", "   ", "Restaurant", "Unknown restaurant", "Guest Check", "Receipt", "Merchant Copy", "N/A"]) {
    const d = normalizeReceiptExtraction(raw({ restaurantName: name, title: null }), "Friday dinner");
    assert.equal(d.title, "Friday dinner", String(name));
    assert.equal(d.totalCents, 10800);
    assert.match(d.warnings.join(" "), /Restaurant name could not be read/);
  }
});
test("legacy title-only model responses still preserve actual restaurant names", () => {
  const d = normalize({ title: "  O'Malley's \n Grill  " });
  assert.equal(d.title, "O'Malley's Grill");
  assert.ok(!d.warnings.some(w => w.includes("Restaurant name could not be read")));
});
test("a readable legacy name is retained if the dedicated name is unreadable", () => {
  const d = normalize({ restaurantName: null, title: "Restaurant 1984" });
  assert.equal(d.title, "Restaurant 1984");
});
test("an overlong OCR name is bounded without failing an otherwise usable receipt", () => {
  const name = "The Restaurant and Dining Room ".repeat(5);
  const d = normalize({ restaurantName: name, title: null });
  assert.equal(d.title, name.trim().slice(0, 100));
  assert.equal(d.totalCents, 10800);
});
test("no name or fallback still yields a valid review draft with an explicit warning", () => {
  const d = normalizeReceiptExtraction(raw({ restaurantName: null, title: null }), "");
  assert.equal(d.title, "Receipt");
  assert.match(d.warnings.join(" "), /Restaurant name could not be read/);
});
test("payer confirmation saves the detected name to both bill and receipt views", () => {
  const draft = normalize({ restaurantName: "Lucia's Trattoria", title: null });
  const state: BillState = {
    id: "synthetic-name-test", title: "Friday dinner", payerId: "host", status: "open", revision: 0,
    selectionVersion: 1, splitMode: "itemized", receiptConfirmed: false, venmo: "", zelle: "", scans: [],
    participants: [{ id: "host", name: "Payer", finished: false, paid: false }],
    receipt: { ...draft, title: "Friday dinner" },
  };
  change(state, "host", { action: "receipt", revision: 0, receipt: draft });
  const saved = view(state, "host");
  assert.equal(saved.title, "Lucia's Trattoria");
  assert.equal(saved.receipt.title, "Lucia's Trattoria");
  assert.equal(saved.receiptConfirmed, true);
});
