import { Link } from 'wouter';
import { CircleCheck, Plus, Clock3, LockKeyhole, RotateCcw, Utensils } from 'lucide-react';
import type { BillView } from '@workspace/api-client-react';
import { Avatar } from '@/components/Chrome';
import type { Change } from '@/hooks/use-bill-actions';
import { billReady, money } from '@/lib/billo';

export function GroupView({ bill, send, pending, onClose }: { bill: BillView; send: (c: Change, o?: { success?: string }) => void; pending: boolean; onClose: () => void }) {
  if (bill.meId !== bill.payerId) return null;
  const closed = bill.status === 'closed';
  const others = bill.participants.filter(p => !p.isPayer);
  const confirmed = bill.participants.filter(p => p.finished).length;
  const paidCount = others.filter(p => p.paid).length;
  const unclaimed = bill.splitMode === 'itemized' ? bill.receipt.items.filter(i => bill.unclaimedItemIds.includes(i.id)) : [];
  return <div className="sp-stack sp-content">
    {closed ? <div className="sp-payment-overview" data-testid="status-payments"><div><small>Still owed to {bill.participants.find(p => p.isPayer)?.name}</small><strong className="sp-money">{money(bill.outstandingCents)}</strong></div><div><small>Reported paid</small><strong>{paidCount} of {others.length}</strong></div></div>
      : <div className="sp-payment-overview" data-testid="status-confirmed"><div><small>Confirmed</small><strong>{confirmed} of {bill.participants.length}</strong></div><div><small>Unclaimed</small><strong>{bill.splitMode === 'equal' ? 'None' : unclaimed.length}</strong></div></div>}
    <div className="sp-card sp-pad" style={{ paddingTop: 4, paddingBottom: 4 }}>
      {bill.participants.map((p, i) => <div className="sp-person-row" key={p.id} data-testid={`row-person-${p.id}`}>
        <Avatar name={p.name} index={i} />
        <div className="sp-grow"><h3>{p.name}{p.id === bill.meId ? ' (you)' : ''}</h3>
          {closed && p.isPayer ? <span className="sp-status done"><Utensils size={13} />Paid the restaurant</span>
            : closed ? <span className={`sp-payment-status ${p.paid ? 'paid' : ''}`}>{p.paid ? <><CircleCheck size={13} />Reported paid</> : <><Clock3 size={13} />Not paid yet</>}</span>
            : <span className={`sp-status ${p.finished ? 'done' : ''}`}>{p.finished ? <><CircleCheck size={13} />Confirmed</> : <><Clock3 size={13} />Choosing</>}</span>}
        </div>
        <span className="sp-money" data-testid={`amount-person-${p.id}`}>{money(p.totalCents)}</span>
      </div>)}
      {bill.participants.length === 1 && <p className="sp-small sp-muted" style={{ padding: '12px 0' }}>Nobody else has joined yet. Share the link from Invite.</p>}
    </div>
    {unclaimed.length > 0 && !closed && <div className="sp-card sp-pad"><h3>Unselected items</h3><div className="sp-unclaimed" style={{ marginTop: 8 }}>{unclaimed.map(i => <div key={i.id} className="sp-row sp-between"><span>{i.name}</span><span className="sp-money">{money(i.cents)}</span></div>)}</div></div>}
    {!closed && <div className="sp-card sp-pad sp-stack" style={{ gap: 14 }}>
      <button className="sp-link" data-testid="button-reopen" disabled={pending || confirmed === 0} onClick={() => send({ action: 'reopen' }, { success: 'Confirmations cleared. Everyone will re-confirm.' })}><RotateCcw size={16} />Ask everyone to confirm again</button>
      <button className="sp-button full" data-testid="button-open-close" disabled={pending || !billReady(bill)} onClick={onClose}><LockKeyhole size={18} />Close bill</button>
    </div>}
    {closed && <p className="sp-small sp-muted">Paid marks are reported by each person and are not verified. Only they can change their own.</p>}
    {closed && <Link href="/" className="sp-link" data-testid="link-new-receipt"><Plus size={16} />Start new receipt</Link>}
  </div>;
}
