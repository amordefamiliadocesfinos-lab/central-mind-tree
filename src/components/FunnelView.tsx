import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Contact } from '@/hooks/useContacts';
import { ArrowDown, TrendingDown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseISO, isAfter, subDays, startOfMonth } from 'date-fns';

const FUNNEL_STAGES = [
  { key: 'novo_lead', label: 'Novo Lead', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50 border-blue-200' },
  { key: 'orcamento_enviado', label: 'Orçamento Enviado', color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-50 border-amber-200' },
  { key: 'em_negociacao', label: 'Em Negociação', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50 border-orange-200' },
  { key: 'cliente', label: 'Cliente', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50 border-green-200' },
];

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface FunnelViewProps {
  contacts: Contact[];
}

export function FunnelView({ contacts }: FunnelViewProps) {
  const [period, setPeriod] = useState('all');

  const filteredContacts = useMemo(() => {
    if (period === 'all') return contacts.filter(c => c.is_active);
    const now = new Date();
    let cutoff: Date;
    if (period === '7d') cutoff = subDays(now, 7);
    else if (period === '30d') cutoff = subDays(now, 30);
    else cutoff = startOfMonth(now); // mes_atual

    return contacts.filter(c => {
      if (!c.is_active) return false;
      try {
        return isAfter(parseISO(c.created_at), cutoff);
      } catch {
        return true;
      }
    });
  }, [contacts, period]);

  const stageData = useMemo(() => {
    const data = FUNNEL_STAGES.map(stage => {
      const stageContacts = filteredContacts.filter(c => c.funnel_status === stage.key);
      const totalValue = stageContacts.reduce((sum, c) => sum + (c.valor_estimado || 0), 0);
      return { ...stage, count: stageContacts.length, totalValue };
    });

    // Calculate conversion rates between stages
    return data.map((stage, i) => {
      const prevCount = i > 0 ? data[i - 1].count : 0;
      const conversionRate = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : null;
      return { ...stage, conversionRate };
    });
  }, [filteredContacts]);

  const maxCount = Math.max(...stageData.map(s => s.count), 1);

  return (
    <div className="space-y-4">
      {/* Period filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Período:</span>
        <div className="flex gap-1">
          {[
            { value: 'all', label: 'Todos' },
            { value: '7d', label: '7 dias' },
            { value: '30d', label: '30 dias' },
            { value: 'mes_atual', label: 'Mês atual' },
          ].map(opt => (
            <Button
              key={opt.value}
              variant={period === opt.value ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs rounded-full"
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Funnel visualization */}
      <div className="flex flex-col items-center gap-0 max-w-2xl mx-auto">
        {stageData.map((stage, index) => {
          const widthPct = Math.max(30, (stage.count / maxCount) * 100);

          return (
            <div key={stage.key} className="w-full flex flex-col items-center">
              {/* Conversion rate arrow between stages */}
              {index > 0 && stage.conversionRate !== null && (
                <div className="flex items-center gap-2 py-1.5">
                  <ArrowDown className="h-4 w-4 text-muted-foreground" />
                  <span className={cn(
                    'text-xs font-bold rounded-full px-2 py-0.5',
                    stage.conversionRate >= 50 ? 'bg-green-100 text-green-700' :
                    stage.conversionRate >= 25 ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  )}>
                    {stage.conversionRate}% conversão
                  </span>
                  <ArrowDown className="h-4 w-4 text-muted-foreground" />
                </div>
              )}

              {/* Stage bar */}
              <div
                className="transition-all duration-300"
                style={{ width: `${widthPct}%` }}
              >
                <Card className={cn(
                  'p-4 border-2 transition-all hover:shadow-lg',
                  stage.bgLight
                )}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn('w-3 h-3 rounded-full shrink-0', stage.color)} />
                      <span className={cn('font-semibold text-sm', stage.textColor)}>
                        {stage.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-lg font-bold">{stage.count}</span>
                        </div>
                      </div>
                      {stage.totalValue > 0 && (
                        <Badge variant="secondary" className="text-xs font-bold">
                          {formatCurrency(stage.totalValue)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Progress bar inside */}
                  <div className="mt-2 h-2 rounded-full bg-background/50 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', stage.color)}
                      style={{ width: `${(stage.count / maxCount) * 100}%` }}
                    />
                  </div>
                </Card>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary card */}
      <Card className="p-4 max-w-2xl mx-auto">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{filteredContacts.filter(c => c.is_active).length}</p>
            <p className="text-xs text-muted-foreground">Total no funil</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-700">
              {formatCurrency(
                filteredContacts
                  .filter(c => ['novo_lead', 'orcamento_enviado', 'em_negociacao'].includes(c.funnel_status))
                  .reduce((s, c) => s + (c.valor_estimado || 0), 0)
              )}
            </p>
            <p className="text-xs text-muted-foreground">Valor em aberto</p>
          </div>
          <div>
            {(() => {
              const leads = filteredContacts.filter(c => c.funnel_status === 'novo_lead').length;
              const clients = filteredContacts.filter(c => c.funnel_status === 'cliente').length;
              const rate = leads > 0 ? Math.round((clients / leads) * 100) : 0;
              return (
                <>
                  <p className="text-2xl font-bold text-emerald-700">{rate}%</p>
                  <p className="text-xs text-muted-foreground">Lead → Cliente</p>
                </>
              );
            })()}
          </div>
        </div>
      </Card>
    </div>
  );
}
