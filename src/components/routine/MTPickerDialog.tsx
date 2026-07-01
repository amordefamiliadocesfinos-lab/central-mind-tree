import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, CalendarDays, Calendar as CalIcon, Sparkles, Clock, CheckSquare, Trash2, Settings } from 'lucide-react';
import { MTManagerDialog } from './MTManagerDialog';
import { format, addDays, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useActiveUser } from '@/hooks/useActiveUser';
import { ActiveUserPicker } from '@/components/ActiveUserPicker';

interface MTBlock {
  start: string;
  end: string;
  title: string;
  focus: string;
  block_type: string;
  duration_minutes: number;
  notes?: string;
  checklist?: { text: string; done: boolean }[];
}

interface MT {
  id: string;
  area: string;
  name: string;
  description: string | null;
  target_role: string | null;
  icon: string | null;
  color: string | null;
  blocks: MTBlock[];
  is_default: boolean;
  order_index: number;
}

const AREAS = [
  { value: 'all', label: 'Todas', icon: '✨' },
  { value: 'gestao', label: 'Gestão', icon: '👔' },
  { value: 'comercial', label: 'Comercial', icon: '💬' },
  { value: 'operacional', label: 'Operacional', icon: '🏭' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  onApplied?: () => void;
}

export function MTPickerDialog({ open, onOpenChange, selectedDate, onApplied }: Props) {
  const [mts, setMts] = useState<MT[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaFilter, setAreaFilter] = useState('all');
  const [selectedMT, setSelectedMT] = useState<MT | null>(null);
  const [applying, setApplying] = useState(false);
  const { activeUserId, activeUser } = useActiveUser();
  const [managerOpen, setManagerOpen] = useState(false);

  const loadMts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('routine_mts' as any)
      .select('*')
      .eq('is_active', true)
      .order('order_index');
    if (error) { toast.error('Erro ao carregar MTs'); setLoading(false); return; }
    setMts((data as any) || []);
    setLoading(false);
  };


  useEffect(() => { if (open) loadMts(); }, [open]);

  const filtered = areaFilter === 'all' ? mts : mts.filter(m => m.area === areaFilter);

  const applyToDate = async (mt: MT, date: Date, replace = true) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (replace) {
      let del = supabase.from('routine_blocks').delete().eq('date', dateStr);
      if (activeUserId) del = del.eq('assigned_user_id', activeUserId);
      else del = del.is('assigned_user_id', null);
      await del;
    }
    const rows = mt.blocks.map(b => ({
      date: dateStr,
      title: b.title,
      block_type: b.block_type || 'foco',
      focus: b.focus || 'trabalho_profundo',
      duration_minutes: b.duration_minutes,
      planned_start: b.start,
      planned_end: b.end,
      notes: b.notes || `MT: ${mt.name}`,
      checklist: b.checklist || [],
      status: 'pendente',
      assigned_user_id: activeUserId,
    }));
    const { error } = await supabase.from('routine_blocks').insert(rows as any);
    if (error) throw error;
  };


  const handleApplyDay = async () => {
    if (!selectedMT) return;
    setApplying(true);
    try {
      await applyToDate(selectedMT, selectedDate, true);
      toast.success(`MT aplicada em ${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}`);
      onApplied?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao aplicar MT: ' + e.message);
    } finally {
      setApplying(false);
    }
  };

  const handleApplyWeek = async () => {
    if (!selectedMT) return;
    setApplying(true);
    try {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      for (let i = 0; i < 7; i++) {
        await applyToDate(selectedMT, addDays(start, i), true);
      }
      toast.success('MT aplicada à semana inteira (Seg → Dom)');
      onApplied?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Métodos de Trabalho (MT)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Cronogramas prontos por área. Escolha um e aplique ao dia ou semana.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setManagerOpen(true)}>
                <Settings className="h-4 w-4 mr-1" /> Gerenciar
              </Button>
              <ActiveUserPicker />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {activeUser
              ? <>A MT será aplicada para <span className="font-semibold text-foreground">{activeUser.name}</span>. Outros usuários não serão afetados.</>
              : <>Nenhum usuário selecionado — a MT será aplicada como <span className="font-semibold text-foreground">geral</span> (sem dono).</>}
          </p>
        </DialogHeader>


        <Tabs value={areaFilter} onValueChange={setAreaFilter} className="px-4 pt-3">
          <TabsList className="w-full grid grid-cols-4 h-9">
            {AREAS.map(a => (
              <TabsTrigger key={a.value} value={a.value} className="text-xs">
                <span className="mr-1">{a.icon}</span>{a.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <ScrollArea className="flex-1 px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma MT cadastrada nesta área.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(mt => {
                const isSelected = selectedMT?.id === mt.id;
                return (
                  <Card
                    key={mt.id}
                    className={cn(
                      'cursor-pointer transition-all border-2',
                      isSelected ? 'border-primary shadow-md' : 'border-transparent hover:border-muted'
                    )}
                    onClick={() => setSelectedMT(isSelected ? null : mt)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                          style={{ backgroundColor: (mt.color || '#3B82F6') + '20', color: mt.color || '#3B82F6' }}
                        >
                          {mt.icon || '📋'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm">{mt.name}</h3>
                            <Badge variant="secondary" className="text-[10px]">
                              {AREAS.find(a => a.value === mt.area)?.label || mt.area}
                            </Badge>
                          </div>
                          {mt.target_role && (
                            <p className="text-xs text-muted-foreground mt-0.5">👤 {mt.target_role}</p>
                          )}
                          {mt.description && (
                            <p className="text-xs text-muted-foreground mt-1">{mt.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {mt.blocks.length} blocos
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckSquare className="h-3 w-3" />
                              {mt.blocks.reduce((a, b) => a + (b.checklist?.length || 0), 0)} tarefas
                            </span>
                          </div>

                          {isSelected && (
                            <div className="mt-3 space-y-1 border-t pt-2">
                              {mt.blocks.map((b, i) => (
                                <div key={i} className="text-xs flex items-start gap-2">
                                  <span className="font-mono text-muted-foreground shrink-0">
                                    {b.start}–{b.end}
                                  </span>
                                  <span className="font-medium">{b.title}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-3 bg-muted/30 space-y-2">
          {selectedMT && (
            <p className="text-xs text-center text-muted-foreground">
              ⚠️ Aplicar substitui os blocos existentes do(s) dia(s).
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={!selectedMT || applying}
              onClick={handleApplyDay}
            >
              <CalIcon className="h-4 w-4 mr-2" />
              Aplicar ao dia ({format(selectedDate, 'dd/MM', { locale: ptBR })})
            </Button>
            <Button
              className="flex-1"
              disabled={!selectedMT || applying}
              onClick={handleApplyWeek}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              Aplicar à semana (Seg→Dom)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
