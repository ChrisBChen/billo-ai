import { useRef, useState, type ChangeEvent } from 'react';
import { ChevronRight, Info, ReceiptText, ScanLine, Upload } from 'lucide-react';
import { useScanReceipt, type BillView, type ReceiptDraft } from '@workspace/api-client-react';
import { Spinner } from '@/components/Chrome';
import { errorMessage } from '@/lib/billo';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 8 * 1024 * 1024;

// Vercel Functions reject request bodies over ~4.5 MB, so large photos are re-encoded as JPEG first.
const SEND_LIMIT = 3_000_000;
async function shrinkForUpload(dataUrl: string): Promise<string> {
  if (dataUrl.length <= SEND_LIMIT) return dataUrl;
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  for (const [side, quality] of [[2200, 0.85], [1600, 0.8], [1200, 0.75]] as const) {
    const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL('image/jpeg', quality);
    if (out.length <= SEND_LIMIT) return out;
  }
  throw new Error('too large');
}

export function ReceiptEntry({ bill, onDraft }: { bill: BillView; onDraft: (d: ReceiptDraft, source: string) => void }) {
  const scan = useScanReceipt();
  const camRef = useRef<HTMLInputElement>(null), fileRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState('');
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const busy = processing || scan.isPending;
  function pick(e: ChangeEvent<HTMLInputElement>, source: string) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || processingRef.current) return;
    setProblem('');
    if (!TYPES.includes(file.type)) { setProblem('Use a JPEG, PNG, or WebP photo.'); return; }
    if (file.size > MAX) { setProblem('That photo is over 8 MB. Try a smaller one or a screenshot.'); return; }
    processingRef.current = true;
    setProcessing(true);
    const reader = new FileReader();
    const readFailed = () => {
      processingRef.current = false;
      setProcessing(false);
      setProblem('Could not read that photo. Try another.');
    };
    reader.onerror = readFailed;
    reader.onabort = readFailed;
    reader.onload = () => {
      if (typeof reader.result !== 'string') { readFailed(); return; }
      shrinkForUpload(reader.result).then(dataUrl => {
        scan.mutate({ id: bill.id, data: { dataUrl } }, {
          onSuccess: draft => onDraft(draft, source),
          onError: err => setProblem(errorMessage(err, 'We could not read that receipt. Try a clearer photo or enter it manually.')),
          onSettled: () => { processingRef.current = false; setProcessing(false); },
        });
      }, readFailed);
    };
    try { reader.readAsDataURL(file); } catch { readFailed(); }
  }
  const blank: ReceiptDraft = { ...bill.receipt, title: bill.receipt.title || bill.title, items: [], taxCents: 0, tipMode: 'percent', tipValue: 2000, adjustmentCents: 0, totalCents: 0, warnings: [] };
  return <div className="sp-content sp-stack">
    <input ref={camRef} className="sp-file-input" hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} onChange={e => pick(e, 'Scanned from camera')} data-testid="input-camera" />
    <input ref={fileRef} className="sp-file-input" hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => pick(e, 'Scanned from photo')} data-testid="input-photo" />
    {busy ? <div className="sp-card sp-pad sp-stack sp-center" role="status" aria-live="polite" aria-busy="true" data-testid="status-reading-receipt"><div className="sp-state-symbol"><Spinner /></div><h2>{scan.isPending ? 'Reading your receipt' : 'Preparing your photo'}</h2><p className="sp-muted">This takes a few seconds. You will review everything before it is saved.</p></div> : <>
      {[{ icon: ScanLine, label: 'Take a photo', sub: 'Use your camera', on: () => camRef.current?.click(), id: 'camera' }, { icon: Upload, label: 'Upload a photo', sub: 'JPEG, PNG, or WebP up to 8 MB', on: () => fileRef.current?.click(), id: 'upload' }, { icon: ReceiptText, label: 'Enter manually', sub: 'Type items and prices', on: () => onDraft(blank, 'Manual entry'), id: 'manual' }].map(({ icon: Icon, label, sub, on, id }) =>
        <button key={id} data-testid={`button-receipt-${id}`} className="sp-choice" onClick={on}><Icon size={24} /><div className="sp-grow"><h3>{label}</h3><p className="sp-small">{sub}</p></div><ChevronRight size={20} /></button>)}
    </>}
    {problem && <div className="sp-notice warning" role="alert"><Info size={17} />{problem}</div>}
    <p className="sp-receipt-disclaimer">Your photo is sent to our AI provider to read the receipt. Billo does not save the image; only the receipt details you review and save are kept.</p>
  </div>;
}
