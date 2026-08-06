import { useEffect, useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const WINDOW_MS = 24 * 60 * 60 * 1000;

interface MetaWindowBadgeProps {
  lastInboundAt?: string | null;
  compact?: boolean;
  className?: string;
}

export function MetaWindowBadge({ lastInboundAt, compact = false, className }: MetaWindowBadgeProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const state = useMemo(() => {
    const inbound = lastInboundAt ? Date.parse(lastInboundAt) : Number.NaN;
    if (!Number.isFinite(inbound)) return { label: compact ? '24h: sem janela' : 'Meta 24h · sem janela', tone: 'closed' };
    const remaining = inbound + WINDOW_MS - now;
    if (remaining <= 0) return { label: compact ? '24h encerrada' : 'Meta 24h · encerrada', tone: 'closed' };
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    return {
      label: compact ? `24h ${hours}h${String(minutes).padStart(2, '0')}` : `Meta 24h · ${hours}h ${String(minutes).padStart(2, '0')}m`,
      tone: remaining <= 2 * 3_600_000 ? 'danger' : remaining <= 6 * 3_600_000 ? 'warning' : 'open',
    };
  }, [compact, lastInboundAt, now]);

  return (
    <span
      title="Tempo restante para responder pela API sem modelo aprovado. Reinicia quando o cliente envia uma mensagem."
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[9px] font-medium',
        state.tone === 'open' && 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
        state.tone === 'warning' && 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
        state.tone === 'danger' && 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
        state.tone === 'closed' && 'border-muted-foreground/30 bg-muted text-muted-foreground',
        className,
      )}
    >
      <Clock3 className="h-2.5 w-2.5" />
      {state.label}
    </span>
  );
}
