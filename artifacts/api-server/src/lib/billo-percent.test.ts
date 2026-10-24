import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, change, unclaimedItems, type BillState } from "./billo-domain";

function bill(): BillState {
  return {
    id: "test", title: "Test", payerId: "host", status: "open", revision: 0,
    splitMode: "itemized", venmo: "", zelle: "", scans: [],
    participants: ["host", "guest"].map(id => ({ id, name: id, finished: false, paid: false })),
    receipt: { title: "Test", items: [{ id: "item", name: "Dinner", cents: 1000, units: 1, mode: "equal", allocations: [] }],
      taxCents: 100, tipMode: "amount", tipValue: 200, adjustmentCents: 0, totalCents: 1300, warnings: [] },
  };
}
function allocate(s: BillState, allocations: {participantId: string; value: number}[]) {
  change(s, "guest", { revision: s.revision, action: "allocate", itemId: "item", itemMode: "percent", allocations });
}
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
  allocate(s, [{ participantId: "guest", value: 3333 }, { participantId: "host", value: 6667 }]);
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
  allocate(s, [{ participantId: "host", value: 2000 }, { participantId: "guest", value: 3000 }]);
  change(s, "host", { revision: s.revision, action: "close", force: true, takeRemaining: true });
  assert.equal(s.receipt.items[0]!.allocations.find(a => a.participantId === "host")!.value, 7000);
  assert.equal(s.finalParticipants![1]!.totalCents, 390);
});
