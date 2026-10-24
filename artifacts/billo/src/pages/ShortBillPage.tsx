import { Link } from 'wouter';
import { useResolveBillLink } from '@workspace/api-client-react';
import { Topbar, SkeletonPage } from '@/components/Chrome';
import { errorMessage, errorStatus } from '@/lib/billo';
import BillPage from '@/pages/BillPage';

export default function ShortBillPage({ params }: { params: { code: string } }) {
  const link = useResolveBillLink(params.code, {
    query: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
  });
  // Keep the short address in the browser, but use the canonical ID for all
  // queries and cookies so old/new links share exactly the same participant.
  if (link.data) return <BillPage params={{ id: link.data.id }} />;
  const waiting = errorStatus(link.error) === 409;
  const missing = errorStatus(link.error) === 404;
  return <div className="split-v2"><Topbar />
    <main className="sp-page" style={{ maxWidth: 680, margin: '0 auto' }}>
      {link.isLoading ? <SkeletonPage /> : <div className="sp-card sp-pad sp-stack sp-center">
        <h1>{waiting ? 'Waiting for payer confirmation' : missing ? 'Bill not found' : 'Could not open this link'}</h1>
        <p className="sp-muted">{missing ? 'Check the invite link with whoever paid.' : errorMessage(link.error)}</p>
        {!missing && <button className="sp-button" onClick={() => link.refetch()}>{waiting ? 'Check again' : 'Try again'}</button>}
        <Link href="/" className="sp-link">Start a new bill</Link>
      </div>}
    </main>
  </div>;
}
