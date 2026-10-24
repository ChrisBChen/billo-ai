import { Check, ChevronDown, Clock3, LockKeyhole, Pencil, ReceiptText, Settings2, Users } from 'lucide-react';
import type { BillItem, BillView } from '@workspace/api-client-react';
import { Spinner } from '@/components/Chrome';
import type { Change } from '@/hooks/use-bill-actions';
import { billReady, findPerson, isClaimedBy, itemShares, money, sharesVisible } from '@/lib/billo';

export function ItemsView({ bill, send, pending, onBreakdown, onPrimary, onAddReceipt }: { bill: BillView; send: (c: Change, o?: { success?: string }) => void; pending: boolean; onBreakdown: () => void; onPrimary: () => void; onAddReceipt: () => void }) {
  const me = findPerson(bill, bill.meId);
  const closed = bill.status === 'closed', finished = !!me?.finished, locked = closed || finished;
  const isHost = bill.meId === bill.payerId;
  const items = bill.receipt.items;
  const ready = closed || billReady(bill);
  const showAmounts = sharesVisible(bill);
  const selectedCount = items.filter(item => isClaimedBy(item, bill.meId)).length;
  function label(item: BillItem) {
    const selected = bill.participants.filter(p => isClaimedBy(item, p.id));
    if (!selected.length) return 'No one selected yet';
    if (!showAmounts) {
      const others = selected.filter(p => p.id !== bill.meId).map(p => p.name);
      return isClaimedBy(item, bill.meId)
        ? `You’re taking a share${others.length ? ` · Also selected by ${others.join(', ')}` : ''}`
        : `Selected by ${others.join(', ')}`;
    }
    const mine = itemShares(item, bill.participants.map(p => p.id))[bill.meId] ?? 0;
    return `${selected.map(p => p.id === bill.meId ? 'You' : p.name).join(', ')}${selected.length > 1 ? ` · Split ${selected.length} ways` : ''}${isClaimedBy(item, bill.meId) ? ` · Your share ${money(mine)}` : ''}`;
  }
  function tap(item: BillItem) {
    if (!locked && !pending && ready) send({ action: 'claim', itemId: item.id, claimed: !isClaimedBy(item, bill.meId) });
  }
  const primaryLabel = closed ? (isHost ? 'Summary' : 'Pay') : finished ? 'Edit choices' : 'Confirm';
  const lines = me ? <><div><span>Items</span><span className="sp-money">{money(me.itemCents)}</span></div><div><span>Tax</span><span className="sp-money">{money(me.taxCents)}</span></div><div><span>Tip{bill.receipt.tipMode === 'percent' ? ` (${bill.receipt.tipValue / 100}%)` : ''}</span><span className="sp-money">{money(me.tipCents)}</span></div>{me.adjustmentCents !== 0 && <div><span>Total adjustment</span><span className="sp-money">{money(me.adjustmentCents)}</span></div>}</> : null;

  return <>
    {finished && !closed && <div className="sp-notice" style={{ marginBottom: 16 }} data-testid="status-waiting"><Clock3 size={17} />{bill.participants.every(p => p.finished) ? <>You confirmed. Waiting for {findPerson(bill, bill.payerId)?.name ?? 'the payer'}{isHost ? ' (you)' : ''} to close the bill.</> : 'You confirmed your items. Waiting for everyone to finish choosing.'}</div>}
    {closed && <div className="sp-notice" style={{ marginBottom: 16 }}><LockKeyhole size={17} />This bill is closed. Amounts are final.</div>}
    <div className="sp-selection-grid">
      <div>
        <div className="sp-card">
          <div className="sp-card-head"><span className="sp-small sp-muted">{bill.splitMode === 'equal' ? 'Equal split' : `${items.length} items`}</span>{pending && <Spinner />}</div>
          {!items.length ? <div className="sp-pad sp-stack sp-center"><ReceiptText size={30} style={{ margin: '0 auto' }} color="var(--sp-accent)" /><h2>No items yet</h2>{isHost ? <button className="sp-button" data-testid="button-add-receipt" onClick={onAddReceipt}>Add the receipt</button> : <p className="sp-muted">The payer is adding the receipt. It appears here automatically.</p>}</div>
          : !ready ? <div className="sp-pad sp-stack sp-center" data-testid="status-setup"><Settings2 size={30} style={{ margin: '0 auto' }} color="var(--sp-accent)" /><h2>{isHost ? 'Confirm the receipt' : 'Almost ready'}</h2>{isHost ? <><p className="sp-muted">Review the receipt and tip first.</p><button className="sp-button" data-testid="button-setup-receipt" onClick={onAddReceipt}>Review receipt</button></> : <p className="sp-muted">Waiting for the payer to confirm.</p>}</div>
          : bill.splitMode === 'equal' ? <div className="sp-pad sp-stack"><Users size={27} color="var(--sp-accent)" /><h2>Split equally, {bill.participants.length} {bill.participants.length === 1 ? 'way' : 'ways'}</h2><p className="sp-muted">Everyone pays the same share, including tax and tip.{showAmounts && <> Your share is {money(me?.totalCents ?? 0)}.</>}</p></div>
          : items.map(item => { const own = isClaimedBy(item, bill.meId); return <div key={item.id} className={`sp-item ${own ? 'sp-selected' : ''}`} data-testid={`row-item-${item.id}`}>
              <button className="sp-item-main" disabled={locked || pending} aria-pressed={own} aria-label={`${own ? 'Deselect' : 'Select'} ${item.name}`} data-testid={`button-claim-${item.id}`} onClick={() => tap(item)}>
                <span className="sp-checkbox">{own && <Check size={16} strokeWidth={2.5} />}</span><span className="sp-item-title">{item.name}</span><span className="sp-money">{money(item.cents)}</span>
              </button>
              <div className="sp-item-meta"><span>{label(item)}</span></div>
            </div>; })}
        </div>
        <p className="sp-list-note">{closed ? 'Amounts are final.' : 'Tap what you ate. Shared items split equally between everyone who selects them. Tax and tip follow your share.'}</p>
      </div>
      <aside className="sp-card sp-pad sp-summary">
        {showAmounts ? <>
          <span className="sp-small sp-muted">{closed ? 'Your final share' : 'Your share · estimate'}</span><div className="sp-big-amount sp-money" data-testid="text-my-total">{money(me?.totalCents ?? 0)}</div>
          <div className="sp-summary-lines">{lines}</div>
        </> : <div className="sp-stack" data-testid="status-selection-only">
          <span className="sp-small sp-muted">Your selections</span>
          <h2>{selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected</h2>
          <p className="sp-small sp-muted">Your amount appears after the payer closes the bill.</p>
        </div>}
        <button className={`sp-button full ${finished && !closed ? 'secondary' : ''}`} data-testid="button-primary" disabled={(!ready && !closed) || pending} onClick={onPrimary}>{finished && !closed ? <Pencil size={17} /> : null}{primaryLabel}{!finished && !closed && <Check size={18} />}</button>
        <p className="sp-footer-note">No payment is made here.</p>
      </aside>
    </div>
    <div className="sp-sticky-footer">{showAmounts ? <button onClick={onBreakdown} aria-label="View your share breakdown" data-testid="button-breakdown"><span className="sp-small">{closed ? 'Final share' : 'Your share'}<ChevronDown size={13} /></span><span className="sp-money">{money(me?.totalCents ?? 0)}</span></button> : <span className="sp-small">{selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected</span>}<button className={`sp-button ${finished && !closed ? 'secondary' : ''}`} data-testid="button-primary-mobile" disabled={(!ready && !closed) || pending} onClick={onPrimary}>{primaryLabel}{!finished && !closed && <Check size={18} />}</button></div>
  </>;
}

export function BreakdownLines({ bill }: { bill: BillView }) {
  const me = findPerson(bill, bill.meId);
  if (!me || !sharesVisible(bill)) return null;
  return <div className="sp-summary-lines" style={{ margin: 0 }}>
    <div><span>Items</span><span className="sp-money">{money(me.itemCents)}</span></div><div><span>Tax</span><span className="sp-money">{money(me.taxCents)}</span></div><div><span>Tip</span><span className="sp-money">{money(me.tipCents)}</span></div>
    {me.adjustmentCents !== 0 && <div><span>Total adjustment</span><span className="sp-money">{money(me.adjustmentCents)}</span></div>}
    <div><span>Total</span><strong className="sp-money">{money(me.totalCents)}</strong></div>
  </div>;
}
