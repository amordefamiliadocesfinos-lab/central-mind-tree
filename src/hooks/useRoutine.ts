import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from './useNotifications';
import { useActiveUser } from './useActiveUser';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';


export type RecurrenceType = '1h' | '2h' | '4h' | '6h' | '12h' | 'daily' | 'weekly' | 'monthly';

export const RECURRENCE_OPTIONS: { value: RecurrenceType | ''; label: string }[] = [
  { value: '', label: 'Sem recorrência' },
  { value: '1h', label: 'A cada 1 hora' },
  { value: '2h', label: 'A cada 2 horas' },
  { value: '4h', label: 'A cada 4 horas' },
  { value: '6h', label: 'A cada 6 horas' },
  { value: '12h', label: 'A cada 12 horas' },
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
];

export interface RoutineBlock {
  id: string;
  template_id: string | null;
  date: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: 'pendente' | 'andamento' | 'concluido' | 'pulado';
  block_type: string;
  focus: string;
  title: string;
  duration_minutes: number;
  node_id: string | null;
  task_id: string | null;
  notes: string | null;
  recurrence: RecurrenceType | null;
  recurrence_parent_id: string | null;
  assigned_user_id?: string | null;
  created_at: string;
}


export function getNextRecurrence(date: string, time: string | null, recurrence: RecurrenceType): { date: string; time: string } {
  const t = time || '08:00';
  const base = parseISO(`${date}T${t}:00`);
  let next: Date;
  switch (recurrence) {
    case '1h': next = new Date(base.getTime() + 1 * 3600 * 1000); break;
    case '2h': next = new Date(base.getTime() + 2 * 3600 * 1000); break;
    case '4h': next = new Date(base.getTime() + 4 * 3600 * 1000); break;
    case '6h': next = new Date(base.getTime() + 6 * 3600 * 1000); break;
    case '12h': next = new Date(base.getTime() + 12 * 3600 * 1000); break;
    case 'daily': next = addDays(base, 1); break;
    case 'weekly': next = addDays(base, 7); break;
    case 'monthly': {
      const d = new Date(base);
      d.setMonth(d.getMonth() + 1);
      next = d;
      break;
    }
    default: next = base;
  }
  return {
    date: format(next, 'yyyy-MM-dd'),
    time: format(next, 'HH:mm'),
  };
}

export interface RoutineTemplate {
  id: string;
  title: string;
  block_type: string;
  focus: string;
  duration_minutes: number;
  node_id: string | null;
  start_time: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

export interface RoutinePrefs {
  id: string;
  work_hours_start: string;
  work_hours_end: string;
  breaks: { start: string; end: string }[];
  default_template_id: string | null;
  capacity_targets: {
    deep_work_min: number;
    atendimento_min: number;
  };
}

export interface RoutineStats {
  id: string;
  date: string;
  planned_min: number;
  done_min: number;
  deep_work_min: number;
  atendimento_min: number;
  context_switches: number;
}

export const FOCUS_TYPES = {
  planejamento: { label: 'Planejamento', color: 'bg-slate-500', icon: '📋' },
  trabalho_profundo: { label: 'Trabalho Profundo', color: 'bg-red-600', icon: '🔥' },
  atendimento: { label: 'Atendimento', color: 'bg-blue-500', icon: '📞' },
  criativo: { label: 'Criativo/Estudo', color: 'bg-purple-500', icon: '🎨' },
  pessoal: { label: 'Pessoal/Logística', color: 'bg-green-500', icon: '🏠' },
  buffer: { label: 'Buffer/Imprevistos', color: 'bg-amber-500', icon: '⏳' },
  pausa: { label: 'Pausa', color: 'bg-emerald-400', icon: '☕' },
  reuniao: { label: 'Reunião', color: 'bg-cyan-500', icon: '👥' },
} as const;

export type FocusType = keyof typeof FOCUS_TYPES;
export type ViewMode = 'day' | 'week' | 'month';

interface UseRoutineOptions {
  initialDate?: Date;
  initialView?: ViewMode;
}

export function useRoutine(options: UseRoutineOptions = {}) {
  const { initialDate = new Date(), initialView = 'day' } = options;
  
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [blocks, setBlocks] = useState<RoutineBlock[]>([]);
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [prefs, setPrefs] = useState<RoutinePrefs | null>(null);
  const [stats, setStats] = useState<RoutineStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBlock, setActiveBlock] = useState<RoutineBlock | null>(null);

