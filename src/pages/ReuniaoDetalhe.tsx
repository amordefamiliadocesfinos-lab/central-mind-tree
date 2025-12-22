import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Plus, Trash2, Clock, User, Check, FileText, ChevronRight, Save, MoreVertical, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMeetings, Meeting, MeetingItem } from '@/hooks/useMeetings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  agendada: { label: 'Agendada', color: 'bg-blue-500' },
  em_andamento: { label: 'Em Andamento', color: 'bg-amber-500' },
  concluida: { label: 'Concluída', color: 'bg-green-500' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-500' },
};

const ITEM_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  estrutura: { label: 'Estrutura', color: 'bg-purple-500' },
  pauta: { label: 'Pauta', color: 'bg-blue-500' },
  decisao: { label: 'Decisão', color: 'bg-green-500' },
  acao: { label: 'Ação', color: 'bg-amber-500' },
};

export default function ReuniaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getMeeting, updateMeeting, updateMeetingItem, addMeetingItem, deleteMeetingItem, createActionFromItem, users } = useMeetings();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('estrutura');
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [itemTimer, setItemTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showNewItemDialog, setShowNewItemDialog] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', description: '', owner_id: '', duration_minutes: 5, item_type: 'pauta' });
  const [nodes, setNodes] = useState<{ id: string; title: string }[]>([]);

  const loadMeeting = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const data = await getMeeting(id);
    setMeeting(data);
    setLoading(false);
  }, [id, getMeeting]);

  useEffect(() => {
    loadMeeting();
    // Load nodes for action creation
    supabase.from('nodes').select('id, title').then(({ data }) => {
      if (data) setNodes(data);
    });
  }, [loadMeeting]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerRunning) {
      interval = setInterval(() => {
        setItemTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStatusChange = async (status: string) => {
    if (!meeting) return;
    await updateMeeting(meeting.id, { status });
    setMeeting(prev => prev ? { ...prev, status } : null);
    toast.success(`Status alterado para ${STATUS_LABELS[status]?.label || status}`);
  };

  const handleStartItem = (item: MeetingItem) => {
    // Stop current if any
    if (activeItemId && activeItemId !== item.id) {
      handleStopItem();
    }
    setActiveItemId(item.id);
    setItemTimer(0);
    setTimerRunning(true);
    updateMeetingItem(item.id, { status: 'em_andamento' });
    
    // Update meeting status if needed
    if (meeting?.status === 'agendada') {
      handleStatusChange('em_andamento');
    }
  };

  const handleStopItem = async () => {
    if (!activeItemId) return;
    setTimerRunning(false);
    await updateMeetingItem(activeItemId, { status: 'concluido' });
    setActiveItemId(null);
    setItemTimer(0);
    loadMeeting();
  };

  const handleAddItem = async () => {
    if (!meeting || !newItem.title.trim()) {
      toast.error('Título é obrigatório');
      return;
    }
    await addMeetingItem({
      meeting_id: meeting.id,
      title: newItem.title,
      description: newItem.description,
      owner_id: newItem.owner_id || undefined,
      duration_minutes: newItem.duration_minutes,
      item_type: newItem.item_type,
    });
    setShowNewItemDialog(false);
    setNewItem({ title: '', description: '', owner_id: '', duration_minutes: 5, item_type: 'pauta' });
    toast.success('Item adicionado');
    loadMeeting();
  };

  const handleDeleteItem = async (itemId: string) => {
    if (confirm('Excluir este item?')) {
      await deleteMeetingItem(itemId);
      loadMeeting();
      toast.success('Item excluído');
    }
  };

  const handleCreateAction = async (item: MeetingItem) => {
    if (nodes.length === 0) {
      toast.error('Crie um projeto primeiro');
      return;
    }
    const task = await createActionFromItem(item, nodes[0].id);
    if (task) {
      toast.success('Ação criada como tarefa');
      loadMeeting();
    }
  };

  const handleSaveNotes = async () => {
    if (!meeting) return;
    await updateMeeting(meeting.id, { 
      notes: meeting.notes, 
      decisions: meeting.decisions 
    });
    toast.success('Notas salvas');
  };

  const exportAta = () => {
    if (!meeting) return;
    
    let content = `# Ata da Reunião: ${meeting.title}\n\n`;
    content += `**Data:** ${format(new Date(meeting.meeting_date + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}\n`;
    content += `**Horário:** ${meeting.start_time.substring(0, 5)}\n`;
    content += `**Duração:** ${meeting.duration_minutes} minutos\n`;
    if (meeting.location) content += `**Local:** ${meeting.location}\n`;
    if (meeting.objective) content += `\n**Objetivo:** ${meeting.objective}\n`;
    
    content += `\n## Pauta\n\n`;
    meeting.items?.filter(i => i.item_type === 'pauta').forEach((item, idx) => {
      content += `${idx + 1}. ${item.title}`;
      if (item.owner) content += ` _(${item.owner.name})_`;
      content += `\n`;
      if (item.notes) content += `   - ${item.notes}\n`;
    });
    
    if (meeting.decisions) {
      content += `\n## Decisões\n\n${meeting.decisions}\n`;
    }
    
    content += `\n## Ações\n\n`;
    meeting.items?.filter(i => i.item_type === 'acao').forEach((item, idx) => {
      content += `${idx + 1}. ${item.title}`;
      if (item.owner) content += ` → ${item.owner.name}`;
      content += `\n`;
    });
    
    if (meeting.notes) {
      content += `\n## Observações\n\n${meeting.notes}\n`;
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ata-${meeting.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Ata exportada');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Reunião não encontrada</p>
      </div>
    );
  }

  const status = STATUS_LABELS[meeting.status] || STATUS_LABELS.agendada;
  const estruturaItems = meeting.items?.filter(i => i.item_type === 'estrutura') || [];
  const pautaItems = meeting.items?.filter(i => i.item_type === 'pauta') || [];
  const acaoItems = meeting.items?.filter(i => i.item_type === 'acao' || i.item_type === 'decisao') || [];

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/reunioes')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{meeting.title}</h1>
              <p className="text-sm text-muted-foreground">
                {format(new Date(meeting.meeting_date + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })} às {meeting.start_time.substring(0, 5)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={meeting.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px]">
                <Badge className={`${status.color} text-white`}>{status.label}</Badge>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportAta}>
              <FileText className="h-4 w-4 mr-1" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Active Timer */}
        {activeItemId && (
          <Card className="mb-4 border-primary bg-primary/5">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-mono font-bold text-primary">
                    {formatTimer(itemTimer)}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {meeting.items?.find(i => i.id === activeItemId)?.title}
                  </span>
                </div>
                <Button size="sm" variant="destructive" onClick={handleStopItem}>
                  <Check className="h-4 w-4 mr-1" />
                  Concluir
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="estrutura">Estrutura</TabsTrigger>
            <TabsTrigger value="execucao">Execução</TabsTrigger>
            <TabsTrigger value="acoes">Ações</TabsTrigger>
          </TabsList>

          {/* Estrutura Tab */}
          <TabsContent value="estrutura" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Pauta da Reunião</h2>
              <Button size="sm" onClick={() => { setNewItem(prev => ({ ...prev, item_type: 'pauta' })); setShowNewItemDialog(true); }}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            {/* Estrutura items */}
            <div className="space-y-2">
              {estruturaItems.map((item) => (
                <Card key={item.id} className="border-l-4 border-l-purple-500">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">Estrutura</Badge>
                        <span className="font-medium">{item.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {item.duration_minutes}min
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pauta items */}
            <div className="space-y-2">
              {pautaItems.map((item) => (
                <Card key={item.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.title}</span>
                          {item.status === 'concluido' && (
                            <Check className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        {item.owner && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <User className="h-3 w-3" />
                            {item.owner.name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{item.duration_minutes}min</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleCreateAction(item)}>
                              <ListChecks className="h-4 w-4 mr-2" />
                              Gerar Ação
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteItem(item.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Objective & Notes */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-sm">Objetivo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{meeting.objective || 'Não definido'}</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Execução Tab */}
          <TabsContent value="execucao" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Clique em "Iniciar" para começar o timer de cada item.
            </p>

            {[...estruturaItems, ...pautaItems].sort((a, b) => a.order_index - b.order_index).map((item) => {
              const typeLabel = ITEM_TYPE_LABELS[item.item_type] || ITEM_TYPE_LABELS.pauta;
              const isActive = activeItemId === item.id;
              const isComplete = item.status === 'concluido';

              return (
                <Card 
                  key={item.id} 
                  className={`transition-all ${isActive ? 'ring-2 ring-primary' : ''} ${isComplete ? 'opacity-60' : ''}`}
                >
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isComplete ? (
                          <Check className="h-5 w-5 text-green-500" />
                        ) : isActive ? (
                          <div className="animate-pulse h-3 w-3 bg-primary rounded-full" />
                        ) : (
                          <div className="h-3 w-3 border-2 border-muted-foreground rounded-full" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className={`${typeLabel.color} text-white text-xs`}>{typeLabel.label}</Badge>
                            <span className={`font-medium ${isComplete ? 'line-through' : ''}`}>{item.title}</span>
                          </div>
                          {item.owner && (
                            <p className="text-xs text-muted-foreground mt-1">{item.owner.name}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{item.duration_minutes}min</span>
                        {!isComplete && !isActive && (
                          <Button size="sm" variant="outline" onClick={() => handleStartItem(item)}>
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Ações Tab */}
          <TabsContent value="acoes" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label>Decisões</Label>
                <Textarea
                  className="mt-2"
                  rows={4}
                  placeholder="Registre as decisões tomadas..."
                  value={meeting.decisions || ''}
                  onChange={(e) => setMeeting(prev => prev ? { ...prev, decisions: e.target.value } : null)}
                />
              </div>

              <div>
                <Label>Observações Gerais</Label>
                <Textarea
                  className="mt-2"
                  rows={4}
                  placeholder="Anotações e observações..."
                  value={meeting.notes || ''}
                  onChange={(e) => setMeeting(prev => prev ? { ...prev, notes: e.target.value } : null)}
                />
              </div>

              <Button onClick={handleSaveNotes}>
                <Save className="h-4 w-4 mr-2" />
                Salvar Notas
              </Button>
            </div>

            {/* Ações geradas */}
            {acaoItems.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Ações Geradas</h3>
                <div className="space-y-2">
                  {acaoItems.map((item) => (
                    <Card key={item.id} className="border-l-4 border-l-amber-500">
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{item.title}</span>
                            {item.owner && (
                              <p className="text-sm text-muted-foreground">→ {item.owner.name}</p>
                            )}
                          </div>
                          {item.task_id && (
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/task/${item.task_id}`)}>
                              Ver Tarefa
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* New Item Dialog */}
      <Dialog open={showNewItemDialog} onOpenChange={setShowNewItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Item de Pauta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={newItem.title}
                onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Assunto a ser discutido"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={newItem.description}
                onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={newItem.owner_id} onValueChange={(v) => setNewItem(prev => ({ ...prev, owner_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duração (min)</Label>
                <Input
                  type="number"
                  min={1}
                  value={newItem.duration_minutes}
                  onChange={(e) => setNewItem(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 5 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewItemDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddItem}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
