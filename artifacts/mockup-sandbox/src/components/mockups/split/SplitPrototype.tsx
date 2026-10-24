import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronRight, CircleCheck, Clock3, Copy, Divide, Info, Link2, LockKeyhole, Minus, Plus, ReceiptText, ScanLine, Share2, Trash2, Upload, Users, Utensils, X } from 'lucide-react';
import './SplitPrototype.css';

type Page = 'select' | 'setup' | 'entry' | 'review' | 'method' | 'share' | 'join' | 'waiting' | 'dashboard' | 'final';
type SplitMode = 'equal' | 'amount' | 'percent' | 'units';
type TipMode = 'amount' | 'percent';
type PaymentMethod = 'venmo' | 'zelle' | null;
type Item = { id: number; name: string; cents: number; claims: number[]; mode?: SplitMode; values?: number[]; units?: number };
type SplitDraft = { id: number; mode: SplitMode; people: boolean[]; values: string[]; units: string };
type ModalKind = 'person' | 'close' | 'payment' | 'tip' | 'breakdown' | null;

const initialItems: Item[] = [
  { id: 1, name: 'Burrata & stone fruit', cents: 1800, claims: [0, 1, 2, 3], units: 1 },
  { id: 2, name: 'Spicy rigatoni', cents: 2600, claims: [1], units: 1 },
  { id: 3, name: 'Wood-fired branzino', cents: 3400, claims: [0], units: 1 },
  { id: 4, name: 'Wild mushroom pizza', cents: 2400, claims: [2, 3], units: 8 },
  { id: 5, name: 'Little gem salad', cents: 1400, claims: [], units: 1 },
  { id: 6, name: 'Orange wine · 2 glasses', cents: 2800, claims: [0, 1], units: 2, mode: 'units', values: [1, 1, 0, 0] },
  { id: 7, name: 'Spicy margarita', cents: 1500, claims: [2], units: 1 },
  { id: 8, name: 'Sparkling lemonade', cents: 700, claims: [3], units: 1 },
  { id: 9, name: 'Olive oil cake', cents: 1200, claims: [], units: 1 },
];
const pageNames: Record<Page, string> = { setup: 'Start a bill', entry: 'Add receipt', review: 'Receipt & tip', method: 'Split method', share: 'Invite friends', join: 'Join bill', select: 'Choose items', waiting: 'Waiting', dashboard: 'Group & payments', final: 'Final amounts' };
const pageOrder: Page[] = ['setup', 'entry', 'review', 'method', 'share', 'join', 'select', 'waiting', 'dashboard', 'final'];
const modeNames: Record<SplitMode, string> = { equal: 'Equal', amount: 'Amount', percent: 'Percent', units: 'Units' };
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const numeric = (text: string) => Math.max(0, Number.isFinite(Number(text)) ? Number(text) : 0);
const centsFrom = (text: string) => Math.round(numeric(text) * 100);

function distribute(total: number, weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const exact = weights.map(w => total * w / sum);
  const result = exact.map(Math.floor);
  const order = exact.map((v, i) => ({ i, fraction: v - result[i] })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  const remainder = total - result.reduce((a, b) => a + b, 0);
  for (let n = 0; n < remainder; n++) result[order[n % order.length].i]++;
  return result;
}
function itemShares(item: Item) {
  if (!item.claims.length) return [0, 0, 0, 0];
  if (item.mode === 'amount' && item.values) return item.values;
  if ((item.mode === 'percent' || item.mode === 'units') && item.values) return distribute(item.cents, item.values);
  return distribute(item.cents, [0, 1, 2, 3].map(i => item.claims.includes(i) ? 1 : 0));
}
function allocations(items: Item[], tax: number, tip: number, equal: boolean) {
  const subtotal = items.reduce((sum, item) => sum + item.cents, 0);
  const bases = equal ? [...distribute(subtotal, [1, 1, 1, 1]), 0] : [0, 0, 0, 0, 0];
  if (!equal) for (const item of items) {
    if (!item.claims.length) bases[4] += item.cents;
    else itemShares(item).forEach((c, i) => { bases[i] += c; });
  }
  const weights = bases.some(value => value > 0) ? bases : [1, 1, 1, 1, 0];
  const taxes = distribute(tax, weights), tips = distribute(tip, weights);
  return bases.map((base, i) => ({ base, tax: taxes[i], tip: tips[i], total: base + taxes[i] + tips[i] }));
}
function makeDraft(item: Item, preferredMode?: SplitMode): SplitDraft {
  const mode = preferredMode ?? item.mode ?? 'equal';
  const people = [0, 1, 2, 3].map(i => item.claims.includes(i));
  const weights = item.claims.length ? itemShares(item) : [0, 0, 0, 0];
  const values = mode === item.mode && item.values
    ? item.values.map(n => String(mode === 'amount' || mode === 'percent' ? n / 100 : n))
    : mode === 'amount' ? weights.map(n => (n / 100).toFixed(2))
    : mode === 'percent' ? distribute(10000, weights.some(Boolean) ? weights : people.map(Number)).map(n => String(n / 100))
    : mode === 'units' ? distribute(item.units ?? 1, people.map(Number)).map(String)
    : people.map(p => p ? '1' : '0');
  return { id: item.id, mode, people, values, units: String(item.units ?? 1) };
}
function Sheet({ title, description, children, footer, onClose }: { title: string; description?: string; children: ReactNode; footer?: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? []);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); before?.focus(); };
  }, []);
  return <div className="sp-backdrop" onClick={onClose}>
    <section ref={ref} tabIndex={-1} className="sp-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
      <div className="sp-sheet-head"><div className="sp-row sp-between"><h2>{title}</h2><button className="sp-icon" aria-label="Close dialog" onClick={onClose}><X size={22} /></button></div>{description && <p>{description}</p>}</div>
      <div className="sp-sheet-body">{children}</div>
      {footer && <div className="sp-sheet-footer">{footer}</div>}
    </section>
  </div>;
}

