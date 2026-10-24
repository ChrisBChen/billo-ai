import { CircleCheck, Clock3, LockKeyhole, RotateCcw, Users, Utensils } from 'lucide-react';
import type { BillView } from '@workspace/api-client-react';
import { Avatar } from '@/components/Chrome';
import type { Change } from '@/hooks/use-bill-actions';
import { money } from '@/lib/billo';

export function GroupView({ bill, send, pending, onClose, onPay }: { bill: BillView; send: (c: Change, o?: { success?: string }) => void; pending: boolean; onClose: () => void; onPay: () => void }) {
  const isHost = bill.meId === bill.payerId, closed = bill.status === 'closed';
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
          {p.isPayer ? <span className="sp-status done"><Utensils size={13} />Paid the restaurant</span>
            : closed ? <span className={`sp-payment-status ${p.paid ? 'paid' : ''}`}>{p.paid ? <><CircleCheck size={13} />Reported paid</> : <><Clock3 size={13} />Not paid yet</>}</span>
            : <span className={`sp-status ${p.finished ? 'done' : ''}`}>{p.finished ? <><CircleCheck size={13} />Confirmed</> : <><Clock3 size={13} />Choosing</>}</span>}
          {p.isPayer && !closed && <span className={`sp-status ${p.finished ? 'done' : ''}`} style={{ marginLeft: 8 }}>{p.finished ? 'Confirmed' : 'Choosing'}</span>}
        </div>
        <span className="sp-money">{money(p.totalCents)}</span>
      </div>)}
      {bill.participants.length === 1 && <p className="sp-small sp-muted" style={{ padding: '12px 0' }}>Nobody else has joined yet. Share the link from Invite.</p>}
    </div>
    {unclaimed.length > 0 && !closed && <div className="sp-card sp-pad"><h3>Unclaimed items</h3><div className="sp-unclaimed" style={{ marginTop: 8 }}>{unclaimed.map(i => <div key={i.id} className="sp-row sp-between"><span>{i.name}</span><span className="sp-money">{money(i.cents)}</span></div>)}</div></div>}
    {isHost && !closed && <div className="sp-card sp-pad sp-stack" style={{ gap: 14 }}>
      <h3>Split method</h3>
      {(['itemized', 'equal'] as const).map(m => <button key={m} data-testid={`button-mode-${m}`} className={`sp-choice ${bill.splitMode === m ? 'selected' : ''}`} disabled={pending || bill.splitMode === m} onClick={() => send({ action: 'mode', splitMode: m }, { success: m === 'equal' ? 'Splitting the total equally' : 'Splitting by items' })}>
        {m === 'equal' ? <Users size={24} /> : <Utensils size={24} />}<div className="sp-grow"><h3>{m === 'equal' ? 'Split the total equally' : 'Everyone chooses items'}</h3><p className="sp-small">{m === 'equal' ? 'Same amount for each person' : 'Share items equally, by $, %, or units'}</p></div></button>)}
      <button className="sp-link" data-testid="button-reopen" disabled={pending || confirmed === 0} onClick={() => send({ action: 'reopen' }, { success: 'Confirmations cleared. Everyone will re-confirm.' })}><RotateCcw size={16} />Ask everyone to confirm again</button>
      <button className="sp-button full" data-testid="button-open-close" disabled={pending || !bill.receipt.items.length} onClick={onClose}><LockKeyhole size={18} />Close bill</button>
    </div>}
    {!isHost && !closed && <p className="sp-small sp-muted">{bill.participants.find(p => p.isPayer)?.name} closes the bill when everyone is done. You will see what to pay right away.</p>}
    {closed && !isHost && <button className="sp-button full" data-testid="button-open-payment" onClick={onPay}>Pay {bill.participants.find(p => p.isPayer)?.name}</button>}
    {closed && isHost && <p className="sp-small sp-muted">Paid marks are reported by each person and are not verified. Only they can change their own.</p>}
  </div>;
}
