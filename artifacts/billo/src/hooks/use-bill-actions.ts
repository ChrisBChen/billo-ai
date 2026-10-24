import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetBillQueryKey, useChangeBill, type BillChange, type BillView } from '@workspace/api-client-react';
import { errorMessage, errorStatus } from '@/lib/billo';

export type Change = Omit<BillChange, 'revision'> & { revision?: number };

/** Sends a bill change with the current revision. On 409 refetches and asks the user to retry. */
export function useBillActions(bill: BillView, notify: (m: string) => void) {
  const qc = useQueryClient();
  const mutation = useChangeBill();
  const billRef = useRef(bill);
  billRef.current = bill;
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;
  function send(change: Change, opts?: { success?: string; onSuccess?: (b: BillView) => void; onError?: () => void }) {
    const current = billRef.current;
    mutateRef.current({ id: current.id, data: { ...change, revision: change.revision ?? current.revision } }, {
      onSuccess: next => {
        qc.setQueryData(getGetBillQueryKey(current.id), next);
        if (opts?.success) notify(opts.success);
        opts?.onSuccess?.(next);
      },
      onError: err => {
        if (errorStatus(err) === 409) {
          qc.invalidateQueries({ queryKey: getGetBillQueryKey(current.id) });
          notify('Someone else just changed the bill. Your change was not saved. Check the update and try again.');
        } else notify(errorMessage(err, 'That change could not be saved. Try again.'));
        opts?.onError?.();
      },
    });
  }
  return { send, pending: mutation.isPending };
}
