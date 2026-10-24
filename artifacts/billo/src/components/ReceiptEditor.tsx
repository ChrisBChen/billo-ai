import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Info, Plus, Trash2 } from 'lucide-react';
import type { BillItem, BillView, ReceiptDraft } from '@workspace/api-client-react';
import { Spinner } from '@/components/Chrome';
import type { Change } from '@/hooks/use-bill-actions';
import { centsText, money, newId, parseCents, subtotalOf, tipCentsOf } from '@/lib/billo';

type Row = { id: string; name: string; price: string; units: number };
type Send = (c: Change, o?: { success?: string; onSuccess?: () => void }) => void;

export function ReceiptEditor({ bill, draft, source, send, pending, onCancel, onSaved }: { bill: BillView; draft: ReceiptDraft; source: string; send: Send; pending: boolean; onCancel: () => void; onSaved: () => void }) {
  const [revision, setRevision] = useState(bill.revision);
  const stale = revision !== bill.revision;
  const [title, setTitle] = useState(draft.title || bill.title);
  const [rows, setRows] = useState<Row[]>(() => draft.items.length ? draft.items.map(i => ({ id: i.id || newId(), name: i.name, price: centsText(i.cents), units: i.units || 1 })) : [{ id: newId(), name: '', price: '', units: 1 }]);
  const [tax, setTax] = useState(centsText(draft.taxCents));
  const [tipMode, setTipMode] = useState(draft.tipMode);
  const [tip, setTip] = useState(draft.tipMode === 'percent' ? String(draft.tipValue / 100) : centsText(draft.tipValue));
  const [adj, setAdj] = useState(centsText(draft.adjustmentCents));
  const [total, setTotal] = useState(centsText(draft.totalCents));
  const [tried, setTried] = useState(false);
  const hasClaims = bill.receipt.items.some(i => i.allocations.length > 0) || bill.participants.some(p => p.finished);

  const parsed = useMemo(() => {
    const items = rows.map(r => ({ ...r, cents: parseCents(r.price) }));
    const subtotal = subtotalOf(items.map(i => ({ cents: i.cents ?? 0 })));
    const taxCents = parseCents(tax);
    const tipNum = tipMode === 'percent' ? (/^\d*(\.\d{0,2})?$/.test(tip.trim()) && tip.trim() !== '' ? Math.round(Number(tip) * 100) : null) : parseCents(tip);
    const adjustmentCents = parseCents(adj, true);
    const totalCents = parseCents(total);
    const tipCents = tipNum === null ? 0 : tipCentsOf(subtotal, tipMode, tipNum);
    const computed = subtotal + (taxCents ?? 0) + tipCents + (adjustmentCents ?? 0);
    return { items, subtotal, taxCents, tipNum, tipCents, adjustmentCents, totalCents, computed };
  }, [rows, tax, tip, tipMode, adj, total]);
  const rowErrors = parsed.items.map(i => !i.name.trim() ? 'Name needed' : i.cents === null ? 'Price needed' : i.cents > 1000000 ? 'Too large' : '');
  const fieldsValid = !!title.trim() && rows.length > 0 && rowErrors.every(e => !e) && parsed.taxCents !== null && parsed.tipNum !== null && parsed.adjustmentCents !== null && parsed.totalCents !== null;
  const mismatch = parsed.totalCents !== null && parsed.totalCents !== parsed.computed;
  const valid = fieldsValid && !mismatch && parsed.computed >= 0;

  function update(id: string, patch: Partial<Row>) { setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r)); }
  function changeTipMode(mode: 'amount' | 'percent') {
    if (mode === tipMode) return;
    setTip(mode === 'amount' ? centsText(parsed.tipCents) : parsed.subtotal ? (parsed.tipCents / parsed.subtotal * 100).toFixed(2).replace(/\.?0+$/, '') : '20');
    setTipMode(mode);
  }
  function save() {
    setTried(true);
    if (!valid || pending || stale) return;
    const existing = new Map(bill.receipt.items.map(i => [i.id, i]));
    const items: BillItem[] = parsed.items.map(i => {
      const prev = existing.get(i.id);
      return { id: i.id, name: i.name.trim(), cents: i.cents ?? 0, units: i.units, mode: prev?.mode ?? 'equal', allocations: prev?.allocations ?? [] };
    });
    send({ revision, action: 'receipt', receipt: { title: title.trim(), items, taxCents: parsed.taxCents ?? 0, tipMode, tipValue: parsed.tipNum ?? 0, adjustmentCents: parsed.adjustmentCents ?? 0, totalCents: parsed.totalCents ?? 0, warnings: [] } }, { success: 'Receipt saved', onSuccess: onSaved });
  }

  return <div className="sp-card sp-pad sp-stack sp-content">
    {stale && <div className="sp-notice warning" role="alert"><div>The bill changed while you were editing. Saving this draft will replace the current receipt and reset everyone's choices.<button className="sp-link" onClick={() => setRevision(bill.revision)}>I understand — keep my draft</button></div></div>}
    <div className="sp-row sp-between"><span className="sp-small sp-muted">{source}</span><span className="sp-pill muted">Not saved yet</span></div>
    {draft.warnings.length > 0 && <div className="sp-notice warning"><AlertTriangle size={17} /><div>{draft.warnings.map(w => <div key={w}>{w}</div>)}</div></div>}
    {hasClaims && <div className="sp-notice"><Info size={17} />Saving changes resets everyone's item choices and confirmations.</div>}
    <label className="sp-field">Bill name<input data-testid="input-receipt-title" value={title} maxLength={100} onChange={e => setTitle(e.target.value)} /></label>
    <div className="sp-receipt-items">{rows.map((r, idx) => <div key={r.id}>
      <div className="sp-receipt-row">
        <input data-testid={`input-item-name-${idx}`} aria-label={`Item ${idx + 1} name`} value={r.name} maxLength={120} placeholder="Item" onChange={e => update(r.id, { name: e.target.value })} />
        <input data-testid={`input-item-price-${idx}`} inputMode="decimal" aria-label={`Item ${idx + 1} price in dollars`} value={r.price} placeholder="0.00" onChange={e => update(r.id, { price: e.target.value })} style={{ textAlign: 'right' }} />
        <button className="sp-icon" data-testid={`button-remove-item-${idx}`} aria-label={`Remove ${r.name || 'item'}`} onClick={() => setRows(prev => prev.filter(x => x.id !== r.id))}><Trash2 size={18} /></button>
      </div>
      {tried && rowErrors[idx] && <span className="sp-error-text">{rowErrors[idx]}</span>}
    </div>)}</div>
    {!rows.length && <p className="sp-small sp-muted">Add at least one item.</p>}
    <button className="sp-link" data-testid="button-add-item" disabled={rows.length >= 100} onClick={() => setRows(prev => [...prev, { id: newId(), name: '', price: '', units: 1 }])}><Plus size={19} />Add item</button>
    <div className="sp-totals">
      <div className="sp-row"><span>Subtotal</span><strong className="sp-money" data-testid="text-subtotal">{money(parsed.subtotal)}</strong></div>
      <div className="sp-row"><label htmlFor="r-tax">Tax ($)</label><input id="r-tax" data-testid="input-tax" className="sp-amount-input" inputMode="decimal" value={tax} onChange={e => setTax(e.target.value)} /></div>
      <div className="sp-stack" style={{ gap: 10 }}>
        <div className="sp-row sp-between"><span>Tip</span><strong className="sp-money">{money(parsed.tipCents)}</strong></div>
        <div className="sp-segments two">{(['percent', 'amount'] as const).map(m => <button key={m} data-testid={`button-tip-${m}`} className={tipMode === m ? 'active' : ''} onClick={() => changeTipMode(m)}>{m === 'percent' ? 'Percent' : 'Amount'}</button>)}</div>
        {tipMode === 'percent' && <div className="sp-presets">{['15', '18', '20', '22'].map(p => <button key={p} className={tip === p ? 'active' : ''} onClick={() => setTip(p)}>{p}%</button>)}</div>}
        <div className="sp-row sp-between"><label htmlFor="r-tip" className="sp-small sp-muted">{tipMode === 'percent' ? 'Percent of pre-tax subtotal' : 'Fixed amount ($)'}</label><div className="sp-number-wrap"><input id="r-tip" data-testid="input-tip" inputMode="decimal" value={tip} onChange={e => setTip(e.target.value)} />{tipMode === 'percent' && <span className="sp-suffix">%</span>}</div></div>
      </div>
      <div className="sp-row"><label htmlFor="r-adj">Fees or discounts ($)<br /><span className="sp-small sp-muted">Negative for discounts</span></label><input id="r-adj" data-testid="input-adjustment" className="sp-amount-input" inputMode="decimal" value={adj} onChange={e => setAdj(e.target.value)} /></div>
      <div className="sp-row sp-total-row"><label htmlFor="r-total">Receipt total</label><input id="r-total" data-testid="input-total" className="sp-amount-input" inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} /></div>
    </div>
    {mismatch && <div className="sp-allocation-progress invalid" role="alert"><AlertTriangle size={18} /><div className="sp-grow"><strong>Total does not add up</strong><small>Items, tax, tip, and adjustments come to {money(parsed.computed)}. The receipt says {money(parsed.totalCents ?? 0)}.</small>
      <div className="sp-actions" style={{ marginTop: 8 }}><button className="sp-link" data-testid="button-use-computed" onClick={() => setTotal(centsText(parsed.computed))}>Use {money(parsed.computed)}</button>{parsed.adjustmentCents !== null && <button className="sp-link" data-testid="button-balance-adjustment" onClick={() => setAdj(centsText((parsed.adjustmentCents ?? 0) + (parsed.totalCents ?? 0) - parsed.computed))}>Balance with adjustment</button>}</div></div></div>}
    {!mismatch && fieldsValid && <div className="sp-allocation-progress valid"><Check size={18} />Everything adds up to {money(parsed.computed)}</div>}
    {tried && !fieldsValid && <p className="sp-error-text">Fix the highlighted fields. Prices use dollars and cents, like 12.50.</p>}
    <div className="sp-actions"><button className="sp-button secondary" data-testid="button-cancel-receipt" onClick={onCancel}>Cancel</button><button className="sp-button" data-testid="button-save-receipt" disabled={pending || stale || (tried && !valid)} onClick={save}>{pending ? <><Spinner />Saving</> : <>Save receipt<Check size={18} /></>}</button></div>
  </div>;
}
