import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BillView } from '@workspace/api-client-react';
import { sharesVisible } from './billo';
import { payerSummary } from './payer-summary';

function fixture(meId = 'friend'): BillView {
  return {
    id: 'test', title: 'Test', payerId: 'payer', meId, status: 'open', revision: 0,
    splitMode: 'itemized', receiptConfirmed: true, unclaimedItemIds: [],
    venmo: '', zelle: '', venmoUrl: '', venmoWebUrl: '', paymentNote: '', outstandingCents: 500,
    participants: ['payer', 'friend'].map(id => ({
      id, name: id, isPayer: id === 'payer', finished: true, paid: false,
      itemCents: 500, taxCents: 0, tipCents: 0, adjustmentCents: 0, totalCents: 500,
    })),
    receipt: {
      title: 'Test', items: [{
        id: 'burger', name: 'Burger', cents: 1000, mode: 'equal', units: 1,
        allocations: ['payer', 'friend'].map(participantId => ({ participantId, value: 1 })),
      }], taxCents: 0, tipMode: 'amount', tipValue: 0, adjustmentCents: 0, totalCents: 1000, warnings: [],
    },
  };
}

test('friends cannot see shares before closure, even with every selection confirmed and allocated', () => {
  const bill = fixture();
  assert.equal(sharesVisible(bill), false);
  bill.participants[0]!.finished = false;
  assert.equal(sharesVisible(bill), false);
  bill.unclaimedItemIds = ['unclaimed'];
  assert.equal(sharesVisible(bill), false);
});

test('closing reveals final shares to friends, including forced closure', () => {
  const bill = fixture();
  bill.status = 'closed';
  assert.equal(sharesVisible(bill), true);
  bill.participants.forEach(p => { p.finished = false; });
  assert.equal(sharesVisible(bill), true);
});

test('payer estimates remain visible before everyone confirms or all items are claimed', () => {
  const bill = fixture('payer');
  bill.participants.forEach(p => { p.finished = false; });
  bill.unclaimedItemIds = ['unclaimed'];
  assert.equal(sharesVisible(bill), true);
  bill.receiptConfirmed = false;
  assert.equal(sharesVisible(bill), false);
});

test('payer progress separates confirmed, choosing and unallocated shares including tax and tip', () => {
  const bill = fixture('payer');
  bill.receipt.totalCents = 2600;
  bill.participants.forEach((p, i) => {
    p.itemCents = 500; p.taxCents = 50; p.tipCents = 100; p.totalCents = 650; p.finished = i === 1;
  });
  assert.deepEqual(payerSummary(bill), {
    totalCents: 2600, allocatedCents: 1300, confirmedCents: 650, pendingCents: 650, unallocatedCents: 1300,
  });
  bill.participants.forEach(p => { p.finished = true; });
  assert.equal(payerSummary(bill).confirmedCents, 1300);
  assert.equal(payerSummary(bill).unallocatedCents, 1300);
  bill.participants.forEach(p => { p.totalCents = 0; });
  assert.equal(payerSummary(bill).unallocatedCents, 2600);
});
