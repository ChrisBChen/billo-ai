import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import type { BillItem, BillView } from '@workspace/api-client-react';
import { Spinner } from '@/components/Chrome';
import { Sheet } from '@/components/Sheet';
import type { Change } from '@/hooks/use-bill-actions';
import { centsText, fmtAlloc, itemTarget, methodText, money, parseCents } from '@/lib/billo';

export function ClaimSheet({ bill, item, send, pending, onClose }: { bill: BillView; item: BillItem; send: (c: Change, o?: { success?: string; onSuccess?: () => void }) => void; pending: boolean; onClose: () => void }) {
  const mine = item.allocations.find(a => a.participantId === bill.meId)?.value ?? 0;
  const others = item.allocations.filter(a => a.participantId !== bill.meId).reduce((s, a) => s + Math.max(0, a.value), 0);
  const target = itemTarget(item);
  const max = Math.max(0, target - others);
  const [text, setText] = useState(() => mine ? (item.mode === 'units' ? String(mine) : item.mode === 'percent' ? String(mine / 100) : centsText(mine)) : '');
  const configuration = `${item.mode}:${item.units}:${item.cents}`;
  const previousConfiguration = useRef(configuration);
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    if (previousConfiguration.current !== configuration) {
      previousConfiguration.current = configuration;
      setText(mine ? (item.mode === 'units' ? String(mine) : item.mode === 'percent' ? String(mine / 100) : centsText(mine)) : '');
      setUpdated(true);
    }
  }, [configuration, mine, item.mode]);
  const t = text.trim();
  const value = t === '' ? 0 : item.mode === 'units' ? (/^\d+$/.test(t) ? Number(t) : null) : parseCents(t);
  const valid = value !== null && value >= 0 && value <= max;
  const preview = valid && target > 0 ? Math.round(item.cents * value / target) : 0;
  function save() {
    if (!valid || value === null || pending) return;
    send({ action: 'allocate', itemId: item.id, itemMode: item.mode, units: item.units, allocations: value > 0 ? [{ participantId: bill.meId, value }] : [] }, { success: value > 0 ? 'Claim saved' : 'Claim cleared', onSuccess: onClose });
  }
  return <Sheet title={item.name} description={`${money(item.cents)} · ${methodText(item)}`} onClose={onClose}
    footer={<button className="sp-button full" data-testid="button-save-claim" disabled={!valid || pending} onClick={save}>{pending ? <><Spinner />Saving</> : <>{value === 0 ? 'Clear my claim' : 'Save'}<Check size={18} /></>}</button>}>
    {updated && <div className="sp-notice" role="status">The payer updated this item. Review the new total and enter your claim.</div>}
    <div className="sp-stack" style={{ gap: 12 }}>
      <div className="sp-summary-lines" style={{ margin: 0 }}>
        <div><span>Total</span><span className="sp-money">{fmtAlloc(item, target)}</span></div>
        <div><span>Others</span><span className="sp-money" data-testid="text-others-claimed">{fmtAlloc(item, others)}</span></div>
        <div><span>Max for you</span><strong className="sp-money" data-testid="text-claim-max">{fmtAlloc(item, max)}</strong></div>
      </div>
      <label className="sp-field">{item.mode === 'amount' ? 'Your amount ($)' : item.mode === 'percent' ? 'Your percent' : 'Your units'}
        <div className={`sp-number-wrap ${item.mode === 'amount' ? 'currency' : ''}`}>{item.mode === 'amount' && <span className="sp-prefix">$</span>}<input data-testid="input-claim" inputMode={item.mode === 'units' ? 'numeric' : 'decimal'} value={text} placeholder="0" onChange={e => setText(e.target.value)} />{item.mode === 'percent' && <span className="sp-suffix">%</span>}</div>
      </label>
      <div className="sp-row" style={{ gap: 8 }}><button className="sp-link" data-testid="button-claim-max" disabled={!max} onClick={() => setText(item.mode === 'units' ? String(max) : item.mode === 'percent' ? String(max / 100) : centsText(max))}>Take all left</button><button className="sp-link" data-testid="button-claim-clear" onClick={() => setText('')}>Clear</button></div>
      <div className={`sp-allocation-progress ${valid ? 'valid' : 'invalid'}`} role="status">{valid ? <Check size={18} /> : <AlertTriangle size={18} />}
        <div>{value === null ? <strong>{item.mode === 'units' ? 'Whole numbers only' : 'Up to two decimals'}</strong> : !valid ? <strong>Max {fmtAlloc(item, max)}</strong> : <strong>{value ? `About ${money(preview)} before tax and tip` : 'No claim'}</strong>}</div></div>
    </div>
  </Sheet>;
}
