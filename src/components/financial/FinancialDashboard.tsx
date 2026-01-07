import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, AlertTriangle, Clock, CheckCircle, Wallet } from 'lucide-react';
import { useFinancial, FinancialSummary } from '@/hooks/useFinancial';

interface SummaryCardProps {
  title: string;
  value: number;
  count?: number;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

function SummaryCard({ title, value, count, icon, variant = 'default' }: SummaryCardProps) {
  const variants = {
    default: 'bg-card',
    success: 'bg-emerald-500/10 border-emerald-500/20',
    warning: 'bg-amber-500/10 border-amber-500/20',
    danger: 'bg-red-500/10 border-red-500/20',
  };

  const iconVariants = {
    default: 'text-muted-foreground',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    danger: 'text-red-500',
  };

  return (
    <Card className={variants[variant]}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{formatCurrency(value)}</p>
            {count !== undefined && (
              <p className="text-xs text-muted-foreground">{count} lançamento(s)</p>
            )}
          </div>
          <div className={iconVariants[variant]}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TypeSummaryProps {
  title: string;
  summary: FinancialSummary;
  type: 'pagar' | 'receber';
}

function TypeSummary({ title, summary, type }: TypeSummaryProps) {
  const Icon = type === 'receber' ? TrendingUp : TrendingDown;
  const iconColor = type === 'receber' ? 'text-emerald-500' : 'text-red-500';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Em Aberto
            </div>
            <p className="text-lg font-semibold">{formatCurrency(summary.total_open)}</p>
            <p className="text-xs text-muted-foreground">{summary.count_open} lançamento(s)</p>
          </div>
          <div className="rounded-lg bg-red-500/10 p-3">
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertTriangle className="h-4 w-4" />
              Atrasadas
            </div>
            <p className="text-lg font-semibold text-red-500">{formatCurrency(summary.total_overdue)}</p>
            <p className="text-xs text-muted-foreground">{summary.count_overdue} lançamento(s)</p>
          </div>
        </div>
        <div className="rounded-lg bg-emerald-500/10 p-3">
          <div className="flex items-center gap-2 text-sm text-emerald-500">
            <CheckCircle className="h-4 w-4" />
            {type === 'receber' ? 'Recebido' : 'Pago'}
          </div>
          <p className="text-lg font-semibold text-emerald-500">{formatCurrency(summary.total_paid)}</p>
          <p className="text-xs text-muted-foreground">{summary.count_paid} lançamento(s)</p>
        </div>
        {summary.count_partial > 0 && (
          <p className="text-xs text-amber-500">
            {summary.count_partial} lançamento(s) com pagamento parcial
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function FinancialDashboard() {
  const { getDashboardSummary, accounts } = useFinancial();
  const summary = getDashboardSummary();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total Entradas (Período)"
          value={summary.totalEntradas}
          icon={<TrendingUp className="h-6 w-6" />}
          variant="success"
        />
        <SummaryCard
          title="Total Saídas (Período)"
          value={summary.totalSaidas}
          icon={<TrendingDown className="h-6 w-6" />}
          variant="danger"
        />
        <SummaryCard
          title="Saldo do Período"
          value={summary.saldo}
          icon={<Wallet className="h-6 w-6" />}
          variant={summary.saldo >= 0 ? 'success' : 'danger'}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TypeSummary title="Contas a Receber" summary={summary.receber} type="receber" />
        <TypeSummary title="Contas a Pagar" summary={summary.pagar} type="pagar" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-5 w-5" />
            Saldo por Conta
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{account.type}</p>
                  </div>
                  <p className={`font-semibold ${account.current_balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {formatCurrency(account.current_balance)}
                  </p>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-3">
                <p className="font-medium">Total</p>
                <p className={`text-lg font-bold ${summary.totalAccountsBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatCurrency(summary.totalAccountsBalance)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
