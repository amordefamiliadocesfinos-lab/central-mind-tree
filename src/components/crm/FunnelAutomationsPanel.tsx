import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAutomationRules, AutomationRule } from '@/hooks/useAutomationRules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Zap, ArrowRight, CheckSquare, Bell, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STAGES = [
  { key: 'novo_lead', label: 'Nova Consulta', color: 'bg-sky-500' },
  { key: 'contato_realizado', label: 'Contato Realizado', color: 'bg-cyan-500' },
  { key: 'proposta_enviada', label: 'Orçamento Enviado', color: 'bg-amber-500' },
  { key: 'negociacao', label: 'Negociação', color: 'bg-orange-500' },
  { key: 'fechado', label: 'Pedido Realizado', color: 'bg-yellow-500' },
  { key: 'pos_venda', label: 'Pós-Venda', color: 'bg-emerald-500' },
  { key: 'perdido', label: 'Perdido', color: 'bg-rose-500' },
];

const ACTIONS = [
  { value: 'create_task', label: 'Criar tarefa', icon: CheckSquare },
  { value: 'change_funnel_stage', label: 'Mover para outra etapa', icon: ArrowRight },
  { value: 'alert', label: 'Registrar alerta no histórico', icon: Bell },
];

type Draft = {
  name: string;
  stage: string;
  action: string;
  taskTitle: string;
  daysOffset: number;
  time: string;
  assignedTo: string;
  targetStage: string;
  message: string;
};

const blankDraft = (): Draft => ({
  name: '',
  stage: 'novo_lead',
  action: 'create_task',
  taskTitle: 'Ligar para o novo lead',
  daysOffset: 1,
  time: '10:00',
  assignedTo: '',
  targetStage: 'pos_venda',
  message: '',
});

const PRESETS: Array<{ label: string; preset: Partial<Draft> & { name: string } }> = [
  {
    label: 'Nova Consulta → criar tarefa "Ligar amanhã"',
    preset: { name: 'Nova Consulta: Ligar amanhã', stage: 'novo_lead', action: 'create_task', taskTitle: 'Ligar para o lead', daysOffset: 1, time: '10:00' },
  },
  {
    label: 'Orçamento Enviado → retorno em 3 dias',
    preset: { name: 'Orçamento Enviado: Retornar em 3 dias', stage: 'proposta_enviada', action: 'create_task', taskTitle: 'Cobrar retorno do orçamento', daysOffset: 3, time: '14:00' },
  },
  {
    label: 'Pedido Realizado → mover para Pós-venda',
    preset: { name: 'Pedido Realizado: Mover para Pós-venda', stage: 'fechado', action: 'change_funnel_stage', targetStage: 'pos_venda' },
  },
];

