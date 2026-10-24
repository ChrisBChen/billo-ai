import { useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Info } from 'lucide-react';
import { getGetBillQueryKey, useCreateBill } from '@workspace/api-client-react';
import { OfflineBanner, Spinner, Topbar } from '@/components/Chrome';
import { errorMessage } from '@/lib/billo';

export default function CreateBill() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const create = useCreateBill();
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [venmo, setVenmo] = useState('');
  const [zelle, setZelle] = useState('');
  const [tried, setTried] = useState(false);
  const v = venmo.trim().replace(/^@/, ''), z = zelle.trim();
  const errors = {
    name: !name.trim() ? 'Add your name so friends know who to pay.' : '',
    title: !title.trim() ? 'Name the bill, like the restaurant.' : '',
    pay: !v && !z ? 'Add Venmo, Zelle, or both so friends can pay you back.' : '',
    venmo: v && !/^[A-Za-z0-9_-]{1,40}$/.test(v) ? 'Use letters, numbers, dashes, or underscores.' : '',
  };
  const valid = !Object.values(errors).some(Boolean);
  function submit(e: FormEvent) {
    e.preventDefault(); setTried(true);
    if (!valid || create.isPending) return;
    create.mutate({ data: { name: name.trim(), title: title.trim(), ...(v ? { venmo: v } : {}), ...(z ? { zelle: z } : {}) } }, {
      onSuccess: bill => { qc.setQueryData(getGetBillQueryKey(bill.id), bill); navigate('/b/' + bill.id); },
    });
  }
  return <div className="split-v2">
    <Topbar />
    <OfflineBanner />
    <div className="sp-layout" style={{ display: 'block', maxWidth: 620 }}>
      <main className="sp-page">
        <div className="sp-heading sp-hero-create"><h1 style={{ marginTop: 8 }}>Start a bill</h1></div>
        <form className="sp-card sp-pad sp-stack" onSubmit={submit} noValidate>
          <label className="sp-field">Your name<input data-testid="input-host-name" value={name} maxLength={40} autoComplete="given-name" onChange={e => setName(e.target.value)} placeholder="First name" />{tried && errors.name && <span className="sp-error-text">{errors.name}</span>}</label>
          <label className="sp-field">What is this bill?<input data-testid="input-title" value={title} maxLength={100} onChange={e => setTitle(e.target.value)} placeholder="Dinner at Lucia's" />{tried && errors.title && <span className="sp-error-text">{errors.title}</span>}</label>
          <div><h3>How friends pay you</h3><p className="sp-small sp-muted">At least one. Payments happen in Venmo or your bank, never in Billo.</p></div>
          <label className="sp-field">Venmo username<input data-testid="input-venmo" value={venmo} maxLength={41} autoCapitalize="none" autoCorrect="off" onChange={e => setVenmo(e.target.value)} placeholder="@username" />{errors.venmo && <span className="sp-error-text">{errors.venmo}</span>}</label>
          <label className="sp-field">Zelle email or phone<input data-testid="input-zelle" value={zelle} maxLength={120} autoCapitalize="none" autoCorrect="off" onChange={e => setZelle(e.target.value)} placeholder="Email or US mobile number" /></label>
          {tried && errors.pay && <div className="sp-notice warning"><Info size={17} />{errors.pay}</div>}
          {create.isError && <div className="sp-notice warning" role="alert"><Info size={17} />{errorMessage(create.error, 'The bill could not be created. Try again.')}</div>}
          <button type="submit" data-testid="button-create-bill" className="sp-button full" disabled={create.isPending}>{create.isPending ? <><Spinner />Creating</> : <>Continue<ArrowRight size={18} /></>}</button>
        </form>
      </main>
    </div>
  </div>;
}
