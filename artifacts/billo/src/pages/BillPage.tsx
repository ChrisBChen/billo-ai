import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Info, LockKeyhole, ReceiptText, Share2, Users, Utensils, type LucideIcon } from 'lucide-react';
import { getGetBillQueryKey, useGetBill, type BillView, type ReceiptDraft } from '@workspace/api-client-react';
import { OfflineBanner, SkeletonPage, Toast, Topbar, useToastMessage } from '@/components/Chrome';
import { JoinScreen } from '@/components/JoinScreen';
import { ItemsView, BreakdownLines } from '@/components/ItemsView';
import { ReceiptEntry } from '@/components/ReceiptEntry';
import { ReceiptEditor } from '@/components/ReceiptEditor';
import { ReceiptView } from '@/components/ReceiptView';
import { ShareView } from '@/components/ShareView';
import { GroupView } from '@/components/GroupView';
import { CloseSheet } from '@/components/CloseSheet';
import { PaymentSheet } from '@/components/PaymentSheet';
import { Sheet } from '@/components/Sheet';
import { useBillActions } from '@/hooks/use-bill-actions';
import { billReady, errorMessage, errorStatus } from '@/lib/billo';

type Tab = 'items' | 'receipt' | 'share' | 'group';
type Modal = 'close' | 'payment' | 'breakdown' | null;

export default function BillPage({ params }: { params: { id: string } }) {
  return <BillSession key={params.id} params={params} />;
}

function BillSession({ params }: { params: { id: string } }) {
  const id = params.id;
  const [toast, setToast] = useToastMessage();
  const [joining, setJoining] = useState(false);
  const query = useGetBill(id, { query: {
    queryKey: getGetBillQueryKey(id), enabled: !joining, retry: false,
    refetchInterval: q => q.state.data && errorStatus(q.state.error) !== 401 ? 1500 : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: q => !!q.state.data && errorStatus(q.state.error) !== 401,
    refetchOnReconnect: q => !!q.state.data && errorStatus(q.state.error) !== 401,
  } });
  const status = query.error ? errorStatus(query.error) : undefined;
  const bill = query.data;
  const needsJoin = joining || status === 401;
  useEffect(() => { if (status === 401) setJoining(true); }, [status]);
  let body;
  if (needsJoin) body = <JoinScreen id={id} onJoined={() => setJoining(false)} />;
  else if (bill) body = <BillScreen key={bill.id} bill={bill} notify={setToast} stale={query.isError} />;
  else if (query.isLoading) body = <SkeletonPage />;
  else body = <div className="sp-card sp-pad sp-stack sp-center sp-content"><div className="sp-state-symbol"><Info size={26} /></div>
    <h2>{status === 404 ? 'Bill not found' : 'Could not load this bill'}</h2>
    <p className="sp-muted">{status === 404 ? 'The link may be wrong. Ask whoever paid to share it again.' : errorMessage(query.error)}</p>
    {status === 404 ? <Link href="/" className="sp-button">Start a new bill</Link> : <button className="sp-button" data-testid="button-retry" onClick={() => query.refetch()}>Try again</button>}</div>;
  return <div className="split-v2">
    {!bill || needsJoin ? <><Topbar /><OfflineBanner /><div className="sp-layout" style={{ display: 'block', maxWidth: 680 }}><main className="sp-page">{body}</main></div></> : <>{body}</>}
    <Toast message={toast} />
  </div>;
}

