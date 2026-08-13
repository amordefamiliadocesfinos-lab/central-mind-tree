import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CircleAlert, Flag, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getLastOperationalContext, getNextOperationalStep, OPERATIONAL_MODULES, OperationalContext, saveNextOperationalStep } from '@/lib/operationalContext';

interface Props {
  crmAttentionCount: number;
  financialOverdueCount: number;
  overdueOrders: number;
}

export function OperationalStart(props: Props) {
  const [nextStep, setNextStep] = useState<OperationalContext | null>(() => getNextOperationalStep());
  const [open, setOpen] = useState(false);
  const [modulePath, setModulePath] = useState('/foco');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<OperationalContext['status']>('Hoje');
  const lastContext = getLastOperationalContext();

  useEffect(() => {
    const refresh = () => setNextStep(getNextOperationalStep());
    window.addEventListener('operational-context-changed', refresh);
    return () => window.removeEventListener('operational-context-changed', refresh);
  }, []);

  const resume = nextStep ?? lastContext ?? {
    module: 'Foco',
    path: '/foco',
    title: 'Escolher a prioridade de agora',
    status: 'Agora' as const,
    updatedAt: new Date().toISOString(),
  };

  // This is presentation order only. Each module remains responsible for its own rule.
  const alerts = useMemo(() => [
    props.crmAttentionCount > 0
      ? { label: `${props.crmAttentionCount} atendimento(s) precisam de atenção`, module: 'CRM', path: '/contatos/inbox', status: 'Agora' }
      : null,
    props.financialOverdueCount > 0
      ? { label: `${props.financialOverdueCount} vencimento(s) financeiro(s)`, module: 'Financeiro', path: '/financeiro', status: 'Atrasado' }
      : null,
    props.overdueOrders > 0
      ? { label: `${props.overdueOrders} pedido(s) com prazo vencido`, module: 'Operações', path: '/operacoes', status: 'Atrasado' }
      : null,
  ].filter(Boolean).slice(0, 3) as Array<{ label: string; module: string; path: string; status: string }>, [
    props.crmAttentionCount,
    props.financialOverdueCount,
    props.overdueOrders,
  ]);

  const save = () => {
    const selected = OPERATIONAL_MODULES.find(item => item.path === modulePath)!;
    saveNextOperationalStep({
      module: selected.module,
      path: selected.path,
      title: title.trim() || `Retomar ${selected.module}`,
      status,
      updatedAt: new Date().toISOString(),
    });
    setNextStep(getNextOperationalStep());
    setTitle('');
    setOpen(false);
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2"><RotateCcw className="h-4 w-4 text-primary" />Retomar agora</span>
            <Badge>{resume.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="font-semibold">{resume.title}</p>
            <p className="text-sm text-muted-foreground">{resume.module} · continue de onde parou</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm"><Link to={resume.path}>Continuar <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
            {nextStep && <Button variant="ghost" size="sm" onClick={() => { saveNextOperationalStep(null); setNextStep(null); }}><Check className="mr-1 h-4 w-4" />Concluir passo</Button>}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Flag className="mr-1 h-4 w-4" />Deixar próximo passo</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Deixar próximo passo</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Módulo</Label>
                    <Select value={modulePath} onValueChange={setModulePath}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{OPERATIONAL_MODULES.map(item => <SelectItem key={item.path} value={item.path}>{item.module}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Próxima ação concreta</Label><Input value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: responder os três leads pendentes" /></div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={status} onValueChange={value => setStatus(value as OperationalContext['status'])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Agora">Agora</SelectItem><SelectItem value="Hoje">Hoje</SelectItem><SelectItem value="Aguardando">Aguardando</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={save}>Guardar próximo passo</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><CircleAlert className="h-4 w-4 text-amber-500" />Atenção <Badge variant="outline">máx. 3</Badge></CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {alerts.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma pendência crítica agora.</p> : alerts.map(alert => (
            <Link key={`${alert.path}-${alert.label}`} to={alert.path} className="flex items-center justify-between gap-2 rounded-md p-2 text-sm hover:bg-muted">
              <span><strong>{alert.module}</strong> · {alert.label}</span>
              <Badge variant="outline">{alert.status}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
