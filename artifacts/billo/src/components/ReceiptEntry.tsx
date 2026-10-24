import { useRef, useState, type ChangeEvent } from 'react';
import { ChevronRight, Info, LockKeyhole, ReceiptText, ScanLine, Upload } from 'lucide-react';
import { useScanReceipt, type BillView, type ReceiptDraft } from '@workspace/api-client-react';
import { Spinner } from '@/components/Chrome';
import { errorMessage } from '@/lib/billo';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 8 * 1024 * 1024;

export function ReceiptEntry({ bill, onDraft }: { bill: BillView; onDraft: (d: ReceiptDraft, source: string) => void }) {
  const scan = useScanReceipt();
  const camRef = useRef<HTMLInputElement>(null), fileRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState('');
  function pick(e: ChangeEvent<HTMLInputElement>, source: string) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProblem('');
    if (!TYPES.includes(file.type)) { setProblem('Use a JPEG, PNG, or WebP photo.'); return; }
    if (file.size > MAX) { setProblem('That photo is over 8 MB. Try a smaller one or a screenshot.'); return; }
    const reader = new FileReader();
    reader.onerror = () => setProblem('Could not read that photo. Try another.');
    reader.onload = () => {
      const dataUrl = String(reader.result);
      scan.mutate({ id: bill.id, data: { dataUrl } }, {
        onSuccess: draft => onDraft(draft, source),
        onError: err => setProblem(errorMessage(err, 'We could not read that receipt. Try a clearer photo or enter it manually.')),
      });
    };
    reader.readAsDataURL(file);
  }
  const blank: ReceiptDraft = { ...bill.receipt, title: bill.receipt.title || bill.title, items: [], taxCents: 0, tipMode: 'percent', tipValue: 2000, adjustmentCents: 0, totalCents: 0, warnings: [] };
  return <div className="sp-content sp-stack">
    <input ref={camRef} className="sp-file-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => pick(e, 'Scanned from camera')} data-testid="input-camera" />
    <input ref={fileRef} className="sp-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => pick(e, 'Scanned from photo')} data-testid="input-photo" />
    {scan.isPending ? <div className="sp-card sp-pad sp-stack sp-center" aria-live="polite"><div className="sp-state-symbol"><Spinner /></div><h2>Reading your receipt</h2><p className="sp-muted">This takes a few seconds. You will review everything before it is saved.</p></div> : <>
      {[{ icon: ScanLine, label: 'Take a photo', sub: 'Use your camera', on: () => camRef.current?.click(), id: 'camera' }, { icon: Upload, label: 'Upload a photo', sub: 'JPEG, PNG, or WebP up to 8 MB', on: () => fileRef.current?.click(), id: 'upload' }, { icon: ReceiptText, label: 'Enter manually', sub: 'Type items and prices', on: () => onDraft(blank, 'Manual entry'), id: 'manual' }].map(({ icon: Icon, label, sub, on, id }) =>
        <button key={id} data-testid={`button-receipt-${id}`} className="sp-choice" onClick={on}><Icon size={24} /><div className="sp-grow"><h3>{label}</h3><p className="sp-small">{sub}</p></div><ChevronRight size={20} /></button>)}
    </>}
    {problem && <div className="sp-notice warning" role="alert"><Info size={17} />{problem}</div>}
    <div className="sp-notice"><LockKeyhole size={17} />Your photo is sent to our AI provider to read the receipt. Billo does not save the image; only the receipt details you review and save are kept.</div>
  </div>;
}
