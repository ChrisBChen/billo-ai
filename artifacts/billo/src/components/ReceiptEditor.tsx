import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Info, Plus, Trash2 } from 'lucide-react';
import type { BillItem, BillView, ReceiptDraft } from '@workspace/api-client-react';
import { Spinner } from '@/components/Chrome';
import type { Change } from '@/hooks/use-bill-actions';
import { centsText, money, newId, parseCents, subtotalOf, tipCentsOf } from '@/lib/billo';

type Row = { id: string; name: string; price: string };
type Send = (c: Change, o?: { success?: string; onSuccess?: () => void }) => void;

function fingerprint(bill: BillView) {
  const r = bill.receipt;
  return JSON.stringify([bill.title, r.items.map(i => [i.id, i.name, i.cents, i.mode, i.units]), r.taxCents, r.tipMode, r.tipValue, r.adjustmentCents, r.totalCents]);
}

export function ReceiptEditor({ bill, draft, source, send, pending, onCancel, onSaved }: { bill: BillView; draft: ReceiptDraft; source: string; send: Send; pending: boolean; onCancel: () => void; onSaved: () => void }) {
  const [revision, setRevision] = useState(bill.revision);
  const [print, setPrint] = useState(() => fingerprint(bill));
  const current = fingerprint(bill);
  const stale = print !== current;
  useEffect(() => {
    // Identical receipt data is safe to rebase after unrelated updates or an
    // identical save in another session; genuine receipt changes need review.
    if (!stale) setRevision(bill.revision);
  }, [stale, bill.revision]);
  const [title, setTitle] = useState(draft.title || bill.title);
  const [rows, setRows] = useState<Row[]>(() => draft.items.length ? draft.items.map(i => ({ id: i.id || newId(), name: i.name, price: centsText(i.cents) })) : [{ id: newId(), name: '', price: '' }]);
  const [tax, setTax] = useState(centsText(draft.taxCents));
  const [tipMode, setTipMode] = useState(draft.tipMode);
  const [tip, setTip] = useState(draft.tipMode === 'percent' ? String(draft.tipValue / 100) : centsText(draft.tipValue));
  const [base, setBase] = useState<string | null>(() => {
    const sub = subtotalOf(draft.items);
    const initBase = draft.totalCents - tipCentsOf(sub, draft.tipMode, draft.tipValue);
    const auto = sub + draft.taxCents;
    return draft.items.length && initBase >= 0 && initBase !== auto ? centsText(initBase) : null;
  });
  const [tried, setTried] = useState(false);
  const hasClaims = bill.receipt.items.some(i => i.allocations.length > 0) || bill.participants.some(p => p.finished);

  const parsed = useMemo(() => {
    const items = rows.map(r => ({ ...r, cents: parseCents(r.price) }));
    const subtotal = subtotalOf(items.map(i => ({ cents: i.cents ?? 0 })));
    const taxCents = parseCents(tax);
    const tipRaw = tip.trim();
    const tipNum = tipMode === 'percent' ? (/^\d*(\.\d{0,2})?$/.test(tipRaw) && tipRaw !== '' && Number(tipRaw) <= 100 ? Math.round(Number(tipRaw) * 100) : null) : parseCents(tip);
    const tipCents = tipNum === null ? 0 : tipCentsOf(subtotal, tipMode, tipNum);
    const autoBase = subtotal + (taxCents ?? 0);
    const baseCents = base === null ? autoBase : parseCents(base);
    const adjustmentCents = (baseCents ?? autoBase) - autoBase;
    const totalCents = (baseCents ?? autoBase) + tipCents;
    return { items, subtotal, taxCents, tipNum, tipCents, autoBase, baseCents, adjustmentCents, totalCents };
  }, [rows, tax, tip, tipMode, base]);
  const rowErrors = parsed.items.map(i => !i.name.trim() ? 'Name needed' : i.cents === null ? 'Price needed' : i.cents > 1000000 ? 'Too large' : '');
  const valid = !!title.trim() && rows.length > 0 && rowErrors.every(e => !e) && parsed.taxCents !== null && parsed.tipNum !== null && parsed.baseCents !== null;

  function update(id: string, patch: Partial<Row>) { setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r)); }
  function changeTipMode(mode: 'amount' | 'percent') {
    if (mode === tipMode) return;
    setTip(mode === 'amount' ? centsText(parsed.tipCents) : parsed.subtotal ? Math.min(100, parsed.tipCents / parsed.subtotal * 100).toFixed(2).replace(/\.?0+$/, '') : '20');
    setTipMode(mode);
  }
  function keepDraft() { setRevision(bill.revision); setPrint(current); }
  function save() {
    setTried(true);
    if (!valid || pending || stale) return;
    const existing = new Map(bill.receipt.items.map(i => [i.id, i]));
    const items: BillItem[] = parsed.items.map(i => {
      const prev = existing.get(i.id);
      return { id: i.id, name: i.name.trim(), cents: i.cents ?? 0, units: 1, mode: 'equal', allocations: prev?.allocations ?? [] };
    });
    send({ revision, action: 'receipt', receipt: { title: title.trim(), items, taxCents: parsed.taxCents ?? 0, tipMode, tipValue: parsed.tipNum ?? 0, adjustmentCents: parsed.adjustmentCents, totalCents: parsed.totalCents, warnings: [] } }, { success: 'Receipt and tip confirmed', onSuccess: onSaved });
  }

  return <div className="sp-card sp-pad sp-stack sp-content">
    {stale && <div className="sp-notice warning" role="alert"><div>The receipt was changed in another session. Saving your draft replaces it; choices on items whose price changed will be cleared.<div className="sp-actions" style={{ marginTop: 8 }}><button className="sp-link" data-testid="button-keep-draft" onClick={keepDraft}>Keep my draft</button><button className="sp-link" data-testid="button-discard-draft" onClick={onCancel}>Cancel and reopen</button></div></div></div>}
    <div className="sp-row sp-between"><span className="sp-small sp-muted">{source}</span><span className="sp-pill muted">Not saved yet</span></div>
    {draft.warnings.length > 0 && <div className="sp-notice warning"><AlertTriangle size={17} /><div>{draft.warnings.map(w => <div key={w}>{w}</div>)}</div></div>}
    {hasClaims && <div className="sp-notice"><Info size={17} />Choices stay on unchanged items. Changing an item's price clears choices for that item.</div>}
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
    <button className="sp-link" data-testid="button-add-item" disabled={rows.length >= 100} onClick={() => setRows(prev => [...prev, { id: newId(), name: '', price: '' }])}><Plus size={19} />Add item</button>
    <div className="sp-totals">
      <div className="sp-row"><span>Subtotal</span><strong className="sp-money" data-testid="text-subtotal">{money(parsed.subtotal)}</strong></div>
      <div className="sp-row"><label htmlFor="r-tax">Tax ($)</label><input id="r-tax" data-testid="input-tax" className="sp-amount-input" inputMode="decimal" value={tax} onChange={e => setTax(e.target.value)} /></div>
      <div className="sp-stack" style={{ gap: 10 }}>
        <div className="sp-row sp-between"><span>Tip</span><strong className="sp-money">{money(parsed.tipCents)}</strong></div>
        <div className="sp-segments two">{(['percent', 'amount'] as const).map(m => <button key={m} data-testid={`button-tip-${m}`} className={tipMode === m ? 'active' : ''} onClick={() => changeTipMode(m)}>{m === 'percent' ? 'Percent' : 'Amount'}</button>)}</div>
        {tipMode === 'percent' && <div className="sp-presets">{['15', '18', '20', '22'].map(p => <button key={p} className={tip === p ? 'active' : ''} onClick={() => setTip(p)}>{p}%</button>)}</div>}
        <div className="sp-row sp-between"><label htmlFor="r-tip" className="sp-small sp-muted">{tipMode === 'percent' ? 'Percent of pre-tax subtotal' : 'Fixed amount ($)'}</label><div className="sp-number-wrap"><input id="r-tip" data-testid="input-tip" inputMode="decimal" value={tip} onChange={e => setTip(e.target.value)} />{tipMode === 'percent' && <span className="sp-suffix">%</span>}</div></div>
      </div>
      <div className="sp-row"><label htmlFor="r-base">Receipt total before tip{base !== null && <><br /><button className="sp-link sp-small" data-testid="button-use-item-total" onClick={() => setBase(null)}>Use item total</button></>}</label><input id="r-base" data-testid="input-base-total" className="sp-amount-input" inputMode="decimal" value={base ?? centsText(parsed.autoBase)} onChange={e => setBase(e.target.value)} /></div>
      <div className="sp-row sp-total-row"><span>Total with tip</span><strong className="sp-money" data-testid="text-total">{money(parsed.totalCents)}</strong></div>
    </div>
    {tried && !valid && <p className="sp-error-text">Check the item names and amounts. Amounts must not be negative; tip can be up to 100%.</p>}
    <div className="sp-actions"><button className="sp-button secondary" data-testid="button-cancel-receipt" onClick={onCancel}>Cancel</button><button className="sp-button" data-testid="button-save-receipt" disabled={pending || stale || (tried && !valid)} onClick={save}>{pending ? <><Spinner />Confirming</> : <>Confirm receipt &amp; tip<Check size={18} /></>}</button></div>
  </div>;
}
