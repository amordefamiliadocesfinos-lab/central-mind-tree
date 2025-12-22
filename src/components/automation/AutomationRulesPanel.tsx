import { useState } from 'react';
import { Settings, Plus, Trash2, Power, PowerOff, Clock, Calendar, AlertTriangle, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAutomationRules, AutomationRule } from '@/hooks/useAutomationRules';
import { toast } from 'sonner';

const TRIGGER_TYPES = [
  { value: 'on_hold_days', label: 'Em Espera por X dias', icon: Pause, description: 'Dispara quando tarefa está em espera' },
  { value: 'due_date_approaching', label: 'Prazo se aproximando', icon: Calendar, description: 'Dispara X dias antes do prazo' },
  { value: 'stale_task', label: 'Tarefa sem atividade', icon: Clock, description: 'Dispara quando tarefa em andamento não tem atividade' },
];

const ACTION_TYPES = [
  { value: 'alert', label: 'Mostrar Alerta' },
  { value: 'notify', label: 'Enviar Notificação' },
];

export function AutomationRulesPanel() {
  const { rules, toggleRule, deleteRule, createRule, loading } = useAutomationRules();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    trigger_type: 'on_hold_days',
    days: 3,
    action_type: 'alert',
    message: '',
  });

  const handleCreate = async () => {
    if (!newRule.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    const triggerConfig: Record<string, number> = {};
    if (newRule.trigger_type === 'on_hold_days' || newRule.trigger_type === 'stale_task') {
      triggerConfig.days = newRule.days;
    } else if (newRule.trigger_type === 'due_date_approaching') {
      triggerConfig.days_before = newRule.days;
    }

    await createRule({
      name: newRule.name,
      description: newRule.description || null,
      trigger_type: newRule.trigger_type,
      trigger_config: triggerConfig,
      action_type: newRule.action_type,
      action_config: { message: newRule.message || `Regra "${newRule.name}" acionada` },
      is_active: true,
    });

    toast.success('Regra criada com sucesso');
    setShowNewDialog(false);
    setNewRule({
      name: '',
      description: '',
      trigger_type: 'on_hold_days',
      days: 3,
      action_type: 'alert',
      message: '',
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Excluir regra "${name}"?`)) {
      await deleteRule(id);
      toast.success('Regra excluída');
    }
  };

  const getTriggerIcon = (type: string) => {
    const trigger = TRIGGER_TYPES.find(t => t.value === type);
    return trigger?.icon || AlertTriangle;
  };

  const getTriggerLabel = (type: string) => {
    const trigger = TRIGGER_TYPES.find(t => t.value === type);
    return trigger?.label || type;
  };

  const formatTriggerConfig = (rule: AutomationRule) => {
    const config = rule.trigger_config;
    switch (rule.trigger_type) {
      case 'on_hold_days':
        return `${config.days || 3} dias em espera`;
      case 'due_date_approaching':
        return `${config.days_before || 1} dia(s) antes`;
      case 'stale_task':
        return `${config.days || 2} dias sem atividade`;
      default:
        return JSON.stringify(config);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Regras de Automação
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure alertas automáticos baseados em condições
          </p>
        </div>
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Regra
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Regra de Automação</DialogTitle>
              <DialogDescription>
                Crie uma regra para receber alertas automáticos
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Regra *</Label>
                <Input
                  id="name"
                  value={newRule.name}
                  onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Alerta de follow-up"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={newRule.description}
                  onChange={(e) => setNewRule(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva quando essa regra deve disparar"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Condição (Quando)</Label>
                <Select
                  value={newRule.trigger_type}
                  onValueChange={(v) => setNewRule(prev => ({ ...prev, trigger_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <t.icon className="h-4 w-4" />
                          {t.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="days">
                  {newRule.trigger_type === 'due_date_approaching' ? 'Dias antes' : 'Quantidade de dias'}
                </Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  value={newRule.days}
                  onChange={(e) => setNewRule(prev => ({ ...prev, days: parseInt(e.target.value) || 1 }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Ação (Então)</Label>
                <Select
                  value={newRule.action_type}
                  onValueChange={(v) => setNewRule(prev => ({ ...prev, action_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Mensagem do Alerta</Label>
                <Textarea
                  id="message"
                  value={newRule.message}
                  onChange={(e) => setNewRule(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Mensagem exibida quando a regra disparar"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate}>
                Criar Regra
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma regra configurada</p>
            <p className="text-sm text-muted-foreground">
              Crie regras para receber alertas automáticos
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const TriggerIcon = getTriggerIcon(rule.trigger_type);
            
            return (
              <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <TriggerIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium">{rule.name}</h3>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                          {rule.is_active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                      {rule.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {rule.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTriggerConfig(rule)}
                        </span>
                        <span>→</span>
                        <span>{ACTION_TYPES.find(a => a.value === rule.action_type)?.label || rule.action_type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => toggleRule(rule.id)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(rule.id, rule.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
