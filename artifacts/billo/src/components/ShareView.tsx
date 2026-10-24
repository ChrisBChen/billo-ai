import { QRCodeSVG } from 'qrcode.react';
import { Copy, Link2, Share2 } from 'lucide-react';
import type { BillView } from '@workspace/api-client-react';
import { billUrl, money } from '@/lib/billo';

export function ShareView({ bill, notify }: { bill: BillView; notify: (m: string) => void }) {
  const url = billUrl(bill.id);
  async function copy() {
    try { await navigator.clipboard.writeText(url); notify('Link copied'); }
    catch { notify('Copy unavailable. Select the link text instead.'); }
  }
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: bill.title, text: `Pick what you had from ${bill.title} on Billo`, url }); } catch { /* dismissed */ }
    } else await copy();
  }
  return <div className="sp-card sp-pad sp-stack sp-content">
    <div className="sp-share-card"><h2>{bill.title}</h2><p className="sp-small sp-muted">{bill.participants.length} {bill.participants.length === 1 ? 'person' : 'people'}{bill.receipt.totalCents ? ` · ${money(bill.receipt.totalCents)}` : ''}</p>
      <div className="sp-qr-real" data-testid="img-qr"><QRCodeSVG value={url} size={176} fgColor="#17151c" bgColor="#fffcf5" level="M" /></div>
      <p className="sp-small sp-muted">Friends scan with their phone camera</p></div>
    <div className="sp-link-box"><Link2 size={19} /><span className="sp-grow sp-small" data-testid="text-share-url" style={{ userSelect: 'all' }}>{url}</span><button className="sp-icon" data-testid="button-copy-link" aria-label="Copy bill link" onClick={copy}><Copy size={19} /></button></div>
    <button className="sp-button full" data-testid="button-share" onClick={share}><Share2 size={18} />Share link</button>
    <p className="sp-small sp-muted">Anyone with this link can join by name and choose items.</p>
  </div>;
}
