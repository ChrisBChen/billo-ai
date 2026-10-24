import { useState } from 'react';
import { AlertTriangle, LockKeyhole } from 'lucide-react';
import type { BillView } from '@workspace/api-client-react';
import { Spinner } from '@/components/Chrome';
import { Sheet } from '@/components/Sheet';
import type { Change } from '@/hooks/use-bill-actions';
import { computedTotal, money } from '@/lib/billo';

export function CloseSheet({ bill, send, pending, onClose }: { bill: BillView; send: (c: Change, o?: { success?: string; onSuccess?: () => void }) => void; pending: boolean; onClose: () => void }) {
  const waiting = bill.participants.filter(p => !p.finished && !p.isPayer);
  const unclaimed = bill.splitMode === 'itemized' ? bill.receipt.items.filter(i => bill.unclaimedItemIds.includes(i.id)) : [];
  const [force, setForce] = useState(false);
  const [take, setTake] = useState(false);
  const mismatch = computedTotal(bill.receipt) !== bill.receipt.totalCents;
  const ok = !mismatch && bill.receipt.items.length > 0 && (!waiting.length || force) && (!unclaimed.length || take);
  return <Sheet title="Close the bill" description="Amounts lock and everyone sees what to pay you." onClose={onClose}
    footer={<button className="sp-button full" data-testid="button-confirm-close" disabled={!ok || pending} onClick={() => send({ action: 'close', force, takeRemaining: take }, { success: 'Bill closed. Everyone can pay you now.', onSuccess: onClose })}>{pending ? <><Spinner />Closing</> : <><LockKeyhole size={18} />Close and lock amounts</>}</button>}>
    <div className="sp-stack" style={{ gap: 14 }}>
      {mismatch && <div className="sp-notice warning"><AlertTriangle size={17} />The receipt total does not match its items, tax, and tip. Fix the receipt first.</div>}
      {waiting.length === 0 && unclaimed.length === 0 && !mismatch && <div className="sp-notice">Everyone confirmed and every item is claimed.</div>}
      {waiting.length > 0 && <label className="sp-check-row"><input type="checkbox" data-testid="checkbox-force" checked={force} onChange={e => setForce(e.target.checked)} /><span>Close without waiting<small>{waiting.map(p => p.name).join(', ')} {waiting.length === 1 ? 'has' : 'have'} not confirmed. Their current choices become final.</small></span></label>}
      {unclaimed.length > 0 && <label className="sp-check-row"><input type="checkbox" data-testid="checkbox-take-remaining" checked={take} onChange={e => setTake(e.target.checked)} /><span>I will cover the unclaimed items<small>{unclaimed.map(i => `${i.name} (${money(i.cents)})`).join(', ')} go to you, with their tax and tip.</small></span></label>}
    </div>
  </Sheet>;
}
