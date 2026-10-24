import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Info, LockKeyhole } from 'lucide-react';
import { getGetBillQueryKey, getGetInviteQueryKey, useGetInvite, useJoinBill } from '@workspace/api-client-react';
import { Spinner } from '@/components/Chrome';
import { errorMessage, errorStatus } from '@/lib/billo';

export function JoinScreen({ id, onJoined }: { id: string; onJoined: () => void }) {
  const qc = useQueryClient();
  const invite = useGetInvite(id, { query: {
    queryKey: getGetInviteQueryKey(id),
    retry: (count, error) => count < 1 && (errorStatus(error) === undefined || errorStatus(error)! >= 500),
    refetchOnWindowFocus: false, refetchOnReconnect: false,
  } });
  const join = useJoinBill();
  const [name, setName] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || join.isPending) return;
    join.mutate({ id, data: { name: name.trim() } }, { onSuccess: async bill => {
      await qc.cancelQueries({ queryKey: getGetBillQueryKey(id) });
      qc.setQueryData(getGetBillQueryKey(id), bill);
      onJoined();
    } });
  }
  if (invite.isLoading) return <div className="sp-stack sp-content"><div className="sp-skeleton" style={{ height: 34, width: '55%' }} /><div className="sp-skeleton" style={{ height: 220 }} /></div>;
  if (invite.isError && !invite.data) {
    const missing = errorStatus(invite.error) === 404;
    const reviewing = errorStatus(invite.error) === 409;
    return <div className="sp-card sp-pad sp-stack sp-content sp-center"><div className="sp-state-symbol">{reviewing ? <LockKeyhole size={26} /> : <Info size={26} />}</div><h2>{missing ? 'This bill link does not exist' : reviewing ? 'Waiting for payer confirmation' : 'Could not load this invite'}</h2><p className="sp-muted">{missing ? 'Check the link with whoever paid.' : errorMessage(invite.error)}</p>{missing ? <Link href="/" className="sp-button">Start a new bill</Link> : <button className="sp-button" data-testid="button-retry-invite" onClick={() => invite.refetch()}>{reviewing ? 'Check again' : 'Try again'}</button>}</div>;
  }
  const closed = invite.data?.status === 'closed';
  return <div className="sp-content">
    <div className="sp-heading"><span className="sp-context">You are invited</span><h1 data-testid="text-invite-title">{invite.data?.title}</h1><p>Enter your name to pick what you had. No account needed.</p></div>
    <form className="sp-card sp-pad sp-stack" onSubmit={submit}>
      {closed && <div className="sp-notice warning"><LockKeyhole size={17} />This bill is already closed. Ask the payer for your amount.</div>}
      <label className="sp-field">Your name<input data-testid="input-join-name" value={name} maxLength={40} autoFocus autoComplete="given-name" onChange={e => setName(e.target.value)} placeholder="First name" /></label>
      {join.isError && <div className="sp-notice warning" role="alert"><Info size={17} />{errorMessage(join.error, 'Could not join. Try again.')}</div>}
      <button className="sp-button full" type="submit" data-testid="button-join" disabled={!name.trim() || join.isPending || closed}>{join.isPending ? <><Spinner />Joining</> : <>Join bill<ArrowRight size={18} /></>}</button>
      <p className="sp-small sp-muted">This device remembers you for this bill.</p>
    </form>
  </div>;
}
