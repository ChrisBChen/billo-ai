import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, change, setupReady, unclaimedItems, upgradeSelections, view, type BillState } from "./billo-domain";

function bill(): BillState {
  return {
    id: "test", title: "Test", payerId: "host", status: "open", revision: 0,
    selectionVersion: 1, splitMode: "itemized", receiptConfirmed: true, venmo: "", zelle: "", scans: [],
    participants: ["host", "guest", "third"].map(id => ({ id, name: id, finished: false, paid: false })),
    receipt: { title: "Test", items: [{ id: "pizza", name: "Pizza", cents: 1000, mode: "equal", units: 1, allocations: [] }],
      taxCents: 100, tipMode: "percent", tipValue: 2000, adjustmentCents: 0, totalCents: 1300, warnings: [] },
  };
}
function select(s: BillState, me: string, claimed = true, itemId = "pizza") {
  change(s, me, { action: "claim", itemId, claimed, revision: 0 });
}
test("one selection pays whole item; two split in half; three reconcile exact cents", () => {
  const s = bill();
  assert.deepEqual(calculate(s).map(p => p.totalCents), [0, 0, 0]);
  assert.equal(unclaimedItems(s).length, 1);
  select(s, "host");
  assert.deepEqual(calculate(s).map(p => p.totalCents), [1300, 0, 0]);
  select(s, "guest");
  assert.deepEqual(calculate(s).map(p => p.totalCents), [650, 650, 0]);
  select(s, "third");
  assert.deepEqual(calculate(s).map(p => p.itemCents), [334, 333, 333]);
  assert.equal(calculate(s).reduce((sum, p) => sum + p.totalCents, 0), 1300);
  assert.equal(unclaimedItems(s).length, 0);
});
test("deselecting redistributes only among remaining selectors, last deselect makes unclaimed", () => {
  const s = bill();
  select(s, "guest"); select(s, "host"); select(s, "guest", false);
  assert.deepEqual(calculate(s).map(p => p.totalCents), [1300, 0, 0]);
  select(s, "host", false);
  assert.equal(unclaimedItems(s).length, 1);
  assert.deepEqual(calculate(s).map(p => p.totalCents), [0, 0, 0]);
});
test("queued selections with stale global revisions preserve each other and repeated requests are idempotent", () => {
  const s = bill();
  select(s, "host"); select(s, "guest"); select(s, "host");
  assert.equal(s.receipt.items[0]!.allocations.length, 2);
  assert.deepEqual(calculate(s).map(p => p.totalCents), [650, 650, 0]);
  change(s, "host", { action: "finish", finished: true, revision: 0 });
  select(s, "host");
  assert.equal(s.participants[0]!.finished, true);
});
test("confirmation gates claims and only payer may confirm; legacy allocation edits rejected", () => {
  const s = bill(); s.receiptConfirmed = false;
  assert.equal(setupReady(s), false);
  assert.throws(() => select(s, "guest"), /confirm the receipt and tip/);
  assert.throws(() => change(s, "guest", { action: "receipt", receipt: s.receipt, revision: 0 }), /Only the payer/);
  change(s, "host", { action: "receipt", receipt: s.receipt, revision: 0 });
  assert.equal(view(s, "host").receiptConfirmed, true);
  assert.throws(() => change(s, "guest", { action: "allocate", itemId: "pizza", itemMode: "percent", allocations: [], revision: 0 }), /split equally/);
  assert.throws(() => change(s, "guest", { action: "claim", itemId: "pizza", claimed: true, allocations: [{ participantId: "host", value: 1 }], revision: 0 }), /yourself/);
  assert.throws(() => change(s, "guest", { action: "claim", itemId: "pizza", revision: 0 }), /whether you ate/);
});
test("confirmation sticks when other people select, deselect or confirm the same item", () => {
  const s = bill();
  select(s, "guest");
  change(s, "guest", { action: "finish", finished: true, revision: 0 });
  select(s, "host"); select(s, "third");
  assert.equal(s.participants[1]!.finished, true);
  change(s, "host", { action: "finish", finished: true, revision: 0 });
  change(s, "third", { action: "finish", finished: true, revision: 0 });
  assert.equal(s.participants.every(p => p.finished), true);
  select(s, "third", false);
  assert.deepEqual(s.participants.map(p => p.finished), [true, true, false]);
  // Only changing your own choices requires your own confirmation again.
  select(s, "guest", false);
  assert.deepEqual(s.participants.map(p => p.finished), [true, false, false]);
});
test("unselected items remain uncovered until host explicitly takes them when closing", () => {
  const s = bill();
  s.receipt.items.push({ id: "drink", name: "Drink", cents: 1000, mode: "equal", units: 1, allocations: [] });
  s.receipt.totalCents = 2500;
  select(s, "guest");
  assert.equal(calculate(s)[1]!.totalCents, 1250);
  assert.throws(() => change(s, "host", { action: "close", revision: 0, force: true }), /unclaimed/);
  change(s, "host", { action: "close", revision: 0, force: true, takeRemaining: true });
  assert.deepEqual(view(s, "host").participants.map(p => p.totalCents), [1250, 1250, 0]);
  assert.throws(() => select(s, "guest", false), /Amounts are locked/);
});
test("receipt edits preserve unchanged selections and reject truly stale receipt replacements", () => {
  const s = bill(), receipt = structuredClone(s.receipt);
  select(s, "guest");
  receipt.tipValue = 3000; receipt.totalCents = 1400;
  change(s, "host", { action: "receipt", receipt, revision: 0 });
  assert.equal(calculate(s)[1]!.totalCents, 1400);
  assert.throws(() => change(s, "host", { action: "receipt", receipt, revision: 0 }), /edited in another session/);
  const changed = structuredClone(s.receipt);
  changed.items[0]!.cents = 2000; changed.totalCents = 2700;
  change(s, "host", { action: "receipt", receipt: changed, revision: s.revision });
  assert.equal(s.receipt.items[0]!.allocations.length, 0);
});
test("migration turns all positive legacy claims into equal selections, is idempotent and requires reconfirmation", () => {
  for (const mode of ["amount", "percent", "units"] as const) {
    const s = bill(); delete s.selectionVersion;
    s.participants.forEach(p => p.finished = true);
    const i = s.receipt.items[0]!;
    i.mode = mode; i.units = 8;
    i.allocations = [{ participantId: "host", value: 1 }, { participantId: "guest", value: 3 }, { participantId: "third", value: 0 }];
    upgradeSelections(s);
    assert.deepEqual(calculate(s).map(p => p.totalCents), [650, 650, 0]);
    assert.equal(s.receipt.items[0]!.mode, "equal");
    assert.equal(s.participants.every(p => !p.finished), true);
    assert.equal(s.receiptConfirmed, true);
    const saved = JSON.stringify(s); upgradeSelections(s);
    assert.equal(JSON.stringify(s), saved);
  }
});
test("legacy whole-bill equal split becomes selection by all participants; unconfirmed stays unconfirmed", () => {
  const s = bill(); delete s.selectionVersion; s.splitMode = "equal"; s.receiptConfirmed = false;
  upgradeSelections(s);
  assert.equal(s.receipt.items[0]!.allocations.length, 3);
  assert.equal(setupReady(s), false);
});
test("closed bills and their final payment amounts are never migrated", () => {
  const s = bill(); select(s, "guest");
  change(s, "host", { action: "close", force: true, revision: 0 });
  delete s.selectionVersion;
  s.receipt.items[0]!.mode = "percent";
  const before = JSON.stringify(s);
  upgradeSelections(s);
  assert.equal(JSON.stringify(s), before);
  assert.equal(view(s, "guest").participants[1]!.totalCents, 1300);
});
test("discount and tip rounding reconcile across multiple shared items", () => {
  const s = bill();
  s.receipt.items.push({ id: "extra", name: "Extra", mode: "equal", units: 1, cents: 1001, allocations: [] });
  s.receipt.adjustmentCents = -101; s.receipt.totalCents = 2400;
  for (const p of s.participants) select(s, p.id);
  select(s, "host", true, "extra"); select(s, "guest", true, "extra");
  assert.equal(calculate(s).reduce((n, p) => n + p.totalCents, 0), 2400);
});
