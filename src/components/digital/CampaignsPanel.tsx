import { useMemo, useState } from 'react';
import { useCampaigns, CampaignApplication } from '@/hooks/useCampaigns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, CheckCircle2, AlertTriangle, Target, Flag, Paperclip, Ruler, Lightbulb } from 'lucide-react';
import { formatDisplayDate } from '@/lib/dateUtils';

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  aprovada: 'Aprovada',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

interface Props {
  ideas: { id: string; title: string }[];
}

export function CampaignsPanel({ ideas }: Props) {
  const {
    campaigns, executions, evidence, metrics, learnings, loading, isLinked,
    createCampaign, approveCampaign, addEvidence, confirmExecution,
    addMetric, addLearning, completeCampaign,
  } = useCampaigns();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    idea_id: '', title: '', objective: '', success_definition: '',
    metric_name: '', metric_unit: '', execution_title: '', execution_planned_at: '',
  });
  const [evidenceForm, setEvidenceForm] = useState({ execution_id: '', description: '', url: '' });
  const [metricValue, setMetricValue] = useState('');
  const [learningText, setLearningText] = useState('');

  const selected = useMemo(
    () => campaigns.find((c) => c.id === selectedId) ?? null,
    [campaigns, selectedId],
  );
  const selExecutions = useMemo(
    () => executions.filter((e) => e.campaign_id === selectedId),
    [executions, selectedId],
  );

  const canSubmit =
    form.idea_id && form.title.trim() && form.objective.trim() && form.success_definition.trim() &&
    form.metric_name.trim() && form.metric_unit.trim() && form.execution_title.trim();

  const handleCreate = async () => {
    const created = await createCampaign({
      idea_id: form.idea_id,
      title: form.title.trim(),
      objective: form.objective.trim(),
      success_definition: form.success_definition.trim(),
      metric_name: form.metric_name.trim(),
      metric_unit: form.metric_unit.trim(),
      execution_title: form.execution_title.trim(),
      execution_planned_at: form.execution_planned_at || null,
    });
    if (created) {
      setShowCreate(false);
      setSelectedId(created.id);
      setForm({ idea_id: '', title: '', objective: '', success_definition: '', metric_name: '', metric_unit: '', execution_title: '', execution_planned_at: '' });
    }
  };

  if (!isLinked && !loading) {
    return (
      <Card className="p-6 flex gap-3 items-start">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Sem vínculo operacional ativo</p>
          <p className="text-muted-foreground">
            Sua conta autenticada não está vinculada a um colaborador ativo. As ações de Campanhas estão bloqueadas.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Campanhas</h2>
          <p className="text-xs text-muted-foreground">
            Aplicação de Campanha: objetivo → aprovação → execução com evidência → métrica → aprendizado.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} disabled={ideas.length === 0}>
          <Plus className="h-4 w-4 mr-1.5" /> Nova Campanha
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
      ) : campaigns.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma campanha ainda. Crie a primeira a partir de uma ideia existente.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Card
              key={c.id}
              className="p-4 space-y-2 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedId(c.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-sm leading-tight">{c.title}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{STATUS_LABEL[c.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{c.objective}</p>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Ruler className="h-3 w-3" /> {c.metric_name} ({c.metric_unit})
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Criação */}
      <ResponsiveDialog open={showCreate} onOpenChange={setShowCreate} title="Nova Campanha Essencial">
        <div className="space-y-3 p-1">
          <div className="space-y-1.5">
            <Label>Ideia vinculada</Label>
            <Select value={form.idea_id} onValueChange={(v) => setForm({ ...form, idea_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione uma ideia" /></SelectTrigger>
              <SelectContent className="pointer-events-auto">
                {ideas.map((i) => <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Objetivo</Label>
            <Textarea rows={2} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Definição de sucesso</Label>
            <Textarea rows={2} value={form.success_definition} onChange={(e) => setForm({ ...form, success_definition: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Métrica principal</Label>
              <Input value={form.metric_name} onChange={(e) => setForm({ ...form, metric_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Input value={form.metric_unit} onChange={(e) => setForm({ ...form, metric_unit: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Execução inicial</Label>
              <Input value={form.execution_title} onChange={(e) => setForm({ ...form, execution_title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data planejada</Label>
              <Input type="date" value={form.execution_planned_at} onChange={(e) => setForm({ ...form, execution_planned_at: e.target.value })} />
            </div>
          </div>
          <Button className="w-full" disabled={!canSubmit} onClick={handleCreate}>Criar campanha</Button>
        </div>
      </ResponsiveDialog>

      {/* Detalhe / fluxo */}
      <ResponsiveDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelectedId(null)}
        title={selected?.title ?? ''}
      >
        {selected && (
          <div className="space-y-4 p-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{STATUS_LABEL[selected.status]}</Badge>
              {selected.approved_at && (
                <span className="text-[11px] text-muted-foreground">
                  Aprovada em {formatDisplayDate(selected.approved_at)}
                </span>
              )}
            </div>

            <section className="space-y-1 text-sm">
              <p className="flex gap-2"><Target className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>{selected.objective}</span></p>
              <p className="flex gap-2"><Flag className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>{selected.success_definition}</span></p>
            </section>

            {/* 1. Aprovar */}
            {selected.status === 'rascunho' && (
              <Button className="w-full" onClick={() => approveCampaign(selected.id)}>
                Aprovar campanha
              </Button>
            )}

            {/* 2. Execuções */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Execuções</h3>
              {selExecutions.map((ex) => {
                const exEvidence = evidence.filter((e) => e.execution_id === ex.id);
                return (
                  <Card key={ex.id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{ex.title}</span>
                      <Badge variant={ex.status === 'confirmada' ? 'default' : 'outline'} className="text-[10px]">
                        {ex.status === 'confirmada' ? 'Confirmada' : 'Planejada'}
                      </Badge>
                    </div>
                    {ex.planned_at && (
                      <p className="text-[11px] text-muted-foreground">Planejada para {formatDisplayDate(ex.planned_at)}</p>
                    )}
                    <ul className="space-y-1">
                      {exEvidence.map((e) => (
                        <li key={e.id} className="text-[11px] text-muted-foreground flex gap-1.5 items-start">
                          <Paperclip className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="break-all">{e.description || e.url}</span>
                        </li>
                      ))}
                    </ul>

                    {ex.status !== 'confirmada' && selected.status !== 'rascunho' && (
                      <div className="space-y-2 pt-1">
                        <Input
                          placeholder="Descrição da evidência"
                          value={evidenceForm.execution_id === ex.id ? evidenceForm.description : ''}
                          onChange={(e) => setEvidenceForm({ execution_id: ex.id, description: e.target.value, url: evidenceForm.execution_id === ex.id ? evidenceForm.url : '' })}
                        />
                        <Input
                          placeholder="Link (opcional)"
                          value={evidenceForm.execution_id === ex.id ? evidenceForm.url : ''}
                          onChange={(e) => setEvidenceForm({ execution_id: ex.id, description: evidenceForm.execution_id === ex.id ? evidenceForm.description : '', url: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm" variant="secondary" className="flex-1"
                            disabled={evidenceForm.execution_id !== ex.id || (!evidenceForm.description.trim() && !evidenceForm.url.trim())}
                            onClick={async () => {
                              const ok = await addEvidence(selected.id, ex.id, {
                                kind: evidenceForm.url ? 'link' : 'observacao',
                                description: evidenceForm.description,
                                url: evidenceForm.url,
                              });
                              if (ok) setEvidenceForm({ execution_id: '', description: '', url: '' });
                            }}
                          >
                            Registrar evidência
                          </Button>
                          <Button
                            size="sm" className="flex-1"
                            disabled={exEvidence.length === 0}
                            onClick={() => confirmExecution(ex.id)}
                          >
                            Confirmar execução
                          </Button>
                        </div>
                        {exEvidence.length === 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            Registre ao menos uma evidência para poder confirmar.
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </section>

            {/* 3. Métrica */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Métrica — {selected.metric_name} ({selected.metric_unit})
              </h3>
              {metrics.filter((m) => m.campaign_id === selected.id).map((m) => (
                <p key={m.id} className="text-sm">{m.metric_value} {m.metric_unit}</p>
              ))}
              {selected.status !== 'concluida' && (
                <div className="flex gap-2">
                  <Input
                    type="number" step="any" placeholder="Valor"
                    value={metricValue} onChange={(e) => setMetricValue(e.target.value)}
                  />
                  <Button
                    size="sm" variant="secondary"
                    disabled={!metricValue}
                    onClick={async () => {
                      const ok = await addMetric(selected, Number(metricValue));
                      if (ok) setMetricValue('');
                    }}
                  >
                    Registrar
                  </Button>
                </div>
              )}
            </section>

            {/* 4. Aprendizado */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Aprendizados</h3>
              {learnings.filter((l) => l.campaign_id === selected.id).map((l) => (
                <p key={l.id} className="text-sm flex gap-2">
                  <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />{l.content}
                </p>
              ))}
              {selected.status !== 'concluida' && (
                <div className="space-y-2">
                  <Textarea rows={2} placeholder="O que aprendemos?" value={learningText} onChange={(e) => setLearningText(e.target.value)} />
                  <Button
                    size="sm" variant="secondary" disabled={!learningText.trim()}
                    onClick={async () => {
                      const ok = await addLearning(selected.id, learningText.trim());
                      if (ok) setLearningText('');
                    }}
                  >
                    Registrar aprendizado
                  </Button>
                </div>
              )}
            </section>

            {/* 5. Concluir */}
            {selected.status !== 'concluida' && (
              <Button className="w-full" onClick={() => completeCampaign(selected.id)}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Concluir campanha
              </Button>
            )}
          </div>
        )}
      </ResponsiveDialog>
    </div>
  );
}
