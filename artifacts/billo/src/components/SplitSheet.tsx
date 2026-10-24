import { useState } from 'react';
import { AlertTriangle, Check, Minus, Plus } from 'lucide-react';
import type { BillItem, BillView } from '@workspace/api-client-react';
import { Avatar, Spinner } from '@/components/Chrome';
import { Sheet } from '@/components/Sheet';
import type { Change } from '@/hooks/use-bill-actions';
import { centsText, distribute, money, parseCents } from '@/lib/billo';

type Mode = BillItem['mode'];
const modeNames: Record<Mode, string> = { equal: 'Equal', amount: 'Amount', percent: 'Percent', units: 'Units' };

export function SplitSheet({ bill, item, send, pending, onClose }: { bill: BillView; item: BillItem; send: (c: Change, o?: { success?: string; onSuccess?: () => void }) => void; pending: boolean; onClose: () => void }) {
  const [people] = useState(bill.participants);
  const [revision] = useState(bill.revision);
  const stale = revision !== bill.revision;
  const allocOf = (pid: string) => item.allocations.find(a => a.participantId === pid)?.value ?? 0;
  const [mode, setMode] = useState<Mode>(item.mode);
  const [checked, setChecked] = useState<boolean[]>(() => people.map(p => item.allocations.length ? allocOf(p.id) > 0 : p.id === bill.meId));
  const [values, setValues] = useState<string[]>(() => people.map(p => {
    const v = allocOf(p.id);
    return item.mode === 'amount' ? centsText(v) : item.mode === 'percent' ? String(v / 100) : String(v);
  }));
  const [units, setUnits] = useState(String(item.units || 1));
  const unitsN = /^\d+$/.test(units) ? Number(units) : NaN;
  const unitsValid = unitsN >= 1 && unitsN <= 10000;
  const nums = values.map(v => mode === 'units' ? (/^\d+$/.test(v.trim()) ? Number(v) : v.trim() === '' ? 0 : null) : v.trim() === '' ? 0 : parseCents(v));
  const inputsValid = nums.every(n => n !== null);
  const target = mode === 'percent' ? 10000 : mode === 'units' ? unitsN : item.cents;
  const sum = nums.reduce<number>((a, b) => a + (b ?? 0), 0);
  const remaining = target - sum;
  const valid = mode === 'equal' ? checked.some(Boolean) : inputsValid && (mode === 'percent' ? remaining >= 0 : remaining === 0 && sum > 0) && (mode !== 'units' || unitsValid);
  const preview = mode === 'equal' ? distribute(item.cents, checked.map(Number))
    : mode === 'amount' ? nums.map(n => n ?? 0)
    : mode === 'percent' && valid ? distribute(item.cents, [...nums.map(n => n ?? 0), remaining]).slice(0, people.length)
    : valid ? distribute(item.cents, nums.map(n => n ?? 0))
    : nums.map(n => target > 0 ? Math.round(item.cents * (n ?? 0) / target) : 0);

  function switchMode(next: Mode) {
    if (next === mode) return;
    const weights = mode === 'equal' ? checked.map(Number) : nums.map(n => n ?? 0);
    const w = weights.some(Boolean) ? weights : people.map(p => p.id === bill.meId ? 1 : 0);
    const u = unitsValid ? unitsN : 1;
    if (next === 'equal') setChecked(w.map(x => x > 0));
    else setValues(next === 'amount' ? distribute(item.cents, w).map(centsText) : next === 'percent' ? distribute(10000, w).map(n => String(n / 100)) : distribute(u, w).map(String));
    setMode(next);
  }
  function setValue(i: number, v: string) { setValues(prev => prev.map((x, j) => j === i ? v : x)); }
  function step(i: number, d: number) { setValue(i, String(Math.max(0, (nums[i] ?? 0) + d))); }
  function save() {
    if (!valid || pending || stale) return;
    const allocations = mode === 'equal'
      ? people.filter((_, i) => checked[i]).map(p => ({ participantId: p.id, value: 1 }))
      : people.map((p, i) => ({ participantId: p.id, value: nums[i] ?? 0 })).filter(a => a.value > 0);
    send({ revision, action: 'allocate', itemId: item.id, itemMode: mode, units: mode === 'units' ? unitsN : item.units || 1, allocations }, { success: 'Split saved', onSuccess: onClose });
  }
  const unit = mode === 'percent' ? '%' : mode === 'units' ? ' units' : '';
  const fmt = (n: number) => mode === 'amount' ? money(n) : mode === 'percent' ? `${n / 100}%` : `${n} units`;

  return <Sheet title={item.name} description={`${money(item.cents)} · split between anyone at the table`} onClose={onClose}
    footer={<button className="sp-button full" data-testid="button-save-split" disabled={!valid || pending || stale} onClick={save}>{pending ? <><Spinner />Saving</> : <>Save split<Check size={18} /></>}</button>}>
    {stale && <div className="sp-notice warning" role="alert">The bill changed while you were editing. Close and reopen this split to use the latest amounts.<button className="sp-link" onClick={onClose}>Close editor</button></div>}
    <div className="sp-segments" role="tablist">{(Object.keys(modeNames) as Mode[]).map(m => <button key={m} role="tab" aria-selected={mode === m} data-testid={`button-split-${m}`} className={mode === m ? 'active' : ''} onClick={() => switchMode(m)}>{modeNames[m]}</button>)}</div>
    {mode === 'units' && <label className="sp-units-setting">How many units on this item? (slices, glasses)<input data-testid="input-units-total" inputMode="numeric" value={units} onChange={e => setUnits(e.target.value)} /></label>}
    <div className="sp-allocation-list">{people.map((p, i) => <div className="sp-allocation-row" key={p.id}>
      {mode === 'equal'
        ? <button className="sp-equal-check" aria-pressed={checked[i]} data-testid={`toggle-split-${p.id}`} onClick={() => setChecked(prev => prev.map((x, j) => j === i ? !x : x))}>
            <span className={`sp-checkbox ${checked[i] ? 'checked' : ''}`}>{checked[i] && <Check size={16} strokeWidth={2.5} />}</span><Avatar name={p.name} index={i} /><span className="sp-name">{p.id === bill.meId ? 'You' : p.name}<small>{checked[i] ? money(preview[i]) : 'Not sharing'}</small></span>
          </button>
        : <><Avatar name={p.name} index={i} /><span className="sp-name">{p.id === bill.meId ? 'You' : p.name}<small>{money(preview[i] ?? 0)}</small></span>
          {mode === 'units'
            ? <div className="sp-stepper"><button aria-label={`Fewer units for ${p.name}`} onClick={() => step(i, -1)}><Minus size={16} /></button><input aria-label={`Units for ${p.name}`} inputMode="numeric" value={values[i]} onChange={e => setValue(i, e.target.value)} data-testid={`input-split-${p.id}`} /><button aria-label={`More units for ${p.name}`} onClick={() => step(i, 1)}><Plus size={16} /></button></div>
            : <div className={`sp-number-wrap ${mode === 'amount' ? 'currency' : ''}`}>{mode === 'amount' && <span className="sp-prefix">$</span>}<input aria-label={`${modeNames[mode]} for ${p.name}`} inputMode="decimal" value={values[i]} onChange={e => setValue(i, e.target.value)} data-testid={`input-split-${p.id}`} />{mode === 'percent' && <span className="sp-suffix">%</span>}</div>}
        </>}
    </div>)}</div>
    {mode !== 'equal' && <div className={`sp-allocation-progress ${valid ? 'valid' : !inputsValid || remaining < 0 ? 'invalid' : ''}`} role="status">
      {valid ? <Check size={18} /> : <AlertTriangle size={18} />}
      <div>{!inputsValid ? <strong>{mode === 'units' ? 'Use whole numbers' : 'Use numbers with up to two decimals'}</strong>
        : mode === 'units' && !unitsValid ? <strong>Set the unit count between 1 and 10,000</strong>
        : valid && remaining > 0 ? <><strong>{fmt(remaining)} left for others</strong><small>You can save your share now. The remainder must be assigned before closing.</small></>
        : valid ? <strong>Fully allocated</strong>
        : <><strong>{remaining > 0 ? `${fmt(remaining)} left to assign` : `${fmt(-remaining)} over`}</strong><small>Must total {fmt(target)}{unit && ''}</small></>}</div>
    </div>}
    {item.mode !== 'equal' || item.allocations.length ? null : <p className="sp-small sp-muted" style={{ marginTop: 12 }}>Anyone can edit shared splits. Changes update for everyone.</p>}
  </Sheet>;
}
