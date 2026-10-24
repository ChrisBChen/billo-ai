import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, change, setupReady, unclaimedItems, view, type BillState } from "./billo-domain";

function bill(): BillState {
  return {
    id: "test", title: "Test", payerId: "host", status: "open", revision: 0,
    splitMode: "itemized", venmo: "", zelle: "", scans: [],
    participants: ["host", "guest"].map(id => ({ id, name: id, finished: false, paid: false })),
    receipt: { title: "Test", items: [{ id: "item", name: "Dinner", cents: 1000, units: 1, mode: "percent", allocations: [] }],
      taxCents: 100, tipMode: "amount", tipValue: 200, adjustmentCents: 0, totalCents: 1300, warnings: [] },
  };
}
function allocate(s: BillState, allocations: {participantId: string; value: number}[], actor = "guest") {
  change(s, actor, { revision: s.revision, action: "allocate", itemId: "item", itemMode: s.receipt.items[0]!.mode, allocations });
}
test("receipt review gates actions until the payer confirms receipt and tip", () => {
  const s = bill();
  s.receiptConfirmed = false;
  assert.equal(setupReady(s), false);
  assert.equal(view(s, "host").receiptConfirmed, false);
  assert.throws(() => allocate(s, [{ participantId: "guest", value: 2500 }]), /finish setting up/);
  assert.throws(() => change(s, "guest", { action: "finish", finished: true, revision: 0 }), /confirm the receipt and tip/);
  assert.throws(() => change(s, "host", { action: "close", force: true, takeRemaining: true, revision: 0 }), /Confirm the receipt and tip/);
  assert.throws(() => change(s, "guest", { action: "receipt", receipt: s.receipt, revision: 0 }), /Only the payer/);
  change(s, "host", { action: "receipt", receipt: s.receipt, revision: 0 });
  assert.equal(setupReady(s), true);
  assert.equal(view(JSON.parse(JSON.stringify(s)), "host").receiptConfirmed, true);
  allocate(s, [{ participantId: "guest", value: 2500 }]);
  assert.equal(calculate(s)[1]!.totalCents, 325);
  // A new scan revokes readiness even when a previous receipt has items.
  s.receiptConfirmed = false;
  assert.equal(setupReady(s), false);
});
test("partial percent saves without normalizing to 100%, including tax and tip", () => {
  const s = bill();
  allocate(s, [{ participantId: "guest", value: 2500 }]);
  assert.equal(calculate(s)[1]!.totalCents, 325);
  assert.equal(unclaimedItems(s).length, 1);
  assert.throws(() => change(s, "host", { revision: s.revision, action: "close", force: true }), /unclaimed/);
  change(s, "host", { revision: s.revision, action: "close", force: true, takeRemaining: true });
  assert.equal(s.finalParticipants![1]!.totalCents, 325);
  assert.equal(s.finalParticipants![0]!.totalCents, 975);
});
test("others can finish a partial allocation; totals reconcile exactly", () => {
  const s = bill();
  allocate(s, [{ participantId: "guest", value: 3333 }]);
  allocate(s, [{ participantId: "host", value: 6667 }], "host");
  assert.equal(unclaimedItems(s).length, 0);
  assert.equal(calculate(s).reduce((sum, p) => sum + p.totalCents, 0), 1300);
});
test("over-allocation is rejected and zero clears a percent claim", () => {
  const s = bill();
  assert.throws(() => allocate(s, [{ participantId: "guest", value: 10001 }]), /exceed/);
  allocate(s, [{ participantId: "guest", value: 5000 }]);
  allocate(s, []);
  assert.equal(calculate(s)[1]!.totalCents, 0);
  assert.equal(unclaimedItems(s).length, 1);
});
test("taking the remainder adds to the payer's existing share", () => {
  const s = bill();
  allocate(s, [{ participantId: "host", value: 2000 }], "host");
  allocate(s, [{ participantId: "guest", value: 3000 }]);
  change(s, "host", { revision: s.revision, action: "close", force: true, takeRemaining: true });
  assert.equal(s.receipt.items[0]!.allocations.find(a => a.participantId === "host")!.value, 7000);
  assert.equal(s.finalParticipants![1]!.totalCents, 390);
});
test("guests cannot change method, totals, receipt, or other people's shares", () => {
  const s = bill();
  allocate(s, [{ participantId: "host", value: 2000 }], "host");
  const before = JSON.stringify(s);
  assert.throws(() => allocate(s, [{ participantId: "host", value: 1000 }]), /own share/);
  assert.throws(() => change(s, "guest", { revision: s.revision, action: "allocate", itemId: "item", itemMode: "units", allocations: [] }), /Only the payer/);
  assert.throws(() => change(s, "guest", { revision: s.revision, action: "allocate", itemId: "item", itemMode: "percent", units: 8, allocations: [] }), /Only the payer/);
  assert.throws(() => change(s, "guest", { revision: s.revision, action: "receipt", receipt: s.receipt }), /Only the payer/);
  assert.equal(JSON.stringify(s), before);
  allocate(s, [{ participantId: "guest", value: 3000 }]);
  allocate(s, []);
  assert.deepEqual(s.receipt.items[0]!.allocations, [{ participantId: "host", value: 2000 }]);
});
for (const mode of ["amount", "units"] as const) {
  test(`${mode}: partial claims, limits, zero, and payer remainder reconcile`, () => {
    const s = bill(), item = s.receipt.items[0]!;
    item.mode = mode; item.units = 8;
    const target = mode === "amount" ? 1000 : 8;
    allocate(s, [{ participantId: "guest", value: target / 4 }]);
    assert.equal(calculate(s)[1]!.totalCents, 325);
    assert.equal(unclaimedItems(s).length, 1);
    assert.throws(() => allocate(s, [{ participantId: "host", value: target }], "host"), /exceed/);
    allocate(s, [{ participantId: "host", value: target / 4 }], "host");
    allocate(s, [], "host");
    assert.equal(calculate(s)[1]!.totalCents, 325);
    change(s, "host", { revision: s.revision, action: "close", force: true, takeRemaining: true });
    assert.equal(s.finalParticipants![0]!.totalCents, 975);
    assert.equal(s.finalParticipants![1]!.totalCents, 325);
  });
}
test("payer saves explicit methods and units; unrelated revisions do not reject claims", () => {
  const s = bill();
  s.receipt.items[0]!.mode = "equal";
  assert.throws(() => change(s, "host", { revision: 0, action: "receipt", receipt: s.receipt }), /Choose dollars/);
  s.receipt.items[0]!.mode = "units"; s.receipt.items[0]!.units = 8;
  change(s, "host", { revision: 0, action: "receipt", receipt: s.receipt });
  assert.equal(s.receipt.items[0]!.units, 8);
  assert.equal(s.receipt.items[0]!.mode, "units");
  change(s, "guest", { revision: 0, action: "allocate", itemId: "item", itemMode: "units", allocations: [] });
  allocate(s, [{ participantId: "guest", value: 2 }]);
  assert.equal(calculate(s)[1]!.itemCents, 250);
});
test("two queued claims using the same revision preserve both shares", () => {
  const s = bill();
  change(s, "guest", { revision: 0, action: "allocate", itemId: "item", itemMode: "percent", allocations: [{ participantId: "guest", value: 2500 }] });
  change(s, "host", { revision: 0, action: "allocate", itemId: "item", itemMode: "percent", allocations: [{ participantId: "host", value: 2500 }] });
  assert.equal(calculate(s)[0]!.totalCents, 325);
  assert.equal(calculate(s)[1]!.totalCents, 325);
  const before = JSON.stringify(s);
  assert.throws(() => change(s, "guest", { revision: 0, action: "allocate", itemId: "item", itemMode: "percent", allocations: [{ participantId: "guest", value: 8000 }] }), /exceed/);
  assert.equal(JSON.stringify(s), before);
});
test("receipt saves after guest claims preserve their claims and directly adjusted totals reconcile", () => {
  const s = bill();
  const draft = structuredClone(s.receipt);
  allocate(s, [{ participantId: "guest", value: 2500 }]);
  // Host changes pre-tip total to $12 and adds $2 tip, without a manual fee input.
  draft.adjustmentCents = 100; draft.totalCents = 1400;
  change(s, "host", { revision: 0, action: "receipt", receipt: draft });
  assert.equal(s.receipt.items[0]!.allocations[0]!.value, 2500);
  assert.equal(calculate(s)[1]!.totalCents, 350);
  // A second host editing the old receipt must explicitly review its replacement.
  assert.throws(() => change(s, "host", { revision: 0, action: "receipt", receipt: draft }), /receipt was edited/);
});
test("changing one item clears only that item's claims", () => {
  const s = bill();
  s.receipt.items.push({ ...s.receipt.items[0]!, id: "other", allocations: [{ participantId: "guest", value: 5000 }] });
  s.receipt.totalCents += 1000;
  allocate(s, [{ participantId: "guest", value: 2500 }]);
  const draft = structuredClone(s.receipt);
  draft.items[0]!.cents = 2000; draft.totalCents += 1000;
  change(s, "host", { revision: s.revision, action: "receipt", receipt: draft });
  assert.equal(s.receipt.items[0]!.allocations.length, 0);
  assert.equal(s.receipt.items[1]!.allocations[0]!.value, 5000);
});
