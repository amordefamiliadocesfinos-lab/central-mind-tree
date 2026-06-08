import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Plus, Pencil, FileText, Megaphone, Rocket, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDisplayDate } from '@/lib/dateUtils';
import type { SeasonalDay } from '@/hooks/useSeasonalDays';

interface LinkedIdea {
  id: string;
  title: string;
  idea_type: string;
  status: string;
  variations_count: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  seasonalDay: SeasonalDay | null;
  allEvents?: SeasonalDay[];
  onEditEvent: (sd: SeasonalDay) => void;
  onCreateEvent: () => void;
}

const TYPE_OPTIONS = [
  { value: 'conteudo', label: 'Conteúdo', icon: FileText, hint: 'Post, vídeo, story...' },
  { value: 'campanha', label: 'Campanha', icon: Rocket, hint: 'Estratégia completa' },
  { value: 'anuncio', label: 'Anúncio', icon: Megaphone, hint: 'Tráfego pago' },
];

const ROOT_NODE_ID = 'd7c76db8-b7e0-4ce1-87ca-21275c346326';

export const SeasonalEventDialog = ({
  open, onOpenChange, date, seasonalDay, allEvents = [], onEditEvent, onCreateEvent,
}: Props) => {
  const [linked, setLinked] = useState<LinkedIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSeasonalId, setActiveSeasonalId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [ideaType, setIdeaType] = useState('conteudo');
  const [creating, setCreating] = useState(false);

  const currentSeasonal = allEvents.find(e => e.id === activeSeasonalId) || seasonalDay;

  useEffect(() => {
    if (open) {
      setActiveSeasonalId(seasonalDay?.id || allEvents[0]?.id || null);
      setTitle('');
      setIdeaType('conteudo');
    }
  }, [open, seasonalDay?.id]);

  useEffect(() => {
    if (!open || !currentSeasonal) return;
    fetchLinked();
  }, [open, currentSeasonal?.id]);

  const fetchLinked = async () => {
    if (!currentSeasonal) return;
    setLoading(true);
    const { data } = await supabase
      .from('digital_ideas')
      .select('id, title, idea_type, status, variations:digital_variations(id)')
      .eq('seasonal_day_id', currentSeasonal.id)
      .order('created_at', { ascending: false });
    setLinked(
      ((data || []) as any[]).map(d => ({
        id: d.id,
        title: d.title,
        idea_type: d.idea_type,
        status: d.status,
        variations_count: (d.variations || []).length,
      }))
    );
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!currentSeasonal) {
      toast.error('Selecione um evento sazonal');
      return;
    }
    if (!title.trim()) {
      toast.error('Informe o título');
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from('digital_ideas')
      .insert({
        title: title.trim(),
        idea_type: ideaType,
        status: 'estrutural',
        node_id: ROOT_NODE_ID,
        seasonal_day_id: currentSeasonal.id,
        seasonal_date: date || null,
      } as any)
      .select('id')
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error('Erro ao criar');
      return;
    }
    toast.success(`${TYPE_OPTIONS.find(t => t.value === ideaType)?.label} criado e vinculado a ${currentSeasonal.name}`);
    setTitle('');
    fetchLinked();
  };

  const counts = linked.reduce((acc, l) => {
    acc[l.idea_type] = (acc[l.idea_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`✨ Evento Sazonal · ${formatDisplayDate(date)}`}
    >
      <div className="space-y-5">
        {/* Event selector */}
        {allEvents.length > 0 ? (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Evento</Label>
            <div className="flex flex-wrap gap-2">
              {allEvents.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => setActiveSeasonalId(ev.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border flex items-center gap-2 transition-colors ${
                    ev.id === activeSeasonalId ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ev.color }} />
                  {ev.name}
                </button>
              ))}
              {currentSeasonal && (
                <Button size="sm" variant="ghost" onClick={() => onEditEvent(currentSeasonal)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">Nenhum evento sazonal nesta data</p>
            <Button size="sm" onClick={onCreateEvent}>
              <Plus className="h-4 w-4 mr-1" /> Criar evento sazonal
            </Button>
          </div>
        )}

        {currentSeasonal && (
          <>
            {/* Counts overview */}
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <div key={opt.value} className="border rounded-lg p-3 text-center bg-card">
                    <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-xl font-bold">{counts[opt.value] || 0}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{opt.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Quick create */}
            <div className="border rounded-xl p-3 space-y-3 bg-muted/30">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Criar vinculado a {currentSeasonal.name}</Label>
              <div className="flex gap-2">
                <Select value={ideaType} onValueChange={setIdeaType}>
                  <SelectTrigger className="w-40 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Input
                  placeholder={`Ex: ${currentSeasonal.name} — promo principal`}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                  className="flex-1 h-10"
                />
                <Button onClick={handleCreate} disabled={creating || !title.trim()} className="h-10">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Criar</>}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {TYPE_OPTIONS.find(t => t.value === ideaType)?.hint}
              </p>
            </div>

            {/* Linked list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Planejados ({linked.length})
                </Label>
                <Link to="/digital" className="text-xs text-primary hover:underline flex items-center gap-1">
                  Abrir Digital <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              {loading ? (
                <div className="text-center py-4 text-sm text-muted-foreground">Carregando…</div>
              ) : linked.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                  Nenhum conteúdo planejado ainda
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                  {linked.map(l => {
                    const opt = TYPE_OPTIONS.find(o => o.value === l.idea_type);
                    const Icon = opt?.icon || FileText;
                    return (
                      <Link
                        key={l.id}
                        to="/digital"
                        className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{l.title}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {opt?.label || l.idea_type} · {l.status}
                            {l.variations_count > 0 && ` · ${l.variations_count} variação(ões)`}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">#{l.id.slice(0, 6)}</Badge>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ResponsiveDialog>
  );
};
