import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Info } from 'lucide-react';
import { getGetBillQueryKey, useCreateBill } from '@workspace/api-client-react';
import { OfflineBanner, Spinner, Topbar } from '@/components/Chrome';
import { errorMessage } from '@/lib/billo';

const CREATE_BILL_HEADLINES = [
  "Let's get down to bill-ness.",
  'Your tab awaits.',
  'Let the splitting begin.',
];
const CREATE_BILL_HEADLINE_KEY = 'billo-create-bill-headline';
let fallbackHeadlineIndex = 0;

function getSavedHeadlineIndex() {
  if (typeof window === 'undefined') return fallbackHeadlineIndex;
  try {
    const stored = window.localStorage.getItem(CREATE_BILL_HEADLINE_KEY);
    const saved = stored === null ? fallbackHeadlineIndex : Number(stored);
    if (Number.isInteger(saved) && saved >= 0 && saved < CREATE_BILL_HEADLINES.length) {
      fallbackHeadlineIndex = saved;
      return saved;
    }
  } catch {
    // Keep the in-memory sequence if browser storage is unavailable.
  }
  return fallbackHeadlineIndex;
}

function saveNextHeadlineIndex(index: number) {
  const nextIndex = (index + 1) % CREATE_BILL_HEADLINES.length;
  fallbackHeadlineIndex = nextIndex;
  try {
    window.localStorage.setItem(CREATE_BILL_HEADLINE_KEY, String(nextIndex));
  } catch {
    // Storage may be unavailable in private browsing; bill creation still works.
  }
}

export default function CreateBill() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const create = useCreateBill();
  const [name, setName] = useState('');
  const [venmo, setVenmo] = useState('');
  const [zelle, setZelle] = useState('');
  const [tried, setTried] = useState(false);
  const [headlineIndex] = useState(getSavedHeadlineIndex);
  useEffect(() => {
    saveNextHeadlineIndex(headlineIndex);
  }, [headlineIndex]);
  const v = venmo.trim().replace(/^@/, ''), z = zelle.trim();
  const errors = {
    name: !name.trim() ? 'Add your name so friends know who to pay.' : '',
    pay: !v && !z ? 'Add Venmo, Zelle, or both so friends can pay you back.' : '',
    venmo: v && !/^[A-Za-z0-9_-]{1,40}$/.test(v) ? 'Use letters, numbers, dashes, or underscores.' : '',
  };
  const valid = !Object.values(errors).some(Boolean);
  function submit(e: FormEvent) {
    e.preventDefault(); setTried(true);
    if (!valid || create.isPending) return;
    create.mutate({ data: { name: name.trim(), title: 'New bill', ...(v ? { venmo: v } : {}), ...(z ? { zelle: z } : {}) } }, {
      onSuccess: bill => {
        saveNextHeadlineIndex(headlineIndex);
        qc.setQueryData(getGetBillQueryKey(bill.id), bill);
        navigate('/b/' + bill.id);
      },
    });
  }
  return <div className="split-v2">
    <Topbar />
    <OfflineBanner />
    <div className="sp-layout" style={{ display: 'block', maxWidth: 620 }}>
      <main className="sp-page">
        <div className="sp-heading sp-hero-create"><h1 style={{ marginTop: 8 }} aria-live="off">{CREATE_BILL_HEADLINES[headlineIndex]}</h1></div>
        <form className="sp-stack" onSubmit={submit} noValidate>
          <div className="sp-card sp-pad sp-stack">
            <h2><label htmlFor="host-name">Your name</label></h2>
            <input id="host-name" data-testid="input-host-name" value={name} maxLength={40} autoComplete="given-name" onChange={e => setName(e.target.value)} placeholder="First name" />
            {tried && errors.name && <span className="sp-error-text">{errors.name}</span>}
          </div>
          <section className="sp-card sp-pad sp-stack" aria-labelledby="payment-heading">
            <div>
              <h2 id="payment-heading">Payment method</h2>
              <p id="payment-requirement" className="sp-small sp-muted" style={{ marginTop: 6 }}>Enter at least one.</p>
            </div>
            <div className="sp-stack">
              <label className="sp-field">Venmo username<input data-testid="input-venmo" value={venmo} maxLength={41} autoCapitalize="none" autoCorrect="off" aria-describedby="payment-requirement" onChange={e => setVenmo(e.target.value)} placeholder="@username" />{errors.venmo && <span className="sp-error-text">{errors.venmo}</span>}</label>
              <div className="sp-payment-or" aria-hidden="true">or</div>
              <label className="sp-field">Zelle email or phone<input data-testid="input-zelle" value={zelle} maxLength={120} autoCapitalize="none" autoCorrect="off" aria-describedby="payment-requirement" onChange={e => setZelle(e.target.value)} placeholder="Email or US mobile number" /></label>
              {tried && errors.pay && <div className="sp-notice warning" role="alert"><Info size={17} />{errors.pay}</div>}
            </div>
          </section>
          {create.isError && <div className="sp-notice warning" role="alert"><Info size={17} />{errorMessage(create.error, 'The bill could not be created. Try again.')}</div>}
          <button type="submit" data-testid="button-create-bill" className="sp-button full" disabled={create.isPending}>{create.isPending ? <><Spinner />Creating</> : <>Continue<ArrowRight size={18} /></>}</button>
        </form>
      </main>
    </div>
  </div>;
}