  const { activeUserId } = useActiveUser();
  const { scheduleNotification, requestPermission, notify } = useNotifications();


  // Date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === 'day') {
      return { start: selectedDate, end: selectedDate };
    } else if (viewMode === 'week') {
      return {
        start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
        end: endOfWeek(selectedDate, { weekStartsOn: 1 }),
      };
    } else {
      return {
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate),
      };
    }
  }, [selectedDate, viewMode]);

  const daysInRange = useMemo(() => {
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange]);

  // Fetch blocks for current range
  const fetchBlocks = useCallback(async () => {
    const startStr = format(dateRange.start, 'yyyy-MM-dd');
    const endStr = format(dateRange.end, 'yyyy-MM-dd');

    let q = supabase
      .from('routine_blocks')
      .select('*')
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })
      .order('planned_start', { ascending: true });

    if (activeUserId) {
      q = q.or(`assigned_user_id.eq.${activeUserId},assigned_user_id.is.null`);
    }

    const { data, error } = await q;

    if (error) {
      console.error('Error fetching blocks:', error);
      return;
    }

    const list = (data as RoutineBlock[]) || [];
    setBlocks(list);

    // Mantém activeBlock somente se ainda existir e estiver "andamento"
    const active = list.find((b) => b.status === 'andamento');
    setActiveBlock(active || null);
  }, [dateRange, activeUserId]);


  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    const { data, error } = await supabase
      .from('routine_templates')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching templates:', error);
      return;
    }

    setTemplates((data as RoutineTemplate[]) || []);
  }, []);

  // Fetch preferences
  const fetchPrefs = useCallback(async () => {
    const { data, error } = await supabase
      .from('routine_prefs')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching prefs:', error);
      return;
    }

    if (data) {
      setPrefs({
        ...data,
        breaks: (data.breaks as any[]) || [],
        capacity_targets: (data.capacity_targets as any) || { deep_work_min: 180, atendimento_min: 120 },
      } as RoutinePrefs);
    }
  }, []);

  // Fetch stats for range
  const fetchStats = useCallback(async () => {
    const startStr = format(dateRange.start, 'yyyy-MM-dd');
    const endStr = format(dateRange.end, 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('routine_stats')
      .select('*')
      .gte('date', startStr)
      .lte('date', endStr);

    if (error) {
      console.error('Error fetching stats:', error);
      return;
    }

    setStats((data as RoutineStats[]) || []);
  }, [dateRange]);

  // Block actions
  const startBlock = useCallback(async (blockId: string) => {
    await requestPermission();
    
    const block = blocks.find(b => b.id === blockId);
    if (!block) {
      toast.error('Bloco não encontrado');
      return;
    }

    const { error } = await supabase
      .from('routine_blocks')
      .update({ 
        status: 'andamento', 
        actual_start: new Date().toISOString() 
      })
      .eq('id', blockId);

    if (error) {
      toast.error('Erro ao iniciar bloco');
      return;
    }

    // Update timer
    const durationSeconds = block.duration_minutes * 60;
    const { data: timerData } = await supabase
      .from('timer_state')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (timerData) {
      await supabase
        .from('timer_state')
        .update({
          remaining_seconds: durationSeconds,
          status: 'running',
          last_update: new Date().toISOString(),
        })
        .eq('id', timerData.id);
    }

    // Schedule notification
    scheduleNotification(
      `⏰ Bloco "${block.title}" finalizado!`,
      durationSeconds * 1000,
      { body: 'Hora do próximo bloco!' }
    );

    const startTime = format(new Date(), 'HH:mm');
    toast.success(`▶️ "${block.title}" em andamento`, {
      description: `Status: Pendente → Em andamento · Iniciado às ${startTime} · Duração prevista: ${block.duration_minutes} min`,
      duration: 4000,
    });
    fetchBlocks();
  }, [blocks, fetchBlocks, requestPermission, scheduleNotification]);

  const completeBlock = useCallback(async (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    
    const { error } = await supabase
      .from('routine_blocks')
      .update({ 
        status: 'concluido', 
        actual_end: new Date().toISOString() 
      })
      .eq('id', blockId);

    if (error) {
      toast.error('Erro ao concluir bloco');
      return;
    }

    // Update stats
    if (block) {
      const dateStr = block.date;
      const { data: existingStats } = await supabase
        .from('routine_stats')
        .select('*')
        .eq('date', dateStr)
        .maybeSingle();

      const focusMinutes = {
        deep_work_min: block.focus === 'trabalho_profundo' ? block.duration_minutes : 0,
        atendimento_min: block.focus === 'atendimento' ? block.duration_minutes : 0,
      };

      if (existingStats) {
        await supabase
          .from('routine_stats')
          .update({
            done_min: existingStats.done_min + block.duration_minutes,
            deep_work_min: existingStats.deep_work_min + focusMinutes.deep_work_min,
            atendimento_min: existingStats.atendimento_min + focusMinutes.atendimento_min,
          })
          .eq('id', existingStats.id);
      } else {
        await supabase
          .from('routine_stats')
          .insert({
            date: dateStr,
            planned_min: blocks.filter(b => b.date === dateStr).reduce((sum, b) => sum + b.duration_minutes, 0),
            done_min: block.duration_minutes,
            ...focusMinutes,
          });
      }
    }

    setActiveBlock(null);

    // Auto-schedule next recurrence
    if (block?.recurrence) {
      const next = getNextRecurrence(block.date, block.planned_start, block.recurrence);
      const { error: recErr } = await supabase.from('routine_blocks').insert({
        date: next.date,
        title: block.title,
        block_type: block.block_type,
        focus: block.focus,
        duration_minutes: block.duration_minutes,
        planned_start: next.time,
        node_id: block.node_id,
        task_id: block.task_id,
        template_id: block.template_id,
        notes: block.notes,
        recurrence: block.recurrence,
        recurrence_parent_id: block.recurrence_parent_id || block.id,
        status: 'pendente',
      });
      if (!recErr) {
        toast.info(`🔁 Próxima ocorrência agendada para ${next.date === block.date ? '' : next.date + ' '}${next.time}`);
      }
    }

    const endTime = format(new Date(), 'HH:mm');
    let actualMinutes = block?.duration_minutes ?? 0;
    if (block?.actual_start) {
      actualMinutes = Math.max(1, Math.round((Date.now() - new Date(block.actual_start).getTime()) / 60000));
    }
    const diff = block ? actualMinutes - block.duration_minutes : 0;
    const diffLabel = diff === 0 ? 'no tempo previsto' : diff > 0 ? `+${diff} min além do previsto` : `${Math.abs(diff)} min antes do previsto`;
    toast.success(`✅ "${block?.title ?? 'Bloco'}" concluído`, {
      description: `Status: Em andamento → Concluído · Finalizado às ${endTime} · ${actualMinutes} min trabalhados (${diffLabel})`,
      duration: 5000,
    });
    fetchBlocks();
    fetchStats();
  }, [blocks, fetchBlocks, fetchStats]);

  const skipBlock = useCallback(async (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    const previousStatus = block?.status === 'andamento' ? 'Em andamento' : 'Pendente';

    const { error } = await supabase
      .from('routine_blocks')
      .update({ status: 'pulado' })
      .eq('id', blockId);

    if (error) {
      toast.error('Erro ao pular bloco');
      return;
    }

    toast.info(`⏭️ "${block?.title ?? 'Bloco'}" pulado`, {
      description: `Status: ${previousStatus} → Pulado · Não contabilizado nas estatísticas do dia`,
      duration: 4000,
    });
    fetchBlocks();
  }, [blocks, fetchBlocks]);

  const addBlock = useCallback(async (block: Partial<RoutineBlock> & { checklist?: any[]; assigned_user_id?: string | null }) => {
    const dateStr = block.date || format(selectedDate, 'yyyy-MM-dd');

    const { error } = await supabase
      .from('routine_blocks')
      .insert({
        date: dateStr,
        title: block.title || 'Novo Bloco',
        block_type: block.block_type || 'foco',
        focus: block.focus || 'trabalho_profundo',
        duration_minutes: block.duration_minutes || 25,
        planned_start: block.planned_start,
        planned_end: block.planned_end,
        node_id: block.node_id,
        task_id: block.task_id,
        template_id: block.template_id,
        notes: block.notes,
        checklist: (block.checklist as any) || [],
        recurrence: block.recurrence || null,
        recurrence_parent_id: block.recurrence_parent_id || null,
        status: 'pendente',
        assigned_user_id: block.assigned_user_id !== undefined ? block.assigned_user_id : activeUserId,
      } as any);

    if (error) {
      toast.error('Erro ao adicionar bloco');
      return;
    }

    toast.success('Bloco adicionado!');
    fetchBlocks();
  }, [selectedDate, fetchBlocks, activeUserId]);


  const pauseBlock = useCallback(async (blockId: string) => {
    const { error } = await supabase
      .from('routine_blocks')
      .update({ status: 'pendente', actual_start: null })
      .eq('id', blockId);
    if (error) { toast.error('Erro ao pausar'); return; }
    setActiveBlock(null);
    toast.info('⏸️ Bloco pausado');
    fetchBlocks();
  }, [fetchBlocks]);


  const updateBlock = useCallback(async (blockId: string, updates: Partial<RoutineBlock>) => {
    const { error } = await supabase
      .from('routine_blocks')
      .update(updates)
      .eq('id', blockId);

    if (error) {
      toast.error('Erro ao atualizar bloco');
      return;
    }

    toast.success('Bloco atualizado');
    fetchBlocks();
  }, [fetchBlocks]);

  const deleteBlock = useCallback(async (blockId: string) => {
    const { error } = await supabase
      .from('routine_blocks')
      .delete()
      .eq('id', blockId);

    if (error) {
      toast.error('Erro ao excluir bloco');
      return;
    }

    toast.success('Bloco excluído');
    fetchBlocks();
  }, [fetchBlocks]);

  const reorderBlocks = useCallback(async (reorderedBlocks: RoutineBlock[]) => {
    // Update order based on new positions (paralelizado)
    const updates = reorderedBlocks.map((block, index) => ({
      id: block.id,
      planned_start: calculateNewStartTime(index, reorderedBlocks),
    }));

    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from('routine_blocks')
          .update({ planned_start: u.planned_start })
          .eq('id', u.id)
      )
    );

    const failed = results.filter((r) => r.error).length;
    if (failed > 0) {
      toast.error(`Falha ao reordenar ${failed} bloco(s)`);
    }

    fetchBlocks();
  }, [fetchBlocks]);

  // Auto-plan day
  const autoPlanDay = useCallback(async (dateStr?: string | Date) => {
    const targetDate = (typeof dateStr === 'string')
      ? dateStr
      : (dateStr instanceof Date ? format(dateStr, 'yyyy-MM-dd') : format(selectedDate, 'yyyy-MM-dd'));
    
    // Clear existing blocks for the day
    const { error: deleteError } = await supabase
      .from('routine_blocks')
      .delete()
      .eq('date', targetDate)
      .eq('status', 'pendente');

    if (deleteError) {
      console.error('Error clearing blocks:', deleteError);
    }

    // Get templates or use default schedule
    let schedule: Array<{ focus: FocusType; title: string; duration: number; start: string }>;
    
    if (templates.length > 0) {
      schedule = templates.map(t => ({
        focus: (t.focus as FocusType) || 'trabalho_profundo',
        title: t.title,
        duration: t.duration_minutes,
        start: t.start_time || '08:00',
      }));
    } else {
      // Default schedule based on heuristics
      schedule = [
        { focus: 'planejamento', title: 'Planejamento do Dia', duration: 30, start: '08:00' },
        { focus: 'trabalho_profundo', title: 'Trabalho Profundo 1', duration: 90, start: '08:30' },
        { focus: 'pausa', title: 'Pausa', duration: 15, start: '10:00' },
        { focus: 'trabalho_profundo', title: 'Trabalho Profundo 2', duration: 90, start: '10:15' },
        { focus: 'pausa', title: 'Almoço', duration: 60, start: '11:45' },
        { focus: 'atendimento', title: 'Atendimento/Operacional', duration: 120, start: '12:45' },
        { focus: 'pausa', title: 'Pausa', duration: 15, start: '14:45' },
        { focus: 'criativo', title: 'Criativo/Estudo', duration: 90, start: '15:00' },
        { focus: 'buffer', title: 'Buffer/Imprevistos', duration: 30, start: '16:30' },
      ];
    }

    const newBlocks = schedule.map(item => ({
      date: targetDate,
      title: item.title,
      block_type: 'foco',
      focus: item.focus,
      duration_minutes: item.duration,
      planned_start: item.start,
      status: 'pendente',
    }));

    const { error } = await supabase
      .from('routine_blocks')
      .insert(newBlocks);

    if (error) {
      toast.error('Erro ao gerar rotina');
      return;
    }

    // Update stats
    const totalPlanned = newBlocks.reduce((sum, b) => sum + b.duration_minutes, 0);
    await supabase
      .from('routine_stats')
      .upsert({
        date: targetDate,
        planned_min: totalPlanned,
        done_min: 0,
        deep_work_min: 0,
        atendimento_min: 0,
        context_switches: 0,
      }, { onConflict: 'date' });

    toast.success('Dia planejado! 🎯');
    fetchBlocks();
    fetchStats();
  }, [selectedDate, templates, fetchBlocks, fetchStats]);

  // Auto-plan week
  const autoPlanWeek = useCallback(async () => {
    const weekDays = eachDayOfInterval({
      start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
      end: endOfWeek(selectedDate, { weekStartsOn: 1 }),
    }).filter(d => d.getDay() !== 0 && d.getDay() !== 6); // Exclude weekends

    for (const day of weekDays) {
      await autoPlanDay(format(day, 'yyyy-MM-dd'));
    }

    toast.success('Semana planejada! 📅');
  }, [selectedDate, autoPlanDay]);

  // Push blocks forward
  const pushBlocksForward = useCallback(async (minutes: number = 15) => {
    const todayStr = format(selectedDate, 'yyyy-MM-dd');
    const pendingBlocks = blocks
      .filter(b => b.date === todayStr && b.status === 'pendente')
      .sort((a, b) => (a.planned_start || '').localeCompare(b.planned_start || ''));

    const updates = pendingBlocks
      .filter(b => b.planned_start)
      .map((block) => {
        const [hours, mins] = block.planned_start!.split(':').map(Number);
        const totalMins = Math.min(hours * 60 + mins + minutes, 23 * 60 + 59);
        const newHours = Math.floor(totalMins / 60);
        const finalMins = totalMins % 60;
        const newTime = `${String(newHours).padStart(2, '0')}:${String(finalMins).padStart(2, '0')}`;
        return supabase
          .from('routine_blocks')
          .update({ planned_start: newTime })
          .eq('id', block.id);
      });

    await Promise.all(updates);

    toast.success(`Blocos empurrados +${minutes}min`);
    fetchBlocks();
  }, [selectedDate, blocks, fetchBlocks]);

  // Get blocks by day
  const getBlocksByDay = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blocks.filter(b => b.date === dateStr);
  }, [blocks]);

  // Calculate KPIs for a day
  const getDayKPIs = useCallback((date: Date) => {
    const dayBlocks = getBlocksByDay(date);
    const completed = dayBlocks.filter(b => b.status === 'concluido');
    const skipped = dayBlocks.filter(b => b.status === 'pulado');
    
    const plannedMinutes = dayBlocks.reduce((acc, b) => acc + b.duration_minutes, 0);
    const executedMinutes = completed.reduce((acc, b) => acc + b.duration_minutes, 0);
    
    const byFocus: Record<string, { planned: number; done: number }> = {};
    dayBlocks.forEach(b => {
      const focus = b.focus || 'trabalho_profundo';
      if (!byFocus[focus]) byFocus[focus] = { planned: 0, done: 0 };
      byFocus[focus].planned += b.duration_minutes;
      if (b.status === 'concluido') byFocus[focus].done += b.duration_minutes;
    });

    return {
      totalBlocks: dayBlocks.length,
      completed: completed.length,
      skipped: skipped.length,
      plannedMinutes,
      executedMinutes,
      adherence: plannedMinutes > 0 ? Math.round((executedMinutes / plannedMinutes) * 100) : 0,
      byFocus,
      deepWorkTarget: prefs?.capacity_targets?.deep_work_min || 180,
      atendimentoTarget: prefs?.capacity_targets?.atendimento_min || 120,
      deepWorkDone: byFocus.trabalho_profundo?.done || 0,
      atendimentoDone: byFocus.atendimento?.done || 0,
    };
  }, [getBlocksByDay, prefs]);

  // Calculate week summary
  const weekSummary = useMemo(() => {
    const summary: Record<FocusType, { planned: number; done: number }> = {} as any;
    
    Object.keys(FOCUS_TYPES).forEach(focus => {
      summary[focus as FocusType] = { planned: 0, done: 0 };
    });

    blocks.forEach(block => {
      const focus = (block.focus || 'trabalho_profundo') as FocusType;
      if (summary[focus]) {
        summary[focus].planned += block.duration_minutes;
        if (block.status === 'concluido') {
          summary[focus].done += block.duration_minutes;
        }
      }
    });

    const totalPlanned = Object.values(summary).reduce((sum, v) => sum + v.planned, 0);
    const totalDone = Object.values(summary).reduce((sum, v) => sum + v.done, 0);
    const consistentDays = daysInRange.filter(d => {
      const dayBlocks = getBlocksByDay(d);
      const completed = dayBlocks.filter(b => b.status === 'concluido').length;
      return completed >= dayBlocks.length * 0.7; // 70% completion
    }).length;

    return {
      byFocus: summary,
      totalPlanned,
      totalDone,
      adherence: totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0,
      consistentDays,
      totalDays: daysInRange.length,
    };
  }, [blocks, daysInRange, getBlocksByDay]);

  // Initialize: carrega templates e prefs uma vez, e mantém realtime estável
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([fetchTemplates(), fetchPrefs()])
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const channel = supabase
      .channel('routine-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routine_blocks' }, () => {
        // Refetch usando a referência mais recente via state setter
        fetchBlocksRef.current?.();
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mantém ref atualizada ao fetchBlocks mais recente para uso no realtime
  const fetchBlocksRef = useRef<typeof fetchBlocks | null>(null);
  useEffect(() => {
    fetchBlocksRef.current = fetchBlocks;
  }, [fetchBlocks]);

  // Refetch when date range changes
  useEffect(() => {
    fetchBlocks();
    fetchStats();
  }, [dateRange, fetchBlocks, fetchStats]);

  // Notification poller: alert when a pending block's planned_start arrives
  useEffect(() => {
    const STORAGE_KEY = 'pc.routine.notified';
    const check = () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const nowHHMM = format(new Date(), 'HH:mm');
      const notified: Record<string, string> = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      blocks.forEach((b) => {
        if (b.date !== today) return;
        if (b.status !== 'pendente') return;
        if (!b.planned_start) return;
        if (b.planned_start > nowHHMM) return;
        const key = `${b.id}:${b.date}:${b.planned_start}`;
        if (notified[key]) return;
        notify(`⏰ ${b.title}`, { body: `Rotina agendada para ${b.planned_start}` });
        try {
          toast.warning(`⏰ Rotina pendente: ${b.title}`, { description: `Programada para ${b.planned_start}`, duration: 8000 });
        } catch {}
        notified[key] = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notified));
      });
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [blocks, notify]);


  return {
    // State
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode,
    blocks,
    templates,
    prefs,
    stats,
    loading,
    activeBlock,
    daysInRange,
    dateRange,
    
    // Block actions
    startBlock,
    completeBlock,
    skipBlock,
    addBlock,
    updateBlock,
    deleteBlock,
    pauseBlock,
    reorderBlocks,
    
    // Planning
    autoPlanDay,
    autoPlanWeek,
    pushBlocksForward,
    
    // Helpers
    getBlocksByDay,
    getDayKPIs,
    weekSummary,
    focusTypes: FOCUS_TYPES,
  };
}

// Helper function to calculate new start time
function calculateNewStartTime(index: number, blocks: RoutineBlock[]): string {
  if (index === 0) {
    return blocks[0].planned_start || '08:00';
  }
  
  const prevBlock = blocks[index - 1];
  if (!prevBlock.planned_start) return '08:00';
  
  const [hours, mins] = prevBlock.planned_start.split(':').map(Number);
  const totalMins = hours * 60 + mins + prevBlock.duration_minutes;
  const newHours = Math.floor(totalMins / 60);
  const newMins = totalMins % 60;
  
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}