export function SplitPrototype() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const initialPage = params.get('screen');
  const previewClosed = params.get('closed') === '1' || params.get('sheet') === 'payment';
  const [page, setPage] = useState<Page>(pageOrder.includes(initialPage as Page) ? initialPage as Page : 'select');
  const [items, setItems] = useState<Item[]>(() => previewClosed ? initialItems.map(item => item.claims.length ? item : { ...item, claims: [0] }) : initialItems);
  const [names, setNames] = useState(['Jamie', 'Alex', 'Morgan', 'Riley']);
  const [active, setActive] = useState(params.get('as') === 'payer' ? 0 : 1);
  const [payer, setPayer] = useState(0);
  const [tax, setTax] = useState(1584);
  const [tipMode, setTipMode] = useState<TipMode>('percent');
  const [tipValue, setTipValue] = useState('20');
  const [equal, setEqual] = useState(false);
  const [finished, setFinished] = useState(previewClosed ? [true, true, true, true] : [false, false, true, true]);
  const [locked, setLocked] = useState(previewClosed);
  const [paid, setPaid] = useState([false, false, false, false]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const paymentShown = useRef(new Set<number>());
  const [venmo, setVenmo] = useState('@jamie-demo');
  const [zelle, setZelle] = useState('jamie@example.com');
  const [joinName, setJoinName] = useState('Alex');
  const [modal, setModal] = useState<ModalKind>(params.get('sheet') === 'tip' ? 'tip' : params.get('sheet') === 'payment' ? 'payment' : null);
  const [splitDraft, setSplitDraft] = useState<SplitDraft | null>(() => {
    if (params.get('sheet') !== 'split') return null;
    const mode = params.get('mode') as SplitMode;
    const item = initialItems.find(x => x.id === Number(params.get('item'))) ?? initialItems[0];
    return makeDraft(item, Object.keys(modeNames).includes(mode) ? mode : undefined);
  });
  const [tipDraft, setTipDraft] = useState({ mode: 'percent' as TipMode, value: '20' });
  const [toast, setToast] = useState('');
  const [paymentPerson, setPaymentPerson] = useState(1);
  const [entrySource, setEntrySource] = useState('Sample receipt');
  const subtotal = items.reduce((s, x) => s + x.cents, 0);
  const tip = tipMode === 'percent' ? Math.round(subtotal * numeric(tipValue) / 100) : centsFrom(tipValue);
  const total = subtotal + tax + tip;
  const amounts = allocations(items, tax, tip, equal), mine = amounts[active];
  const paidCount = paid.filter((value, i) => value && i !== payer).length;
  const awaitingPayment = amounts.reduce((sum, amount, i) => i < names.length && i !== payer && !paid[i] ? sum + amount.total : sum, 0);
  const unclaimed = equal ? [] : items.filter(x => !x.claims.length);
  const currentItem = items.find(x => x.id === splitDraft?.id);
  const confirmed = finished.filter(Boolean).length;
  const demoUrl = typeof window === 'undefined' ? '' : window.location.href.split('?')[0];
  const draftTip = tipDraft.mode === 'percent' ? Math.round(subtotal * numeric(tipDraft.value) / 100) : centsFrom(tipDraft.value);
  const tipDraftValid = tipDraft.value.trim() !== '' && /^\d*(\.\d{0,2})?$/.test(tipDraft.value) && Number.isFinite(Number(tipDraft.value));
  const draftNumbers = splitDraft?.values.map(v => splitDraft.mode === 'amount' || splitDraft.mode === 'percent' ? centsFrom(v) : numeric(v)) ?? [];
  const draftTarget = splitDraft?.mode === 'percent' ? 10000 : splitDraft?.mode === 'units' ? numeric(splitDraft.units) : currentItem?.cents ?? 0;
  const draftSum = draftNumbers.reduce((a, b) => a + b, 0);
  const draftRemaining = draftTarget - draftSum;
  const draftInputsValid = splitDraft?.values.every(v => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && (splitDraft.mode === 'units' ? /^\d+$/.test(v) : /^\d*(\.\d{0,2})?$/.test(v)))) ?? false;
  const unitsValid = !!splitDraft && /^\d+$/.test(splitDraft.units) && Number(splitDraft.units) > 0 && Number(splitDraft.units) <= 10000;
  const draftValid = !!splitDraft && (splitDraft.mode === 'equal' ? splitDraft.people.some(Boolean) : draftInputsValid && draftRemaining === 0 && (splitDraft.mode !== 'units' || unitsValid));
  const draftAmounts = currentItem && splitDraft
    ? splitDraft.mode === 'equal' ? distribute(currentItem.cents, splitDraft.people.map(Number))
    : splitDraft.mode === 'amount' ? draftNumbers
    : draftValid ? distribute(currentItem.cents, draftNumbers)
    : draftNumbers.map(n => draftTarget > 0 ? Math.round(currentItem.cents * n / draftTarget) : 0)
    : [0, 0, 0, 0];

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); }, [toast]);
  // Local prototype of the bill-finalized event. Production needs a server event
  // addressed to each participant's authenticated session, not a role switcher.
  useEffect(() => {
    if (!locked || active === payer || paymentShown.current.has(active)) return;
    paymentShown.current.add(active);
    setPaymentPerson(active);
    setPaymentMethod(null);
    setModal('payment');
  }, [locked, active, payer]);
  function navigate(next: Page) { setPage(next); setModal(null); setSplitDraft(null); setPaymentMethod(null); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function openPayment(person: number) {
    if (!locked || person === payer) return;
    setPaymentPerson(person); setPaymentMethod(null); setModal('payment');
  }
  function reportPayment(value: boolean) {
    if (!locked || paymentPerson === payer) return;
    setPaid(previous => previous.map((entry, i) => i === paymentPerson ? value : entry));
    setToast(value ? 'Marked paid in this demo. Not bank-verified.' : 'Payment report removed.');
  }
  function invalidate() { setFinished([false, false, false, false]); }
  function updateItem(id: number, patch: Partial<Item>) {
    if (locked) return;
    const old = items.find(x => x.id === id);
    const reset = old?.mode === 'amount' && patch.cents !== undefined && patch.cents !== old.cents;
    setItems(prev => prev.map(x => x.id === id ? { ...x, ...patch, ...(reset ? { mode: 'equal' as SplitMode, claims: [], values: undefined } : {}) } : x));
    if (reset) setToast('Price changed. Assign this item again.');
    invalidate();
  }
  function toggleClaim(item: Item, person: number) {
    if (locked) return;
    if (item.mode && item.mode !== 'equal') { setSplitDraft(makeDraft(item)); return; }
    updateItem(item.id, { claims: item.claims.includes(person) ? item.claims.filter(p => p !== person) : [...item.claims, person].sort() });
  }
  function switchSplitMode(mode: SplitMode) {
    if (!splitDraft || !currentItem) return;
    const people = splitDraft.mode === 'equal' ? splitDraft.people : draftNumbers.map(n => n > 0);
    const weights = splitDraft.mode === 'equal' ? people.map(Number) : draftNumbers;
    const values = mode === 'amount' ? distribute(currentItem.cents, weights).map(n => (n / 100).toFixed(2))
      : mode === 'percent' ? distribute(10000, weights).map(n => String(n / 100))
      : mode === 'units' ? distribute(Math.floor(numeric(splitDraft.units)), weights).map(String)
      : people.map(n => n ? '1' : '0');
    setSplitDraft({ ...splitDraft, mode, people, values });
  }
  function saveSplit() {
    if (!splitDraft || !currentItem || !draftValid || locked) return;
    updateItem(currentItem.id, {
      mode: splitDraft.mode,
      claims: [0, 1, 2, 3].filter(i => splitDraft.mode === 'equal' ? splitDraft.people[i] : draftNumbers[i] > 0),
      values: splitDraft.mode === 'equal' ? undefined : draftNumbers,
      units: splitDraft.mode === 'units' ? Number(splitDraft.units) : currentItem.units,
    });
    setSplitDraft(null);
    setToast('Split saved');
  }
  function updateDraftValue(index: number, value: string) { setSplitDraft(prev => prev ? { ...prev, values: prev.values.map((v, i) => i === index ? value : v) } : null); }
  function openTip() { setTipDraft({ mode: tipMode, value: tipValue }); setModal('tip'); }
  function changeTipMode(mode: TipMode) {
    if (mode === tipDraft.mode) return;
    setTipDraft({ mode, value: mode === 'amount' ? (draftTip / 100).toFixed(2) : subtotal ? (draftTip / subtotal * 100).toFixed(2) : '0' });
  }
  async function copy(text: string, message: string) {
    try { await navigator.clipboard.writeText(text); setToast(message); }
    catch { setToast('Copy unavailable. Select the displayed details instead.'); }
  }
  async function nativeShare() {
    if (navigator.share) {
      try { await navigator.share({ title: 'Billo prototype', text: 'Sample bill only. No live session or payments.', url: demoUrl }); }
      catch { /* A dismissed system share sheet needs no error. */ }
    } else await copy(demoUrl, 'Prototype link copied. No live session.');
  }
  function finish() { if (locked) { navigate('final'); return; } setFinished(prev => prev.map((v, i) => i === active ? true : v)); navigate('waiting'); }
  function closeBill(takeRemaining: boolean) {
    if (!items.length || (unclaimed.length && !takeRemaining)) return;
    if (takeRemaining) setItems(prev => prev.map(x => !x.claims.length ? { ...x, claims: [payer], mode: 'equal', values: undefined } : x));
    setLocked(true); setFinished([true, true, true, true]); navigate(active === payer ? 'dashboard' : 'final');
  }
  const avatar = (i: number) => <span className={`sp-avatar sp-a${i}`} aria-hidden="true">{names[i].slice(0, 1) || '?'}</span>;
  const heading = (headingText: string, description?: string) => <div className="sp-heading">
    <div className="sp-row sp-between"><span className="sp-context">Lido, Brooklyn · 4 people</span><button className="sp-icon" onClick={() => navigate('share')} aria-label="Invite friends"><Share2 size={19} /></button></div>
    <h1>{headingText}</h1>{description && <p>{description}</p>}
  </div>;
  const totalLines = <><div><span>Items</span><span className="sp-money">{money(mine.base)}</span></div><div><span>Tax</span><span className="sp-money">{money(mine.tax)}</span></div><div><span>Tip{tipMode === 'percent' ? ` (${numeric(tipValue)}%)` : ''}</span><span className="sp-money">{money(mine.tip)}</span></div></>;
  const basicTabs = <nav className="sp-mobile-tabs" aria-label="Bill navigation">{(['select', 'review', 'dashboard'] as Page[]).map((p, i) => <button key={p} className={page === p ? 'active' : ''} aria-current={page === p ? 'page' : undefined} onClick={() => navigate(p)}>{['Items', 'Receipt & tip', 'Group'][i]}</button>)}</nav>;
  function splitLabel(item: Item) {
    if (!item.claims.length) return 'Unclaimed';
    const mode = item.mode ?? 'equal';
    const own = item.claims.includes(active);
    if (mode === 'units') return own ? `You: ${item.values?.[active] ?? 0} of ${item.units} units` : `${item.units} units allocated`;
    if (mode === 'percent') return own ? `You: ${(item.values?.[active] ?? 0) / 100}% · ${money(itemShares(item)[active])}` : 'Split by percent';
    if (mode === 'amount') return own ? `You: ${money(itemShares(item)[active])}` : 'Split by amount';
    return item.claims.length > 1 ? `${item.claims.length} people${own ? ` · You ${money(itemShares(item)[active])}` : ' · Equal'}` : own ? 'Yours' : names[item.claims[0]];
  }

  return <div className="split-v2">
    <header className="sp-topbar"><div className="sp-brand"><span className="sp-brand-mark"><Divide size={20} strokeWidth={2.5} /></span>Billo</div><label className="sp-demo-control">Demo<select aria-label="Explore prototype screens" value={page} onChange={e => navigate(e.target.value as Page)}>{pageOrder.map(p => <option key={p} value={p}>{pageNames[p]}</option>)}</select></label></header>
    <div className="sp-layout">
      <aside className="sp-rail">
        <div className="sp-restaurant"><Utensils size={25} /><div><h3>Lido, Brooklyn</h3><p className="sp-small sp-muted">Dinner for four</p></div></div>
        <nav aria-label="Bill navigation">{[
          { page: 'select' as Page, label: 'My items', icon: Utensils },
          { page: 'review' as Page, label: 'Receipt & tip', icon: ReceiptText },
          { page: 'share' as Page, label: 'Invite friends', icon: Share2 },
          { page: 'dashboard' as Page, label: 'Group', icon: Users },
          ...(locked ? [{ page: 'final' as Page, label: 'Final amounts', icon: LockKeyhole }] : []),
        ].map(({ page: p, label, icon: Icon }) => <button key={p} className={page === p ? 'active' : ''} aria-current={page === p ? 'page' : undefined} onClick={() => navigate(p)}><Icon size={18} />{label}</button>)}</nav>
        <p className="sp-rail-note">Sample bill.<br />No live activity or payments.</p>
      </aside>
      <main className="sp-main">
        <div key={page} className={`sp-page ${page === 'select' ? 'sp-select-page' : ''}`}>
          {page === 'select' && <>
            {heading(locked ? 'Your items' : 'Choose your items', locked ? 'This bill is locked.' : 'Tap your items. Split anything shared.')}
            {basicTabs}
            <div className="sp-selection-grid">
              <div>
                <div className="sp-card">
                  <div className="sp-card-head"><span className="sp-small sp-muted">{equal ? 'Equal split' : `${items.length} items`}</span><button className="sp-person-switch" onClick={() => setModal('person')}>{avatar(active)}{names[active]}<ChevronDown size={16} /></button></div>
                  {equal ? <div className="sp-pad sp-stack"><Users size={27} /><h2>Split equally, four ways</h2><p className="sp-muted">Each person pays {money(amounts[active].total)}, including tax and tip.</p><button className="sp-link" disabled={locked} onClick={() => navigate('method')}>Change split method<ChevronRight size={18} /></button></div>
                    : items.length ? items.map(item => <div key={item.id} className={`sp-item ${item.claims.includes(active) ? 'sp-selected' : ''}`}>
                      <button className="sp-item-main" disabled={locked} aria-label={`${item.mode && item.mode !== 'equal' ? 'Edit split for' : item.claims.includes(active) ? 'Unselect' : 'Select'} ${item.name}`} aria-pressed={item.claims.includes(active)} onClick={() => toggleClaim(item, active)}>
                        <span className="sp-checkbox">{item.claims.includes(active) && <Check size={16} strokeWidth={2.5} />}</span><span className="sp-item-title">{item.name}</span><span className="sp-money">{money(item.cents)}</span>
                      </button>
                      <div className="sp-item-meta"><span>{splitLabel(item)}</span><button className="sp-split-action" disabled={locked} onClick={() => setSplitDraft(makeDraft(item))}>{item.mode && item.mode !== 'equal' ? 'Edit split' : 'Split item'}<ChevronRight size={16} /></button></div>
                    </div>) : <div className="sp-pad sp-stack"><ReceiptText size={30} /><h2>No items yet</h2><button className="sp-button" onClick={() => navigate('review')}>Add receipt items<Plus size={18} /></button></div>}
                </div>
                <p className="sp-list-note">{equal ? 'Extra cents are balanced across the group.' : 'Tax and tip follow each person’s item total.'}</p>
                <button className="sp-setting sp-row" onClick={openTip}><div className="sp-grow"><h3>Tip</h3><p className="sp-small">{tipMode === 'percent' ? `${numeric(tipValue)}% of the pre-tax subtotal` : 'Fixed amount for the table'}</p></div><strong className="sp-money">{money(tip)}</strong><ChevronRight size={18} /></button>
                <button className="sp-link" onClick={() => navigate('method')}>Split method: {equal ? 'Equal total' : 'By item'}<ChevronRight size={16} /></button>
              </div>
              <aside className="sp-card sp-pad sp-summary">
                <span className="sp-small sp-muted">Your {locked ? 'final' : 'estimated'} share</span><div className="sp-big-amount sp-money">{money(mine.total)}</div>
                <div className="sp-summary-lines">{totalLines}</div>
                <button className="sp-button full" disabled={!items.length} onClick={finish}>{locked ? 'Final amounts' : 'Confirm items'}<Check size={18} /></button>
                <p className="sp-footer-note">No payment is made here.</p>
              </aside>
            </div>
            <div className="sp-sticky-footer"><button onClick={() => setModal('breakdown')} aria-label="View your share breakdown"><span className="sp-small">{locked ? 'Final share' : 'Your share · estimated'}<ChevronDown size={13} /></span><span className="sp-money">{money(mine.total)}</span></button><button className="sp-button" disabled={!items.length} onClick={finish}>{locked ? 'View final' : 'Confirm'}<Check size={18} /></button></div>
          </>}

          {page === 'setup' && <>{heading('Start a bill')}<div className="sp-card sp-pad sp-stack sp-content">
            <label className="sp-field">Your name<input value={names[payer]} maxLength={24} disabled={locked} autoComplete="given-name" onChange={e => setNames(n => n.map((v, i) => i === payer ? e.target.value : v))} placeholder="First name" /></label>
            <div><h3>Payment details</h3><p className="sp-small sp-muted">Optional. Friends pay you outside Billo.</p></div>
            <label className="sp-field">Venmo username<input value={venmo} disabled={locked} autoCapitalize="none" onChange={e => setVenmo(e.target.value)} placeholder="@username" /></label>
            <label className="sp-field">Zelle email or phone<input value={zelle} disabled={locked} autoCapitalize="none" onChange={e => setZelle(e.target.value)} placeholder="Email or phone number" /></label>
            <button className="sp-button full" disabled={!names[payer].trim()} onClick={() => navigate('entry')}>Continue<ArrowRight size={18} /></button>
            <p className="sp-small sp-muted">No account needed. Demo changes reset on refresh.</p>
          </div></>}

          {page === 'entry' && <>{heading('Add a receipt')}<div className="sp-content sp-stack">
            <p className="sp-small sp-muted">Camera and upload use a sample in this demo.</p>
            {[{ icon: ScanLine, label: 'Take a photo' }, { icon: Upload, label: 'Upload a photo' }, { icon: ReceiptText, label: 'Enter manually' }].map(({ icon: Icon, label }) => <button key={label} className="sp-choice" disabled={locked} onClick={() => { setEntrySource(label === 'Enter manually' ? 'Manual entry · sample prefilled' : 'Sample receipt · not scanned'); navigate('review'); }}><Icon size={24} /><h3 className="sp-grow">{label}</h3><ChevronRight size={20} /></button>)}
          </div></>}

          {page === 'review' && <>{heading('Review receipt')}{basicTabs}<div className="sp-card sp-pad sp-stack sp-content">
            <div className="sp-row sp-between"><span className="sp-small sp-muted">{entrySource}</span>{locked && <span className="sp-status"><LockKeyhole size={14} />Locked</span>}</div>
            <div className="sp-receipt-items">{items.map(item => <div className="sp-receipt-row" key={item.id}>
              <input aria-label={`Item ${item.id} name`} value={item.name} disabled={locked} onChange={e => updateItem(item.id, { name: e.target.value })} />
              <input type="number" inputMode="decimal" step=".01" min="0" aria-label={`Price of ${item.name} in dollars`} defaultValue={(item.cents / 100).toFixed(2)} disabled={locked} onChange={e => updateItem(item.id, { cents: centsFrom(e.target.value) })} />
              <button className="sp-icon" disabled={locked} aria-label={`Remove ${item.name}`} onClick={() => { setItems(prev => prev.filter(x => x.id !== item.id)); invalidate(); }}><Trash2 size={18} /></button>
            </div>)}</div>
            <button className="sp-link" disabled={locked} onClick={() => { setItems(prev => [...prev, { id: Date.now(), name: 'New item', cents: 0, claims: [], units: 1 }]); invalidate(); }}><Plus size={19} />Add item</button>
            <div className="sp-totals">
              <div className="sp-row"><span>Subtotal</span><strong className="sp-money">{money(subtotal)}</strong></div>
              <div className="sp-row"><label htmlFor="sp-tax">Tax ($)</label><input id="sp-tax" className="sp-amount-input" type="number" inputMode="decimal" min="0" step=".01" disabled={locked} defaultValue={(tax / 100).toFixed(2)} onChange={e => { setTax(centsFrom(e.target.value)); invalidate(); }} /></div>
              <button className="sp-setting sp-row" onClick={openTip}><div className="sp-grow"><h3>Tip</h3><p className="sp-small">{tipMode === 'percent' ? `${numeric(tipValue)}% · before tax` : 'Fixed amount'}</p></div><strong className="sp-money">{money(tip)}</strong><ChevronRight size={18} /></button>
              <div className="sp-row sp-total-row"><span>Total</span><span className="sp-money">{money(total)}</span></div>
            </div>
            <button className="sp-button full" disabled={!items.length} onClick={() => navigate(locked ? 'final' : 'method')}>{locked ? 'Final amounts' : 'Continue'}<ArrowRight size={18} /></button>
          </div></>}

          {page === 'method' && <>{heading('How do you want to split?')}<div className="sp-content sp-stack">
            {[false, true].map(value => <button key={String(value)} className={`sp-choice ${equal === value ? 'selected' : ''}`} disabled={locked} onClick={() => { setEqual(value); invalidate(); }}>
              {value ? <Users size={24} /> : <Utensils size={24} />}<div className="sp-grow"><h3>{value ? 'Split the total equally' : 'Choose items'}</h3><p className="sp-small">{value ? `${money(Math.floor(total / 4))} per person, before rounding` : 'Share items equally, by $, %, or units'}</p></div>{equal === value && <Check size={20} />}
            </button>)}
            <label className="sp-field">Who paid the restaurant?<select value={payer} disabled={locked} onChange={e => setPayer(Number(e.target.value))}>{names.map((name, i) => <option key={i} value={i}>{name}</option>)}</select></label>
            <button className="sp-button full" onClick={() => navigate('share')}>Invite friends<ArrowRight size={18} /></button>
          </div></>}

          {page === 'share' && <>{heading('Invite friends')}<div className="sp-card sp-pad sp-stack sp-content">
            <div className="sp-share-card"><h2>Lido, Brooklyn</h2><p className="sp-small sp-muted">4 people · {money(total)}</p><div className="sp-qr" role="img" aria-label="Sample QR code, not scannable">{Array.from({ length: 169 }, (_, i) => {
              const x = i % 13, y = Math.floor(i / 13);
              const finder = (ox: number, oy: number) => x >= ox && x < ox + 5 && y >= oy && y < oy + 5 && (x === ox || x === ox + 4 || y === oy || y === oy + 4 || (x === ox + 2 && y === oy + 2));
              return <i key={i} className={finder(0, 0) || finder(8, 0) || finder(0, 8) || (x > 5 && y > 5 && i * 17 % 7 < 3) ? 'on' : ''} />;
            })}</div><p className="sp-small sp-muted">Sample QR · not scannable</p></div>
            <div className="sp-link-box"><Link2 size={19} /><span className="sp-grow sp-small">Lido dinner · prototype link</span><button className="sp-icon" aria-label="Copy prototype link" onClick={() => copy(demoUrl, 'Prototype link copied. No live session.')}><Copy size={19} /></button></div>
            <button className="sp-button full" onClick={nativeShare}><Share2 size={18} />Share link</button>
            <p className="sp-small sp-muted">This demo link opens a sample, not a shared bill.</p>
            <button className="sp-link" onClick={() => navigate('join')}>Preview joining<ChevronRight size={18} /></button>
          </div></>}

          {page === 'join' && <>{heading('Join the bill', `${names[payer]} paid ${money(total)} at Lido.`)}<div className="sp-card sp-pad sp-stack sp-content">
            <div className="sp-avatar-group">{names.map((_, i) => <span key={i}>{avatar(i)}</span>)}</div>
            <label className="sp-field">Your name<input value={joinName} maxLength={24} autoComplete="given-name" onChange={e => setJoinName(e.target.value)} placeholder="First name" /></label>
            <button className="sp-button full" disabled={!joinName.trim()} onClick={() => { setNames(prev => prev.map((n, i) => i === 1 ? joinName.trim() : n)); setActive(1); navigate(locked ? 'final' : 'select'); }}>Join bill<ArrowRight size={18} /></button>
            <p className="sp-small sp-muted">No signup. This demo uses Alex’s place.</p>
          </div></>}

          {page === 'waiting' && <>{heading(finished[active] ? 'You’re all set' : 'Review your share', locked ? 'The bill is now final.' : finished[active] ? `Waiting for ${names[payer]} to close the bill.` : 'Your amount changed. Confirm your items again.')}<div className="sp-card sp-pad sp-stack sp-content">
            <div className="sp-center"><div className="sp-state-symbol">{finished[active] ? <Check size={28} /> : <Clock3 size={28} />}</div><p className="sp-small sp-muted">{names[active]}’s {locked ? 'final' : 'estimated'} share</p><div className="sp-big-amount sp-money">{money(mine.total)}</div></div>
            <div>{names.map((name, i) => <div className="sp-person-row" key={i}>{avatar(i)}<span className="sp-grow">{name}</span><span className={`sp-status ${finished[i] ? 'done' : ''}`}>{finished[i] ? <Check size={15} /> : <Clock3 size={15} />}{finished[i] ? 'Finished' : 'Selecting'}</span></div>)}</div>
            <button className="sp-button full secondary" onClick={() => { if (!locked) setFinished(prev => prev.map((v, i) => i === active ? false : v)); navigate(locked ? 'final' : 'select'); }}>{locked ? 'Final amounts' : 'Edit my items'}<ArrowRight size={18} /></button>
            <p className="sp-small sp-muted">Confirmed, not paid. Shared-item changes may affect your amount.</p>
          </div></>}

          {page === 'dashboard' && <>{heading(locked ? 'Track payments' : 'Your group', locked ? `${names[payer]}’s view · self-reported payments` : undefined)}{basicTabs}<div className="sp-card sp-pad sp-stack sp-content">
            <div className="sp-row sp-between"><div><p className="sp-small sp-muted">Bill total</p><h2 className="sp-money">{money(total)}</h2></div><span className="sp-status done">{locked ? <><LockKeyhole size={15} />Locked</> : `${confirmed} of 4 finished`}</span></div>
            {locked && <div className="sp-payment-overview"><div><small>Marked paid</small><strong>{paidCount} <span className="sp-small sp-muted">of 3</span></strong></div><div><small>Awaiting reports</small><strong className="sp-money">{money(awaitingPayment)}</strong></div></div>}
            <div>{names.map((name, i) => <div className="sp-person-row" key={i}>{avatar(i)}<div className="sp-grow"><h3>{name}{i === payer ? ' · you paid' : ''}</h3>{locked ? <span className={`sp-payment-status ${paid[i] ? 'paid' : ''}`}>{i === payer ? 'Your own share' : paid[i] ? <><Check size={13} />Marked paid</> : <><Clock3 size={13} />Not marked paid</>}</span> : <span className={`sp-status ${finished[i] ? 'done' : ''}`}>{finished[i] ? 'Finished' : 'Selecting'}</span>}</div><strong className="sp-money">{money(amounts[i].total)}</strong><button className="sp-icon" aria-label={locked && i !== payer ? `Preview ${name}'s payment screen` : `View ${name}'s items`} onClick={() => { if (locked && i !== payer) openPayment(i); else { setActive(i); navigate(locked ? 'final' : 'select'); } }}><ChevronRight size={20} /></button></div>)}</div>
            {!!unclaimed.length && <div className="sp-notice warning"><Info size={19} /><div><strong>{unclaimed.length} unclaimed items · {money(amounts[4].total)}</strong><p className="sp-small">Includes tax and tip.</p><button className="sp-link" onClick={() => { setActive(payer); navigate('select'); }}>Assign items<ChevronRight size={17} /></button></div></div>}
            {!locked && <button className="sp-link" onClick={() => { setFinished(prev => prev.map((v, i) => i === payer ? v : true)); setToast('Demo: friends confirmed'); }}>Demo: mark friends finished<Check size={17} /></button>}
            <button className="sp-button full" disabled={!items.length} onClick={() => locked ? navigate('final') : setModal('close')}>{locked ? 'View final amounts' : 'Close bill'}<ArrowRight size={18} /></button>
            <p className="sp-small sp-muted">{locked ? '“Marked paid” is a friend’s report. Check your payment app to confirm receipt. Demo changes reset on refresh.' : 'Sample activity. Finished means confirmed, not paid.'}</p>
          </div></>}

          {page === 'final' && <>{heading(locked ? 'Final amounts' : 'Amounts preview', locked ? `Bill confirmed by ${names[payer]}.` : 'Amounts are estimated until the payer closes the bill.')}<div className="sp-card sp-pad sp-stack sp-content">
            {!locked && <button className="sp-button full" disabled={!items.length} onClick={() => setModal('close')}>Review & close bill<LockKeyhole size={18} /></button>}
            <div className="sp-row sp-between"><span>Bill total</span><h2 className="sp-money">{money(total)}</h2></div>
            <div>{names.map((name, i) => <div className="sp-final-person" key={i}>
              <div className="sp-row">{avatar(i)}<div className="sp-grow"><h3>{name}</h3><p className="sp-small sp-muted">{i === payer ? 'Payer · own share' : paid[i] ? 'Marked paid · self-reported' : `Owes ${names[payer]}`}</p></div><strong className="sp-money">{money(amounts[i].total)}</strong></div>
              <div className="sp-details">Items {money(amounts[i].base)} · tax {money(amounts[i].tax)} · tip {money(amounts[i].tip)}</div>
              {i !== payer && <button className="sp-link" disabled={!locked} onClick={() => openPayment(i)}>{paid[i] ? 'View payment report' : 'Payment options'}<ChevronRight size={18} /></button>}
            </div>)}</div>
            {!!unclaimed.length && <div className="sp-row sp-between sp-small"><span>Still unallocated</span><strong className="sp-money">{money(amounts[4].total)}</strong></div>}
            <div className="sp-notice"><CircleCheck size={19} /><span>Shares total {money(amounts.reduce((s, x) => s + x.total, 0))}{unclaimed.length ? ', including unallocated items' : ''}. Payments are self-reported, not verified.</span></div>
            {locked && <button className="sp-button full secondary" onClick={() => { setActive(payer); navigate('dashboard'); }}>Preview payer tracking<Users size={18} /></button>}
            <button className="sp-link" onClick={() => copy(`Billo sample bill · Lido\n${names.map((n, i) => `${n}: ${money(amounts[i].total)}${i === payer ? ' (payer)' : paid[i] ? ' (marked paid, unverified)' : ' (not marked paid)'}`).join('\n')}\n${unclaimed.length ? `Unallocated: ${money(amounts[4].total)}\n` : ''}Total: ${money(total)}\n${locked ? 'Final amounts' : 'Estimated amounts'} · Demo only.`, 'Sample breakdown copied')}><Copy size={18} />Copy breakdown</button>
          </div></>}
        </div>
      </main>
    </div>

    {splitDraft && currentItem && <Sheet title="Split item" description={`${currentItem.name} · ${money(currentItem.cents)}`} onClose={() => setSplitDraft(null)} footer={<button className="sp-button full" disabled={!draftValid || locked} onClick={saveSplit}>Save split<Check size={18} /></button>}>
      <div className="sp-segments" aria-label="Split item by">{(Object.keys(modeNames) as SplitMode[]).map(mode => <button key={mode} className={splitDraft.mode === mode ? 'active' : ''} aria-pressed={splitDraft.mode === mode} onClick={() => switchSplitMode(mode)}>{modeNames[mode]}</button>)}</div>
      {splitDraft.mode === 'units' ? <div className="sp-units-setting"><label htmlFor="sp-total-units">Total units<small className="sp-muted" style={{ display: 'block' }}>Glasses, slices, or pieces</small></label><input id="sp-total-units" type="text" inputMode="numeric" value={splitDraft.units} onChange={e => setSplitDraft({ ...splitDraft, units: e.target.value })} /></div>
        : <p className="sp-small sp-muted" style={{ marginTop: 14 }}>{splitDraft.mode === 'equal' ? 'Choose who is sharing.' : splitDraft.mode === 'amount' ? `Assign all ${money(currentItem.cents)} before tax and tip.` : 'Percentages must add up to 100%.'}</p>}
      <div className="sp-allocation-list">{names.map((name, i) => <div className="sp-allocation-row" key={i}>
        {splitDraft.mode === 'equal' ? <button className="sp-equal-check" aria-pressed={splitDraft.people[i]} onClick={() => setSplitDraft({ ...splitDraft, people: splitDraft.people.map((p, index) => index === i ? !p : p) })}>
          {avatar(i)}<span className="sp-name">{name}{i === active ? ' · you' : ''}<small>{money(draftAmounts[i])}</small></span><span className={`sp-checkbox ${splitDraft.people[i] ? 'checked' : ''}`}>{splitDraft.people[i] && <Check size={16} />}</span>
        </button> : <>
          {avatar(i)}<label className="sp-name" htmlFor={`sp-allocation-${i}`}>{name}{i === active ? ' · you' : ''}<small>{splitDraft.mode === 'amount' ? 'Before tax & tip' : `${money(draftAmounts[i])}${!draftValid ? ' est.' : ''}`}</small></label>
          {splitDraft.mode === 'units' ? <div className="sp-stepper">
            <button aria-label={`Remove a unit from ${name}`} disabled={numeric(splitDraft.values[i]) <= 0} onClick={() => updateDraftValue(i, String(Math.max(0, Math.floor(numeric(splitDraft.values[i])) - 1)))}><Minus size={16} /></button>
            <input id={`sp-allocation-${i}`} type="text" inputMode="numeric" value={splitDraft.values[i]} onChange={e => updateDraftValue(i, e.target.value)} />
            <button aria-label={`Add a unit to ${name}`} disabled={!unitsValid || draftSum >= numeric(splitDraft.units)} onClick={() => updateDraftValue(i, String(Math.floor(numeric(splitDraft.values[i])) + 1))}><Plus size={16} /></button>
          </div> : <div className={`sp-number-wrap ${splitDraft.mode === 'amount' ? 'currency' : ''}`}>
            {splitDraft.mode === 'amount' && <span className="sp-prefix">$</span>}
            <input id={`sp-allocation-${i}`} type="text" inputMode="decimal" autoComplete="off" value={splitDraft.values[i]} onFocus={e => e.target.select()} onChange={e => updateDraftValue(i, e.target.value)} aria-invalid={!draftInputsValid || draftRemaining < 0} />
            {splitDraft.mode === 'percent' && <span className="sp-suffix">%</span>}
          </div>}
        </>}
      </div>)}</div>
      <div className={`sp-allocation-progress ${draftValid ? 'valid' : draftRemaining < 0 || !draftInputsValid ? 'invalid' : ''}`} role="status">
        {draftValid ? <CircleCheck size={19} /> : <Info size={19} />}<div>
          <strong>{draftValid ? splitDraft.mode === 'equal' ? `Shared by ${splitDraft.people.filter(Boolean).length}` : splitDraft.mode === 'amount' ? `${money(draftSum)} of ${money(draftTarget)} allocated` : splitDraft.mode === 'percent' ? '100% allocated' : `${draftSum} of ${draftTarget} units allocated`
            : splitDraft.mode === 'equal' ? 'Select at least one person'
            : !draftInputsValid ? 'Use positive numbers or zero'
            : splitDraft.mode === 'units' && !unitsValid ? 'Enter 1–10,000 whole units'
            : `${splitDraft.mode === 'amount' ? money(Math.abs(draftRemaining)) : splitDraft.mode === 'percent' ? `${Math.abs(draftRemaining) / 100}%` : `${Math.abs(draftRemaining)} units`} ${draftRemaining < 0 ? 'over the total' : 'left to assign'}`}</strong>
          <small>Tax and tip are added proportionally.</small>
        </div>
      </div>
    </Sheet>}

    {modal === 'tip' && <Sheet title="Tip" description="For the whole table, before tax." onClose={() => setModal(null)} footer={<button className="sp-button full" disabled={!tipDraftValid || locked} onClick={() => { setTipMode(tipDraft.mode); setTipValue(tipDraft.value); invalidate(); setModal(null); setToast('Tip updated'); }}>{locked ? 'Bill locked' : 'Save tip'}<Check size={18} /></button>}>
      <div className="sp-stack">
        <div className="sp-segments two" aria-label="Tip entry type"><button className={tipDraft.mode === 'percent' ? 'active' : ''} aria-pressed={tipDraft.mode === 'percent'} onClick={() => changeTipMode('percent')}>Percentage (%)</button><button className={tipDraft.mode === 'amount' ? 'active' : ''} aria-pressed={tipDraft.mode === 'amount'} onClick={() => changeTipMode('amount')}>Amount ($)</button></div>
        {tipDraft.mode === 'percent' && <div className="sp-presets">{[15, 18, 20, 22].map(rate => <button key={rate} className={numeric(tipDraft.value) === rate ? 'active' : ''} aria-pressed={numeric(tipDraft.value) === rate} onClick={() => setTipDraft({ mode: 'percent', value: String(rate) })}>{rate}%</button>)}</div>}
        <label className="sp-field" htmlFor="sp-tip-input">{tipDraft.mode === 'percent' ? 'Custom percentage' : 'Tip amount ($)'}<input id="sp-tip-input" type="text" inputMode="decimal" value={tipDraft.value} onFocus={e => e.target.select()} onChange={e => setTipDraft({ ...tipDraft, value: e.target.value })} aria-invalid={!tipDraftValid} /><small>{tipDraft.mode === 'percent' ? `Based on ${money(subtotal)} subtotal, excluding tax.` : 'Enter 0 for no tip.'}</small></label>
        <div className="sp-tip-result sp-row sp-between"><div><h3>Tip total</h3><span className="sp-small sp-muted">{tipDraft.mode === 'percent' ? `${numeric(tipDraft.value)}% × ${money(subtotal)}` : 'Fixed dollar amount'}</span></div><strong className="sp-money">{money(draftTip)}</strong></div>
        <p className="sp-small sp-muted">Divided in proportion to each person’s items.</p>
      </div>
    </Sheet>}

    {modal === 'person' && <Sheet title="View as" description="Switch people in this demo." onClose={() => setModal(null)}><div className="sp-stack" style={{ gap: 10 }}>{names.map((name, i) => <button className="sp-choice" key={i} onClick={() => { setActive(i); setModal(null); }}>{avatar(i)}<span className="sp-grow">{name}{i === payer ? ' · payer' : ''}</span>{active === i ? <Check size={19} /> : <ChevronRight size={19} />}</button>)}</div></Sheet>}

    {modal === 'breakdown' && <Sheet title="Your share" description={`${names[active]} · ${locked ? 'final amount' : 'estimated amount'}`} onClose={() => setModal(null)}>
      <div className="sp-big-amount sp-money">{money(mine.total)}</div><div className="sp-summary-lines">{totalLines}</div><p className="sp-small sp-muted">Tax and tip follow your item total. Amounts lock when the payer closes the bill.</p><button className="sp-link" onClick={openTip}>View table tip<ChevronRight size={18} /></button>
    </Sheet>}

    {modal === 'close' && <Sheet title={unclaimed.length ? 'Assign remaining items' : 'Close this bill?'} onClose={() => setModal(null)} footer={<button className="sp-button full" disabled={!items.length} onClick={() => closeBill(unclaimed.length > 0)}>{unclaimed.length ? 'Take remaining & close' : confirmed === 4 ? 'Close bill' : 'Force finish & close'}<LockKeyhole size={18} /></button>}>
      <div className="sp-stack">
        {!!unclaimed.length && <><p className="sp-muted">{names[payer]} will cover these items:</p><div>{unclaimed.map(item => <div className="sp-person-row" key={item.id}><span className="sp-grow">{item.name}</span><strong className="sp-money">{money(item.cents)}</strong></div>)}</div><div className="sp-row sp-between"><strong>With tax & tip</strong><strong className="sp-money">{money(amounts[4].total)}</strong></div><button className="sp-link" onClick={() => { setActive(payer); navigate('select'); }}>Assign to someone else<ChevronRight size={18} /></button></>}
        {confirmed < 4 && <div className="sp-notice warning"><Info size={19} /><span>{4 - confirmed} {4 - confirmed === 1 ? 'person is' : 'people are'} still selecting. Closing keeps their current choices.</span></div>}
        <p className="sp-small sp-muted">Closing locks amounts and shows each friend their payment options. This demo previews one friend at a time; no money moves.</p>
      </div>
    </Sheet>}

    {modal === 'payment' && <Sheet title={paid[paymentPerson] ? 'Payment marked' : 'Your bill is ready'} description={`${names[paymentPerson]} · confirmed by ${names[payer]}`} onClose={() => setModal(null)} footer={<button className="sp-button full secondary" onClick={() => { setActive(payer); navigate('dashboard'); }}>Preview payer tracking<ArrowRight size={18} /></button>}>
      <div className="sp-payment-hero">{avatar(payer)}<p className="sp-small sp-muted">{paid[paymentPerson] ? 'You marked paid' : `You owe ${names[payer]}`}</p><div className="sp-big-amount sp-money">{money(amounts[paymentPerson].total)}</div><p className="sp-small sp-muted">Tax & tip included</p></div>
      <div className="sp-payment-options" aria-label="Choose a payment method">
        {venmo.trim() && <button className="sp-payment-option" aria-pressed={paymentMethod === 'venmo'} onClick={() => setPaymentMethod(paymentMethod === 'venmo' ? null : 'venmo')}><span className="sp-payment-symbol" aria-hidden="true">V</span><span className="sp-grow"><strong>Venmo</strong><small>{venmo}</small></span><ArrowUpRight size={20} /></button>}
        {zelle.trim() && <button className="sp-payment-option" aria-pressed={paymentMethod === 'zelle'} onClick={() => setPaymentMethod(paymentMethod === 'zelle' ? null : 'zelle')}><span className="sp-payment-symbol" aria-hidden="true">Z</span><span className="sp-grow"><strong>Zelle</strong><small>Through your bank</small></span><ArrowUpRight size={20} /></button>}
        {!venmo.trim() && !zelle.trim() && <div className="sp-notice"><Info size={19} /><span>Ask {names[payer]} to add payment details. You can still report a payment made another way.</span></div>}
        {paymentMethod && <div className="sp-payment-handoff">
          <div className="sp-row sp-between"><strong className="sp-small">{paymentMethod === 'venmo' ? 'Venmo handoff preview' : 'Zelle details'}</strong><button className="sp-icon" aria-label="Hide payment details" onClick={() => setPaymentMethod(null)}><X size={18} /></button></div>
          <div className="sp-row sp-between sp-small"><span className="sp-muted">Recipient</span><span style={{ overflowWrap: 'anywhere', textAlign: 'right' }}>{paymentMethod === 'venmo' ? venmo : zelle}</span></div>
          <div className="sp-row sp-between sp-small"><span className="sp-muted">Amount</span><strong className="sp-money">{money(amounts[paymentPerson].total)}</strong></div>
          <div className="sp-row sp-between sp-small"><span className="sp-muted">Note</span><span>Billo · Lido dinner</span></div>
          <p>{paymentMethod === 'venmo' ? 'The live app will pass these details to Venmo. Always review the recipient and amount before sending.' : 'Use Zelle in your bank’s app. Recipient and amount may need to be entered manually; bank support varies.'}</p>
          <button className="sp-link" onClick={() => copy(`DEMO ONLY — DO NOT SEND MONEY\n${paymentMethod === 'venmo' ? venmo : zelle}\n${money(amounts[paymentPerson].total)}\nBillo · Lido dinner`, 'Sample details copied. Do not send money.')}><Copy size={17} />Copy sample details</button>
        </div>}
      </div>
      <p className="sp-payment-methods">Choose a method to preview. No payment app opens.</p>
      <label className="sp-paid-check"><input type="checkbox" checked={paid[paymentPerson]} disabled={!locked || paymentPerson === payer} onChange={e => reportPayment(e.target.checked)} /><span><strong>I paid</strong><small>{paid[paymentPerson] ? `${names[payer]} sees “Marked paid” in this demo.` : `Let ${names[payer]} know after you send it.`}</small></span></label>
      <p className="sp-small sp-muted">Self-reported. Billo doesn’t verify bank payments.</p>
      <div className="sp-demo-notice"><Info size={16} /><span>Sample bill. Don’t pay these details. Reports only update this preview and reset on refresh.</span></div>
    </Sheet>}
    {toast && <div className="sp-toast" role="status">{toast}</div>}
  </div>;
}
