import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Info, LockKeyhole, ReceiptText, Share2, Users, Utensils, type LucideIcon } from 'lucide-react';
import { getGetBillQueryKey, useGetBill, type BillItem, type BillView, type ReceiptDraft } from '@workspace/api-client-react';
import { OfflineBanner, SkeletonPage, Toast, Topbar, useToastMessage } from '@/components/Chrome';
import { JoinScreen } from '@/components/JoinScreen';
import { ItemsView, BreakdownLines } from '@/components/ItemsView';
import { ReceiptEntry } from '@/components/ReceiptEntry';
import { ReceiptEditor } from '@/components/ReceiptEditor';
import { ReceiptView } from '@/components/ReceiptView';
import { SplitSheet } from '@/components/SplitSheet';
import { ShareView } from '@/components/ShareView';
import { GroupView } from '@/components/GroupView';
import { CloseSheet } from '@/components/CloseSheet';
import { PaymentSheet } from '@/components/PaymentSheet';
import { Sheet } from '@/components/Sheet';
import { useBillActions } from '@/hooks/use-bill-actions';
import { errorMessage, errorStatus, money } from '@/lib/billo';

type Tab = 'items' | 'receipt' | 'share' | 'group';
type Modal = 'close' | 'payment' | 'breakdown' | null;

export default function BillPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [toast, setToast] = useToastMessage();
  const query = useGetBill(id, { query: { queryKey: getGetBillQueryKey(id), refetchInterval: 1500, retry: false, refetchOnWindowFocus: true } });
  const status = query.error ? errorStatus(query.error) : undefined;
  const bill = query.data;
  const needsJoin = status === 401;
  let body;
  if (needsJoin) body = <JoinScreen id={id} />;
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
  const [tab, setTab] = useState<Tab>(isHost && !bill.receipt.items.length ? 'receipt' : 'items');
  const [modal, setModal] = useState<Modal>(null);
  const [splitItemId, setSplitItemId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ draft: ReceiptDraft; source: string } | null>(null);
  const { send, pending } = useBillActions(bill, notify);
  const shown = useRef(false);

  useEffect(() => {
    if (closed && !isHost && !shown.current) { shown.current = true; setSplitItemId(null); setModal('payment'); }
    if (closed) setEditing(null);
  }, [closed, isHost]);

  const splitItem = splitItemId ? bill.receipt.items.find(i => i.id === splitItemId) : undefined;
  useEffect(() => { if (splitItemId && !splitItem) { setSplitItemId(null); notify('That item was removed from the receipt.'); } }, [splitItemId, splitItem, notify]);

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
    items: closed ? ['Your items', 'Amounts are locked.'] : bill.splitMode === 'equal' ? ['Even split', 'Everyone pays the same share.'] : ['Choose your items', ''],
    receipt: editing ? ['Review receipt', 'Check every line before saving.'] : isHost && !bill.receipt.items.length ? ['Add the receipt', 'Scan it or type it in.'] : ['Receipt', ''],
    share: ['Invite friends', 'Everyone at the table joins with this link.'],
    group: closed ? ['Group & payments', 'Who has reported paying.'] : ['Group', 'Who is in and who is done.'],
  };
  const payerName = bill.participants.find(p => p.isPayer)?.name ?? '';

  return <>
    <Topbar context={<>{bill.title}{closed && <> · <LockKeyhole size={13} style={{ display: 'inline', verticalAlign: '-1px' }} /> Closed</>}</>} />
    <OfflineBanner stale={stale} />
    <div className="sp-layout">
      <aside className="sp-rail">
        <div className="sp-restaurant"><Utensils size={25} /><div><h3>{bill.title}</h3><p className="sp-small sp-muted">{payerName} paid · {bill.participants.length} {bill.participants.length === 1 ? 'person' : 'people'}</p></div></div>
        <nav aria-label="Bill navigation">{nav.map(({ tab: t, label, icon: Icon }) => <button key={t} data-testid={`nav-${t}`} className={tab === t ? 'active' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => go(t)}><Icon size={18} />{label}</button>)}</nav>
        <p className="sp-rail-note">{closed ? `Closed · ${money(bill.outstandingCents)} still owed` : 'Updates live as people choose.'}</p>
      </aside>
      <main className="sp-main">
        <div key={tab} className={`sp-page ${tab === 'items' ? 'sp-select-page' : ''}`}>
          <div className="sp-heading">
            <h1>{titles[tab][0]}</h1>{titles[tab][1] && <p>{titles[tab][1]}</p>}
          </div>
          <nav className="sp-mobile-tabs" aria-label="Bill navigation">{(['items', 'receipt', 'group'] as Tab[]).map((t, i) => <button key={t} data-testid={`tab-${t}`} className={tab === t ? 'active' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => go(t)}>{['Items', 'Receipt', 'Group'][i]}</button>)}</nav>
          {tab === 'items' && <ItemsView bill={bill} send={send} pending={pending} onSplit={(item: BillItem) => setSplitItemId(item.id)} onBreakdown={() => setModal('breakdown')} onPrimary={primary} onAddReceipt={() => go('receipt')} />}
          {tab === 'receipt' && (editing
            ? <ReceiptEditor key={editing.source + editing.draft.items.length} bill={bill} draft={editing.draft} source={editing.source} send={send} pending={pending} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); go('share'); }} />
            : isHost && !closed && !bill.receipt.items.length ? <ReceiptEntry bill={bill} onDraft={(draft, source) => setEditing({ draft, source })} />
            : <ReceiptView bill={bill} canEdit={isHost && !closed} onEdit={() => setEditing({ draft: bill.receipt, source: 'Saved receipt' })} />)}
          {tab === 'share' && <ShareView bill={bill} notify={notify} />}
          {tab === 'group' && <GroupView bill={bill} send={send} pending={pending} onClose={() => setModal('close')} onPay={() => setModal('payment')} />}
        </div>
      </main>
    </div>
    {splitItem && !closed && <SplitSheet key={splitItem.id} bill={bill} item={splitItem} send={send} pending={pending} onClose={() => setSplitItemId(null)} />}
    {modal === 'close' && isHost && !closed && <CloseSheet bill={bill} send={send} pending={pending} onClose={() => setModal(null)} />}
    {modal === 'payment' && closed && !isHost && <PaymentSheet bill={bill} send={send} pending={pending} notify={notify} onClose={() => setModal(null)} />}
    {modal === 'breakdown' && <Sheet title={closed ? 'Your final share' : 'Your estimated share'} onClose={() => setModal(null)}><BreakdownLines bill={bill} /></Sheet>}
  </>;
}
