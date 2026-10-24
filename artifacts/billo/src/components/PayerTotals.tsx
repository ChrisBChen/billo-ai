import type { BillView } from '@workspace/api-client-react';
import { money } from '@/lib/billo';
import { payerSummary } from '@/lib/payer-summary';

export function PayerTotals({ bill }: { bill: BillView }) {
  if (bill.meId !== bill.payerId || bill.status === 'closed' || !bill.receiptConfirmed) return null;
  const totals = payerSummary(bill);
  return <section className="sp-card sp-pad sp-stack sp-content" style={{ marginBottom: 20, gap: 10 }} aria-label="Running bill totals" data-testid="payer-running-totals">
    <div className="sp-row sp-between"><strong>Bill total</strong><strong className="sp-money" data-testid="total-bill">{money(totals.totalCents)}</strong></div>
    <div className="sp-row sp-between"><span>Allocated so far</span><span className="sp-money" data-testid="total-allocated">{money(totals.allocatedCents)}</span></div>
    <div className="sp-row sp-between"><span>Confirmed shares</span><strong className="sp-money" data-testid="total-confirmed">{money(totals.confirmedCents)}</strong></div>
    <div className="sp-row sp-between"><span>Awaiting confirmation</span><span className="sp-money" data-testid="total-pending">{money(totals.pendingCents)}</span></div>
    <div className="sp-row sp-between"><strong>Unallocated balance</strong><strong className="sp-money" data-testid="total-unallocated">{money(totals.unallocatedCents)}</strong></div>
    <p className="sp-small sp-muted">Includes tax and tip. Estimates update as people choose; confirmed selections stay confirmed.</p>
  </section>;
}
