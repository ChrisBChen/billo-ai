import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetBillQueryKey, useChangeBill, type BillChange, type BillView } from '@workspace/api-client-react';
import { errorMessage } from '@/lib/billo';

export type Change = Omit<BillChange, 'revision'> & { revision?: number };

/** Queue local writes; the database serializes writes from all devices per bill. */
export function useBillActions(bill: BillView, notify: (m: string) => void) {
  const qc = useQueryClient();
  const mutation = useChangeBill();
  const billRef = useRef(bill);
  billRef.current = bill;
  const mutateRef = useRef(mutation.mutateAsync);
  mutateRef.current = mutation.mutateAsync;
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [queued, setQueued] = useState(0);
  function send(change: Change, opts?: { success?: string; onSuccess?: (b: BillView) => void; onError?: () => void }) {
    setQueued(n => n + 1);
    queue.current = queue.current.then(async () => {
      const current = billRef.current;
      try {
        await qc.cancelQueries({ queryKey: getGetBillQueryKey(current.id) });
        const next = await mutateRef.current({ id: current.id, data: { ...change, revision: change.revision ?? current.revision } });
        await qc.cancelQueries({ queryKey: getGetBillQueryKey(current.id) });
        billRef.current = next;
        qc.setQueryData(getGetBillQueryKey(current.id), next);
        if (opts?.success) notify(opts.success);
        opts?.onSuccess?.(next);
      } catch (err) {
        // Capacity may genuinely have changed, but the form remains editable.
        qc.invalidateQueries({ queryKey: getGetBillQueryKey(current.id) });
        notify(errorMessage(err, 'That change could not be saved. Try again.'));
        opts?.onError?.();
      } finally { setQueued(n => n - 1); }
    });
  }
  return { send, pending: queued > 0 };
}
