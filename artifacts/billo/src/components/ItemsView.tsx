import { Check, ChevronDown, ChevronRight, Clock3, LockKeyhole, Pencil, ReceiptText, Users } from 'lucide-react';
import type { BillItem, BillView } from '@workspace/api-client-react';
import { Spinner } from '@/components/Chrome';
import type { Change } from '@/hooks/use-bill-actions';
import { findPerson, isClaimedBy, itemShares, money } from '@/lib/billo';

export function ItemsView({ bill, send, pending, onSplit, onBreakdown, onPrimary, onAddReceipt }: { bill: BillView; send: (c: Change, o?: { success?: string }) => void; pending: boolean; onSplit: (item: BillItem) => void; onBreakdown: () => void; onPrimary: () => void; onAddReceipt: () => void }) {
  const me = findPerson(bill, bill.meId);
  const closed = bill.status === 'closed', finished = !!me?.finished, locked = closed || finished;
  const isHost = bill.meId === bill.payerId;
  const items = bill.receipt.items;
  function label(item: BillItem) {
    const allocs = item.allocations.filter(a => a.value > 0);
    if (!allocs.length) return 'Unclaimed';
    const own = isClaimedBy(item, bill.meId), mine = itemShares(item)[bill.meId] ?? 0;
    const myAlloc = item.allocations.find(a => a.participantId === bill.meId)?.value ?? 0;
    if (item.mode === 'units') return own ? `You: ${myAlloc} of ${item.units} units · ${money(mine)}` : `${item.units} units allocated`;
    if (item.mode === 'percent') {
      const remaining = 10000 - allocs.reduce((sum, a) => sum + a.value, 0);
      return (own ? `You: ${myAlloc / 100}% · ${money(mine)}` : 'Split by percent') + (remaining > 0 ? ` · ${remaining / 100}% unclaimed` : '');
    }
    if (item.mode === 'amount') return own ? `You: ${money(mine)}` : 'Split by amount';
    if (allocs.length > 1) return `${allocs.length} people${own ? ` · You ${money(mine)}` : ' · Equal'}`;
    return own ? 'Yours' : findPerson(bill, allocs[0].participantId)?.name ?? 'Claimed';
  }
  function tap(item: BillItem) {
    if (locked || pending) return;
    if (item.mode !== 'equal') { onSplit(item); return; }
    send({ action: 'claim', itemId: item.id, claimed: !isClaimedBy(item, bill.meId) });
  }
  const primaryLabel = closed ? (isHost ? 'Group' : 'Pay') : finished ? 'Edit choices' : 'Confirm';
  const lines = me ? <><div><span>Items</span><span className="sp-money">{money(me.itemCents)}</span></div><div><span>Tax</span><span className="sp-money">{money(me.taxCents)}</span></div><div><span>Tip{bill.receipt.tipMode === 'percent' ? ` (${bill.receipt.tipValue / 100}%)` : ''}</span><span className="sp-money">{money(me.tipCents)}</span></div>{me.adjustmentCents !== 0 && <div><span>Fees and discounts</span><span className="sp-money">{money(me.adjustmentCents)}</span></div>}</> : null;

  return <>
    {finished && !closed && <div className="sp-notice" style={{ marginBottom: 16 }} data-testid="status-waiting"><Clock3 size={17} />You confirmed. Waiting for {findPerson(bill, bill.payerId)?.name ?? 'the payer'} to close the bill.</div>}
    {closed && <div className="sp-notice" style={{ marginBottom: 16 }}><LockKeyhole size={17} />This bill is closed. Amounts are final.</div>}
    <div className="sp-selection-grid">
      <div>
        <div className="sp-card">
          <div className="sp-card-head"><span className="sp-small sp-muted">{bill.splitMode === 'equal' ? 'Equal split' : `${items.length} items`}</span>{pending && <Spinner />}</div>
          {!items.length ? <div className="sp-pad sp-stack sp-center"><ReceiptText size={30} style={{ margin: '0 auto' }} color="var(--sp-accent)" /><h2>No items yet</h2>{isHost ? <button className="sp-button" data-testid="button-add-receipt" onClick={onAddReceipt}>Add the receipt</button> : <p className="sp-muted">The payer is adding the receipt. It appears here automatically.</p>}</div>
          : bill.splitMode === 'equal' ? <div className="sp-pad sp-stack"><Users size={27} color="var(--sp-accent)" /><h2>Split equally, {bill.participants.length} {bill.participants.length === 1 ? 'way' : 'ways'}</h2><p className="sp-muted">Everyone pays the same share, including tax and tip. Your share is {money(me?.totalCents ?? 0)}.</p></div>
          : items.map(item => { const own = isClaimedBy(item, bill.meId); return <div key={item.id} className={`sp-item ${own ? 'sp-selected' : ''}`} data-testid={`row-item-${item.id}`}>
              <button className="sp-item-main" disabled={locked || pending} aria-pressed={own} aria-label={`${item.mode !== 'equal' ? 'Edit split for' : own ? 'Unselect' : 'Select'} ${item.name}`} data-testid={`button-claim-${item.id}`} onClick={() => tap(item)}>
                <span className="sp-checkbox">{own && <Check size={16} strokeWidth={2.5} />}</span><span className="sp-item-title">{item.name}</span><span className="sp-money">{money(item.cents)}</span>
              </button>
              <div className="sp-item-meta"><span>{label(item)}</span><button className="sp-split-action" disabled={locked || pending} data-testid={`button-split-${item.id}`} onClick={() => onSplit(item)}>{item.mode !== 'equal' ? 'Edit split' : 'Split item'}<ChevronRight size={16} /></button></div>
            </div>; })}
        </div>
        <p className="sp-list-note">{bill.splitMode === 'equal' ? 'Extra cents are balanced across the group.' : 'Tax and tip follow each person’s item total.'}</p>
      </div>
      <aside className="sp-card sp-pad sp-summary">
        <span className="sp-small sp-muted">Your {closed ? 'final' : 'estimated'} share</span><div className="sp-big-amount sp-money" data-testid="text-my-total">{money(me?.totalCents ?? 0)}</div>
        <div className="sp-summary-lines">{lines}</div>
        <button className={`sp-button full ${finished && !closed ? 'secondary' : ''}`} data-testid="button-primary" disabled={!items.length || pending} onClick={onPrimary}>{finished && !closed ? <Pencil size={17} /> : null}{primaryLabel}{!finished && !closed && <Check size={18} />}</button>
        <p className="sp-footer-note">No payment is made here.</p>
      </aside>
    </div>
    <div className="sp-sticky-footer"><button onClick={onBreakdown} aria-label="View your share breakdown" data-testid="button-breakdown"><span className="sp-small">{closed ? 'Final share' : 'Your share · estimated'}<ChevronDown size={13} /></span><span className="sp-money">{money(me?.totalCents ?? 0)}</span></button><button className={`sp-button ${finished && !closed ? 'secondary' : ''}`} data-testid="button-primary-mobile" disabled={!items.length || pending} onClick={onPrimary}>{primaryLabel}{!finished && !closed && <Check size={18} />}</button></div>
  </>;
}

export function BreakdownLines({ bill }: { bill: BillView }) {
  const me = findPerson(bill, bill.meId);
  if (!me) return null;
  return <div className="sp-summary-lines" style={{ margin: 0 }}>
    <div><span>Items</span><span className="sp-money">{money(me.itemCents)}</span></div><div><span>Tax</span><span className="sp-money">{money(me.taxCents)}</span></div><div><span>Tip</span><span className="sp-money">{money(me.tipCents)}</span></div>
    {me.adjustmentCents !== 0 && <div><span>Fees and discounts</span><span className="sp-money">{money(me.adjustmentCents)}</span></div>}
    <div><span>Total</span><strong className="sp-money">{money(me.totalCents)}</strong></div>
  </div>;
}