export function FunnelAutomationsPanel({ onClose }: { onClose?: () => void }) {
  const { rules, fetchRules, createRule, deleteRule, toggleRule } = useAutomationRules();
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft());

  useEffect(() => {
    fetchRules();
    supabase.from('app_users').select('id, name').eq('is_active', true).order('name').then(({ data }) => {
      setUsers((data || []) as any);
    });
  }, [fetchRules]);

  const funnelRules = rules.filter(r => r.trigger_type === 'funnel_stage_changed');

  const applyPreset = (p: Partial<Draft> & { name: string }) => {
    setDraft({ ...blankDraft(), ...p });
    setShowForm(true);
  };

  const handleCreate = async () => {
    if (!draft.name.trim()) { toast.error('Dê um nome para a automação'); return; }
    const action_config: Record<string, unknown> = {};
    if (draft.action === 'create_task') {
      action_config.title = draft.taskTitle.trim() || 'Ação automática';
      action_config.days_offset = draft.daysOffset;
      action_config.time = draft.time || null;
      if (draft.assignedTo) action_config.assigned_to = draft.assignedTo;
    } else if (draft.action === 'change_funnel_stage') {
      action_config.target_stage = draft.targetStage;
    } else {
      action_config.message = draft.message || draft.name;
    }
    await createRule({
      name: draft.name,
      description: null,
      trigger_type: 'funnel_stage_changed',
      trigger_config: { stage: draft.stage },
      action_type: draft.action,
      action_config,
      is_active: true,
    });
    toast.success('Automação criada');
    setDraft(blankDraft());
    setShowForm(false);
  };

  const stageLabel = (key?: string) => STAGES.find(s => s.key === key)?.label || key || '—';
  const stageColor = (key?: string) => STAGES.find(s => s.key === key)?.color || 'bg-muted';

  const describeAction = (r: AutomationRule) => {
    const c: any = r.action_config || {};
    if (r.action_type === 'create_task') {
      return `Criar tarefa "${c.title || 'Ação'}" em ${c.days_offset ?? 0}d${c.time ? ` às ${c.time}` : ''}`;
    }
    if (r.action_type === 'change_funnel_stage') {
      return `Mover para "${stageLabel(c.target_stage)}"`;
    }
    return `Alerta: ${c.message || r.name}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Automações do Funil</h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Configure ações que disparam automaticamente quando um lead muda de etapa do funil. Sem programação.
      </p>

      {!showForm && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Modelos rápidos</Label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <Badge
                key={p.label}
                variant="outline"
                className="cursor-pointer text-[10px] hover:bg-accent"
                onClick={() => applyPreset(p.preset)}
              >
                + {p.label}
              </Badge>
            ))}
            <Badge
              variant="default"
              className="cursor-pointer text-[10px] gap-1"
              onClick={() => { setDraft(blankDraft()); setShowForm(true); }}
            >
              <Plus className="h-2.5 w-2.5" /> Criar do zero
            </Badge>
          </div>
        </div>
      )}

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs">Nome da automação</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-9 text-sm mt-1" placeholder="Ex.: Nova Consulta → Ligar amanhã" />
            </div>

            <div>
              <Label className="text-xs">Quando o lead entrar na etapa</Label>
              <Select value={draft.stage} onValueChange={(v) => setDraft({ ...draft, stage: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => (
                    <SelectItem key={s.key} value={s.key} className="text-sm">
                      <span className={cn("inline-block h-2 w-2 rounded-full mr-2", s.color)} />{s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Então executar</Label>
              <Select value={draft.action} onValueChange={(v) => setDraft({ ...draft, action: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIONS.map(a => (
                    <SelectItem key={a.value} value={a.value} className="text-sm">{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {draft.action === 'create_task' && (
              <div className="space-y-2 rounded-md bg-muted/40 p-3">
                <div>
                  <Label className="text-xs">Título da tarefa</Label>
                  <Input value={draft.taskTitle} onChange={(e) => setDraft({ ...draft, taskTitle: e.target.value })} className="h-8 text-xs mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Vencer em (dias)</Label>
                    <Input type="number" min={0} value={draft.daysOffset} onChange={(e) => setDraft({ ...draft, daysOffset: parseInt(e.target.value) || 0 })} className="h-8 text-xs mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Horário</Label>
                    <Input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} className="h-8 text-xs mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Responsável (opcional)</Label>
                  <Select value={draft.assignedTo} onValueChange={(v) => setDraft({ ...draft, assignedTo: v })}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {users.map(u => <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {draft.action === 'change_funnel_stage' && (
              <div className="rounded-md bg-muted/40 p-3">
                <Label className="text-xs">Mover para a etapa</Label>
                <Select value={draft.targetStage} onValueChange={(v) => setDraft({ ...draft, targetStage: v })}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map(s => (
                      <SelectItem key={s.key} value={s.key} className="text-sm">
                        <span className={cn("inline-block h-2 w-2 rounded-full mr-2", s.color)} />{s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {draft.action === 'alert' && (
              <div className="rounded-md bg-muted/40 p-3">
                <Label className="text-xs">Mensagem do alerta</Label>
                <Input value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} className="h-8 text-xs mt-1" placeholder="Ex.: Atenção, lead avançou no funil" />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setDraft(blankDraft()); }}>Cancelar</Button>
              <Button size="sm" onClick={handleCreate}>Salvar automação</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Automações ativas ({funnelRules.length})</Label>
        {funnelRules.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-md">
            Nenhuma automação configurada ainda. Use um modelo acima para começar.
          </p>
        ) : (
          funnelRules.map(r => {
            const stage = (r.trigger_config as any)?.stage as string;
            return (
              <Card key={r.id} className={cn(!r.is_active && "opacity-60")}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                        <Badge variant="secondary" className="gap-1">
                          <span className={cn("h-1.5 w-1.5 rounded-full", stageColor(stage))} />
                          {stageLabel(stage)}
                        </Badge>
                        <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-muted-foreground">{describeAction(r)}</span>
                      </div>
                    </div>
                    <Switch checked={r.is_active} onCheckedChange={() => toggleRule(r.id)} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => deleteRule(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
