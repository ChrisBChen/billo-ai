import { Pencil, ReceiptText } from 'lucide-react';
import type { BillView } from '@workspace/api-client-react';
import { money, subtotalOf, tipCentsOf } from '@/lib/billo';

export function ReceiptView({ bill, canEdit, onEdit }: { bill: BillView; canEdit: boolean; onEdit: () => void }) {
  const r = bill.receipt;
  const sub = subtotalOf(r.items), tip = tipCentsOf(sub, r.tipMode, r.tipValue);
  if (!r.items.length) return <div className="sp-card sp-pad sp-stack sp-center sp-content"><div className="sp-state-symbol"><ReceiptText size={26} /></div><h2>No receipt yet</h2><p className="sp-muted">The payer is adding the receipt. Items appear here automatically.</p></div>;
  return <div className="sp-card sp-pad sp-content">
    <div className="sp-row sp-between" style={{ marginBottom: 6 }}><h3>{r.title}</h3>{canEdit && <button className="sp-link" data-testid="button-edit-receipt" onClick={onEdit}><Pencil size={16} />{bill.receiptConfirmed ? 'Edit' : 'Review & confirm'}</button>}</div>
    {r.items.map(i => <div className="sp-ro-row" key={i.id}><span>{i.name}</span><span className="sp-money">{money(i.cents)}</span></div>)}
    <div className="sp-totals" style={{ marginTop: 10 }}>
      <div className="sp-row"><span>Subtotal</span><span className="sp-money">{money(sub)}</span></div>
      <div className="sp-row"><span>Tax</span><span className="sp-money">{money(r.taxCents)}</span></div>
      <div className="sp-row"><span>Tip{r.tipMode === 'percent' ? ` (${r.tipValue / 100}%)` : ''}</span><span className="sp-money">{money(tip)}</span></div>
      {r.adjustmentCents !== 0 && <div className="sp-row"><span>Total adjustment</span><span className="sp-money">{money(r.adjustmentCents)}</span></div>}
      <div className="sp-row sp-total-row"><span>Total</span><span className="sp-money" data-testid="text-receipt-total">{money(r.totalCents)}</span></div>
    </div>
  </div>;
}