function BillScreen({ bill, notify, stale }: { bill: BillView; notify: (m: string) => void; stale: boolean }) {
  const isHost = bill.meId === bill.payerId, closed = bill.status === 'closed';
  const [selectedTab, setTab] = useState<Tab>(isHost && !billReady(bill) ? 'receipt' : 'items');
  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<{ draft: ReceiptDraft; source: string } | null>(null);
  const reviewRequired = !closed && (!bill.receiptConfirmed || !!editing);
  const tab: Tab = reviewRequired ? 'receipt' : selectedTab;
  const { send, pending } = useBillActions(bill, notify);
  const shown = useRef(false);
  useEffect(() => {
    if (reviewRequired) setModal(null);
  }, [reviewRequired]);

  useEffect(() => {
    if (closed && !isHost && !shown.current) { shown.current = true; setModal('payment'); }
    if (closed) setEditing(null);
  }, [closed, isHost]);


  function go(t: Tab) { setTab(t); window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }
  function primary() {
    if (closed) { if (isHost) go('group'); else setModal('payment'); return; }
    const me = bill.participants.find(p => p.id === bill.meId);
    send({ action: 'finish', finished: !me?.finished }, { success: me?.finished ? 'You can change your items again' : 'Confirmed. We will let you know when it closes.' });
  }
  const nav: { tab: Tab; label: string; icon: LucideIcon }[] = [
    { tab: 'items', label: 'My items', icon: Utensils },
    { tab: 'receipt', label: 'Receipt', icon: ReceiptText },
    { tab: 'share', label: 'Invite friends', icon: Share2 },
    { tab: 'group', label: 'Group', icon: Users },
  ];
  const titles: Record<Tab, [string, string]> = {
    items: closed ? ['Your items', 'Amounts are locked.'] : ['Claim your share', ''],
    receipt: editing ? ['Review receipt', 'Check every line before confirming.'] : isHost && !bill.receipt.items.length ? ['Add the receipt', ''] : isHost && !closed && !billReady(bill) ? ['Confirm the receipt', 'Review the items and tip.'] : ['Receipt', ''],
    share: ['Invite friends', ''],
    group: closed ? ['Group & payments', 'Who has reported paying.'] : ['Group', ''],
  };

  if (!isHost && reviewRequired) return <>
    <Topbar context={bill.title} /><OfflineBanner stale={stale} />
    <div className="sp-layout" style={{ display: 'block', maxWidth: 680 }}><main className="sp-card sp-pad sp-stack">
      <LockKeyhole size={24} /><h1>Waiting for the payer</h1>
      <p>The receipt and tip need to be confirmed before anyone can choose items.</p>
    </main></div>
  </>;

  return <>
    <Topbar context={<>{bill.title}{closed && <> · <LockKeyhole size={13} style={{ display: 'inline', verticalAlign: '-1px' }} /> Closed</>}</>} />
    <OfflineBanner stale={stale} />
    <div className="sp-layout">
      <aside className="sp-rail">
        <div className="sp-restaurant"><Utensils size={25} /><div><h3>{bill.title}</h3></div></div>
        {!reviewRequired && <nav aria-label="Bill navigation">{nav.map(({ tab: t, label, icon: Icon }) => <button key={t} data-testid={`nav-${t}`} className={tab === t ? 'active' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => go(t)}><Icon size={18} />{label}</button>)}</nav>}
      </aside>
      <main className="sp-main">
        <div key={tab} className={`sp-page ${tab === 'items' ? 'sp-select-page' : ''}`}>
          <div className="sp-heading">
            <h1>{titles[tab][0]}</h1>{titles[tab][1] && <p>{titles[tab][1]}</p>}
          </div>
          {!reviewRequired && <nav className="sp-mobile-tabs" aria-label="Bill navigation">{(['items', 'receipt', 'share', 'group'] as Tab[]).map((t, i) => <button key={t} data-testid={`tab-${t}`} className={tab === t ? 'active' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => go(t)}>{['Items', 'Receipt', 'Invite', 'Group'][i]}</button>)}</nav>}
          {tab === 'items' && <ItemsView bill={bill} send={send} pending={pending} onBreakdown={() => setModal('breakdown')} onPrimary={primary} onAddReceipt={() => go('receipt')} />}
          {tab === 'receipt' && (editing
            ? <ReceiptEditor key={editing.source + editing.draft.items.length} bill={bill} draft={editing.draft} source={editing.source} send={send} pending={pending} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); go('share'); }} />
            : isHost && !closed && !bill.receipt.items.length ? <ReceiptEntry bill={bill} onDraft={(draft, source) => setEditing({ draft, source })} />
            : <ReceiptView bill={bill} canEdit={isHost && !closed} onEdit={() => setEditing({ draft: bill.receipt, source: 'Saved receipt' })} />)}
          {tab === 'share' && <ShareView bill={bill} notify={notify} onSetup={() => go('receipt')} />}
          {tab === 'group' && <GroupView bill={bill} send={send} pending={pending} onClose={() => setModal('close')} onPay={() => setModal('payment')} />}
        </div>
      </main>
    </div>
    {modal === 'close' && isHost && !closed && !reviewRequired && <CloseSheet bill={bill} send={send} pending={pending} onClose={() => setModal(null)} />}
    {modal === 'payment' && closed && !isHost && <PaymentSheet bill={bill} send={send} pending={pending} notify={notify} onClose={() => setModal(null)} />}
    {modal === 'breakdown' && <Sheet title={closed ? 'Your final share' : 'Your estimated share'} onClose={() => setModal(null)}><BreakdownLines bill={bill} /></Sheet>}
  </>;
}
