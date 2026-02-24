import { useState } from 'react';
import { 
  useDigitalInteractions, 
  DigitalInteraction,
  FUNNEL_STAGES,
  INTERACTION_TYPES,
} from '@/hooks/useDigitalInteractions';
import { usePlatforms } from '@/hooks/usePlatforms';
import { PlatformIcon } from './PlatformsManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  MessageCircle, 
  Mail, 
  Bell,
  Loader2,
  Sparkles,
  Check,
  X,
  Copy,
  Trash2,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export function InteractionsPanel() {
  const { 
    interactions, 
    loading, 
    suggestingFor,
    createInteraction,
    updateInteraction,
    deleteInteraction,
    markAsResponded,
    suggestResponse,
    getStats,
  } = useDigitalInteractions();
  
  const { activePlatforms } = usePlatforms();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterFunnel, setFilterFunnel] = useState<string>('all');
  
  const [newInteraction, setNewInteraction] = useState<{
    platform_id: string;
    contact_name: string;
    contact_handle: string;
    interaction_type: 'dm' | 'comment' | 'mention';
    funnel_stage: 'lead' | 'interested' | 'engaged' | 'customer';
    content: string;
  }>({
    platform_id: '',
    contact_name: '',
    contact_handle: '',
    interaction_type: 'dm',
    funnel_stage: 'lead',
    content: '',
  });

  const stats = getStats();

  const handleCreate = async () => {
    if (!newInteraction.content.trim()) {
      toast.error('Digite o conteúdo da mensagem');
      return;
    }

    await createInteraction({
      ...newInteraction,
      platform_id: newInteraction.platform_id || null,
    });

    setNewInteraction({
      platform_id: '',
      contact_name: '',
      contact_handle: '',
      interaction_type: 'dm',
      funnel_stage: 'lead',
      content: '',
    });
    setShowNewDialog(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const filteredInteractions = interactions.filter(i => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    if (filterType !== 'all' && i.interaction_type !== filterType) return false;
    if (filterFunnel !== 'all' && i.funnel_stage !== filterFunnel) return false;
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'comment': return <MessageCircle className="h-4 w-4" />;
      case 'dm': return <Mail className="h-4 w-4" />;
      case 'mention': return <Bell className="h-4 w-4" />;
      default: return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getPlatformName = (platformId: string | null) => {
    if (!platformId) return 'Sem plataforma';
    const platform = activePlatforms.find(p => p.id === platformId);
    return platform ? `${platform.icon} ${platform.name}` : 'Desconhecida';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.pending}</p>
            <p className="text-sm text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{stats.responded}</p>
            <p className="text-sm text-muted-foreground">Respondidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-500">{stats.byFunnel.lead || 0}</p>
            <p className="text-sm text-muted-foreground">Leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.byFunnel.customer || 0}</p>
            <p className="text-sm text-muted-foreground">Clientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Add Button */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="responded">Respondidos</SelectItem>
              <SelectItem value="ignored">Ignorados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Tipos</SelectItem>
              <SelectItem value="dm">Direct</SelectItem>
              <SelectItem value="comment">Comentário</SelectItem>
              <SelectItem value="mention">Menção</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterFunnel} onValueChange={setFilterFunnel}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo Funil</SelectItem>
              {Object.entries(FUNNEL_STAGES).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Interação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Interação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo</label>
                  <Select 
                    value={newInteraction.interaction_type} 
                    onValueChange={(v: 'dm' | 'comment' | 'mention') => 
                      setNewInteraction(prev => ({ ...prev, interaction_type: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(INTERACTION_TYPES).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.icon} {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Etapa do Funil</label>
                  <Select 
                    value={newInteraction.funnel_stage} 
                    onValueChange={(v: 'lead' | 'interested' | 'engaged' | 'customer') => 
                      setNewInteraction(prev => ({ ...prev, funnel_stage: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FUNNEL_STAGES).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Plataforma</label>
                <Select 
                  value={newInteraction.platform_id || '__none__'} 
                  onValueChange={(v) => 
                    setNewInteraction(prev => ({ ...prev, platform_id: v === '__none__' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {activePlatforms.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-1"><PlatformIcon icon={p.icon} size="sm" /> {p.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Contato</label>
                  <Input
                    value={newInteraction.contact_name}
                    onChange={(e) => setNewInteraction(prev => ({ ...prev, contact_name: e.target.value }))}
                    placeholder="Maria Silva"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">@ do Contato</label>
                  <Input
                    value={newInteraction.contact_handle}
                    onChange={(e) => setNewInteraction(prev => ({ ...prev, contact_handle: e.target.value }))}
                    placeholder="@usuario"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Mensagem</label>
                <Textarea
                  value={newInteraction.content}
                  onChange={(e) => setNewInteraction(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Cole aqui o comentário ou mensagem do cliente..."
                  rows={4}
                />
              </div>

              <Button onClick={handleCreate} className="w-full">
                Registrar Interação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Interactions List */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-4">
          {filteredInteractions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma interação encontrada
              </CardContent>
            </Card>
          ) : (
            filteredInteractions.map((interaction) => (
              <InteractionCard
                key={interaction.id}
                interaction={interaction}
                platformName={getPlatformName(interaction.platform_id)}
                suggestingFor={suggestingFor}
                onSuggest={() => suggestResponse(interaction, getPlatformName(interaction.platform_id))}
                onCopy={handleCopy}
                onMarkResponded={(response) => markAsResponded(interaction.id, response)}
                onUpdateFunnel={(stage) => updateInteraction(interaction.id, { funnel_stage: stage } as Partial<DigitalInteraction>)}
                onIgnore={() => updateInteraction(interaction.id, { status: 'ignored' } as Partial<DigitalInteraction>)}
                onDelete={() => deleteInteraction(interaction.id)}
                getTypeIcon={getTypeIcon}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface InteractionCardProps {
  interaction: DigitalInteraction;
  platformName: string;
  suggestingFor: string | null;
  onSuggest: () => void;
  onCopy: (text: string) => void;
  onMarkResponded: (response: string) => void;
  onUpdateFunnel: (stage: 'lead' | 'interested' | 'engaged' | 'customer') => void;
  onIgnore: () => void;
  onDelete: () => void;
  getTypeIcon: (type: string) => React.ReactNode;
}

function InteractionCard({
  interaction,
  platformName,
  suggestingFor,
  onSuggest,
  onCopy,
  onMarkResponded,
  onUpdateFunnel,
  onIgnore,
  onDelete,
  getTypeIcon,
}: InteractionCardProps) {
  const [response, setResponse] = useState(interaction.ai_suggested_response || '');
  const funnelConfig = FUNNEL_STAGES[interaction.funnel_stage];

  return (
    <Card className={interaction.status === 'responded' ? 'opacity-60' : ''}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {getTypeIcon(interaction.interaction_type)}
            <span className="font-medium">
              {interaction.contact_name || interaction.contact_handle || 'Usuário'}
            </span>
            {interaction.contact_handle && (
              <span className="text-sm text-muted-foreground">{interaction.contact_handle}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{platformName}</Badge>
            <Badge className={funnelConfig.color}>{funnelConfig.label}</Badge>
            {interaction.status === 'responded' && (
              <Badge variant="secondary" className="bg-green-500/20 text-green-700">
                <Check className="h-3 w-3 mr-1" />
                Respondido
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="bg-muted p-3 rounded-lg">
          <p className="text-sm">{interaction.content}</p>
        </div>

        {/* AI Suggested Response */}
        {interaction.status !== 'responded' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onSuggest}
                disabled={suggestingFor === interaction.id}
              >
                {suggestingFor === interaction.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Sugerir Resposta com IA
              </Button>
              
              <Select 
                value={interaction.funnel_stage}
                onValueChange={(v: 'lead' | 'interested' | 'engaged' | 'customer') => onUpdateFunnel(v)}
              >
                <SelectTrigger className="w-[130px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FUNNEL_STAGES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Digite ou edite a resposta..."
              rows={3}
            />

            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                onClick={() => onCopy(response)}
                disabled={!response}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => onMarkResponded(response)}
                disabled={!response}
              >
                <Check className="h-4 w-4 mr-2" />
                Marcar como Respondido
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={onIgnore}
              >
                <X className="h-4 w-4 mr-2" />
                Ignorar
              </Button>
              <Button 
                size="icon" 
                variant="ghost"
                className="ml-auto"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        )}

        {/* Responded Info */}
        {interaction.status === 'responded' && interaction.actual_response && (
          <div className="bg-green-500/10 p-3 rounded-lg">
            <p className="text-sm text-green-700">{interaction.actual_response}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Respondido em {format(new Date(interaction.responded_at!), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
