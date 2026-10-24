import { useState } from 'react';
import { ArrowUpRight, Copy, Info } from 'lucide-react';
import type { BillView } from '@workspace/api-client-react';
import { Avatar } from '@/components/Chrome';
import { Sheet } from '@/components/Sheet';
import type { Change } from '@/hooks/use-bill-actions';
import { avatarIndex, centsText, findPerson, money } from '@/lib/billo';

export function PaymentSheet({ bill, send, pending, notify, onClose }: { bill: BillView; send: (c: Change, o?: { success?: string }) => void; pending: boolean; notify: (m: string) => void; onClose: () => void }) {
  const me = findPerson(bill, bill.meId), payer = findPerson(bill, bill.payerId);
  const [method, setMethod] = useState<'venmo' | 'zelle' | null>(bill.venmo && !bill.zelle ? 'venmo' : !bill.venmo && bill.zelle ? 'zelle' : null);
  if (!me || !payer) return null;
  const amount = me.totalCents;
  async function copy(text: string, msg: string) {
    try { await navigator.clipboard.writeText(text); notify(msg); } catch { notify('Copy unavailable. Select the text instead.'); }
  }
  return <Sheet title={`Pay ${payer.name}`} description="The bill is closed. Your amount is final." onClose={onClose}>
    <div className="sp-payment-hero"><Avatar name={payer.name} index={avatarIndex(bill, payer.id)} /><p className="sp-small sp-muted">You owe {payer.name}</p><div className="sp-big-amount sp-money" data-testid="text-amount-owed">{money(amount)}</div><p className="sp-small sp-muted">{bill.title}</p></div>
    {amount <= 0 ? <div className="sp-notice"><Info size={17} />You have nothing to pay on this bill.</div> : <>
      <div className="sp-payment-options">
        {bill.venmo && <button className="sp-payment-option" aria-pressed={method === 'venmo'} data-testid="button-method-venmo" onClick={() => setMethod('venmo')}><span className="sp-payment-symbol">V</span><span className="sp-grow"><strong>Venmo</strong><small>@{bill.venmo}</small></span></button>}
        {bill.zelle && <button className="sp-payment-option" aria-pressed={method === 'zelle'} data-testid="button-method-zelle" onClick={() => setMethod('zelle')}><span className="sp-payment-symbol">Z</span><span className="sp-grow"><strong>Zelle</strong><small>{bill.zelle}</small></span></button>}
      </div>
      {method === 'venmo' && <div className="sp-payment-handoff" style={{ marginTop: 12 }}>
        <a className="sp-button full" href={bill.venmoUrl} data-testid="link-venmo-app">Open Venmo app<ArrowUpRight size={18} /></a>
        <p>The link includes your recipient, amount and note. Check them before sending. If your app doesn't fill them in, copy the details below.</p>
        <div className="sp-actions"><a className="sp-link" href={bill.venmoWebUrl} target="_blank" rel="noreferrer" data-testid="link-venmo-web">Use Venmo on the web<ArrowUpRight size={15} /></a>
          <button className="sp-link" data-testid="button-copy-venmo" onClick={() => copy(`@${bill.venmo} · ${money(amount)} · ${bill.paymentNote}`, 'Venmo details copied')}><Copy size={15} />Copy details</button></div>
      </div>}
      {method === 'zelle' && <div className="sp-payment-handoff" style={{ marginTop: 12 }}>
        <p>Zelle has no universal prefilled payment link. Open your banking app, choose Zelle, and send to:</p>
        <div className="sp-copy-line"><span className="sp-grow">{bill.zelle}</span><button className="sp-icon" aria-label="Copy Zelle recipient" data-testid="button-copy-zelle-recipient" onClick={() => copy(bill.zelle, 'Recipient copied')}><Copy size={17} /></button></div>
        <div className="sp-copy-line"><span className="sp-grow sp-money">{money(amount)}</span><button className="sp-icon" aria-label="Copy amount" data-testid="button-copy-zelle-amount" onClick={() => copy(centsText(amount), 'Amount copied')}><Copy size={17} /></button></div>
        {bill.paymentNote && <div className="sp-copy-line"><span className="sp-grow">{bill.paymentNote}</span><button className="sp-icon" aria-label="Copy memo" onClick={() => copy(bill.paymentNote, 'Memo copied')}><Copy size={17} /></button></div>}
        <a className="sp-link" href="https://www.zellepay.com/get-started" target="_blank" rel="noreferrer" data-testid="link-zelle-directory">Find your bank on Zelle<ArrowUpRight size={15} /></a>
      </div>}
      <label className="sp-paid-check" style={{ marginTop: 16 }}>
        <input type="checkbox" data-testid="checkbox-paid" checked={me.paid} disabled={pending} onChange={e => send({ action: 'payment', paid: e.target.checked }, { success: e.target.checked ? 'Marked as paid. Thanks.' : 'Payment mark removed' })} />
        <span><strong>I paid {payer.name}</strong><small>Self-reported so {payer.name} can track it. Billo does not verify payments.</small></span>
      </label>
    </>}
  </Sheet>;
}
