import type { BillView } from '@workspace/api-client-react';

/** Reuse the server's cent-rounded shares, including each share's tax and tip. */
export function payerSummary(bill: BillView) {
  const allocatedCents = bill.participants.reduce((sum, p) => sum + p.totalCents, 0);
  const confirmedCents = bill.participants.filter(p => p.finished).reduce((sum, p) => sum + p.totalCents, 0);
  return {
    totalCents: bill.receipt.totalCents,
    allocatedCents,
    confirmedCents,
    pendingCents: allocatedCents - confirmedCents,
    unallocatedCents: bill.receipt.totalCents - allocatedCents,
  };
}
