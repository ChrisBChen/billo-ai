import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, Moon, Sun, WifiOff } from 'lucide-react';
import { Link } from 'wouter';
import { initial } from '@/lib/billo';

type Theme = 'light' | 'dark';
const THEME_KEY = 'billo-theme';
function applyTheme(t: Theme) {
  const d = document.documentElement;
  d.dataset.theme = t; d.classList.toggle('dark', t === 'dark');
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'dark' ? '#141217' : '#f6f1e7');
}
function readTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const t = document.documentElement.dataset.theme;
  return t === 'dark' ? 'dark' : 'light';
}
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSys = (e: MediaQueryListEvent) => {
      let saved: string | null = null; try { saved = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
      if (saved !== 'light' && saved !== 'dark') { const t: Theme = e.matches ? 'dark' : 'light'; applyTheme(t); setTheme(t); }
    };
    const onStorage = (e: StorageEvent) => { if (e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark')) { applyTheme(e.newValue); setTheme(e.newValue); } };
    mq.addEventListener('change', onSys); window.addEventListener('storage', onStorage);
    return () => { mq.removeEventListener('change', onSys); window.removeEventListener('storage', onStorage); };
  }, []);
  const toggle = () => {
    const next: Theme = readTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next); setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  };
  return { theme, toggle };
}
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return <button type="button" className="sp-theme-toggle" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={dark} title={dark ? 'Light mode' : 'Dark mode'} data-testid="button-theme-toggle">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>;
}
export function Topbar({ context }: { context?: ReactNode }) {
  return <header className="sp-topbar"><Link href="/" className="sp-brand" aria-label="Billo home, start a new receipt" data-testid="link-home" style={{ color: 'inherit', textDecoration: 'none' }}><img className="sp-brand-logo" src={`${import.meta.env.BASE_URL}billo-logo.png`} alt="" width={36} height={36} />Billo</Link><div className="sp-topbar-end">{context && <span className="sp-context">{context}</span>}<ThemeToggle /></div></header>;
}
export function Avatar({ name, index }: { name: string; index: number }) {
  return <span className={`sp-avatar sp-a${index % 4}`} aria-hidden="true">{initial(name)}</span>;
}
export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}
export function OfflineBanner({ stale }: { stale?: boolean }) {
  const online = useOnline();
  if (online && !stale) return null;
  return <div className="sp-banner" role="status" data-testid="status-offline"><WifiOff size={16} />{online ? 'Reconnecting. Showing the last saved bill.' : 'You are offline. Changes will not save until you reconnect.'}</div>;
}
export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return <div className="sp-toast" role="status" aria-live="polite" data-testid="status-toast">{message}</div>;
}
export function useToastMessage() {
  const [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3600); return () => clearTimeout(t); }, [toast]);
  return [toast, setToast] as const;
}
export function Spinner() { return <Loader2 size={18} className="sp-spin" />; }
export function SkeletonPage() {
  return <div className="sp-stack" aria-busy="true" aria-label="Loading bill">
    <div className="sp-skeleton" style={{ height: 18, width: 160 }} />
    <div className="sp-skeleton" style={{ height: 34, width: '60%' }} />
    <div className="sp-skeleton" style={{ height: 300 }} />
  </div>;
}
