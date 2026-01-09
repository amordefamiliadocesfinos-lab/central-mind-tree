import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from './useNotifications';
import { toast } from 'sonner';

export interface RoutineBlock {
  id: string;
  template_id: string | null;
  date: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
  block_type: string;
  title: string;
  duration_minutes: number;
  node_id: string | null;
  task_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface RoutineTemplate {
  id: string;
  title: string;
  block_type: string;
  duration_minutes: number;
  node_id: string | null;
  start_time: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

const BLOCK_TYPES = {
  foco: { label: 'Foco', color: 'bg-red-500' },
  criativo: { label: 'Criativo', color: 'bg-purple-500' },
  pausa: { label: 'Pausa', color: 'bg-green-500' },
  reuniao: { label: 'Reunião', color: 'bg-blue-500' },
  admin: { label: 'Admin', color: 'bg-yellow-500' },
};

export function useRoutineBlocks(date?: string) {
  const [blocks, setBlocks] = useState<RoutineBlock[]>([]);
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBlock, setActiveBlock] = useState<RoutineBlock | null>(null);
  const [activeTimeout, setActiveTimeout] = useState<number | null>(null);
  const { scheduleNotification, requestPermission } = useNotifications();

  const targetDate = date || new Date().toISOString().split('T')[0];

  const fetchBlocks = useCallback(async () => {
    const { data, error } = await supabase
      .from('routine_blocks')
      .select('*')
      .eq('date', targetDate)
      .order('planned_start', { ascending: true });

    if (error) {
      console.error('Error fetching blocks:', error);
      return;
    }

    setBlocks((data as RoutineBlock[]) || []);
    
    // Find active block
    const active = (data as RoutineBlock[])?.find(b => b.status === 'andamento');
    if (active) {
      setActiveBlock(active);
      scheduleBlockEnd(active);
    }
    
    setLoading(false);
  }, [targetDate]);

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

  const scheduleBlockEnd = useCallback((block: RoutineBlock) => {
    if (activeTimeout) {
      clearTimeout(activeTimeout);
    }

    if (!block.actual_start) return;

    const startTime = new Date(block.actual_start).getTime();
    const endTime = startTime + block.duration_minutes * 60 * 1000;
    const remaining = endTime - Date.now();

    if (remaining > 0) {
      const timeoutId = scheduleNotification(
        block.block_type === 'pausa' 
          ? '⏰ Pausa terminada! Hora de voltar ao trabalho.'
          : `⏰ Bloco "${block.title}" finalizado!`,
        remaining,
        { body: 'Clique para ver próximo bloco.' }
      );
      setActiveTimeout(timeoutId as unknown as number);
    }
  }, [activeTimeout, scheduleNotification]);

  const startBlock = useCallback(async (blockId: string) => {
    // Request notification permission on first block start
    await requestPermission();

    // Find the block to get its duration
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

    // Update the global timer in timer_state table with block duration and start it
    const durationSeconds = block.duration_minutes * 60;
    const { data: timerData } = await supabase
      .from('timer_state')
      .select('id')
      .limit(1)
      .single();

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

    toast.success('Bloco iniciado!');
    fetchBlocks();
  }, [blocks, fetchBlocks, requestPermission]);

  const completeBlock = useCallback(async (blockId: string) => {
    if (activeTimeout) {
      clearTimeout(activeTimeout);
      setActiveTimeout(null);
    }

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

    setActiveBlock(null);
    toast.success('Bloco concluído!');
    fetchBlocks();
  }, [activeTimeout, fetchBlocks]);

  const skipBlock = useCallback(async (blockId: string) => {
    const { error } = await supabase
      .from('routine_blocks')
      .update({ status: 'pulado' })
      .eq('id', blockId);

    if (error) {
      toast.error('Erro ao pular bloco');
      return;
    }

    toast.info('Bloco pulado');
    fetchBlocks();
  }, [fetchBlocks]);

  const addBlock = useCallback(async (block: Partial<RoutineBlock>) => {
    const { error } = await supabase
      .from('routine_blocks')
      .insert({
        date: targetDate,
        title: block.title || 'Novo Bloco',
        block_type: block.block_type || 'foco',
        duration_minutes: block.duration_minutes || 25,
        planned_start: block.planned_start,
        planned_end: block.planned_end,
        node_id: block.node_id,
        task_id: block.task_id,
        template_id: block.template_id,
        status: 'pendente',
      });

    if (error) {
      toast.error('Erro ao adicionar bloco');
      return;
    }

    toast.success('Bloco adicionado!');
    fetchBlocks();
  }, [targetDate, fetchBlocks]);

  const insertPause = useCallback(async (afterBlockId: string) => {
    const block = blocks.find(b => b.id === afterBlockId);
    if (!block) return;

    await addBlock({
      title: 'Pausa',
      block_type: 'pausa',
      duration_minutes: 5,
      planned_start: block.planned_end || undefined,
    });
  }, [blocks, addBlock]);

  const generateFromTemplates = useCallback(async () => {
    if (templates.length === 0) {
      toast.info('Nenhum template de rotina configurado');
      return;
    }

    const newBlocks = templates.map(t => ({
      date: targetDate,
      template_id: t.id,
      title: t.title,
      block_type: t.block_type,
      duration_minutes: t.duration_minutes,
      planned_start: t.start_time,
      node_id: t.node_id,
      status: 'pendente',
    }));

    const { error } = await supabase
      .from('routine_blocks')
      .insert(newBlocks);

    if (error) {
      toast.error('Erro ao gerar rotina');
      return;
    }

    toast.success('Rotina do dia gerada!');
    fetchBlocks();
  }, [templates, targetDate, fetchBlocks]);

  // Calculate KPIs
  const calculateKPIs = useCallback(() => {
    const completed = blocks.filter(b => b.status === 'concluido');
    const skipped = blocks.filter(b => b.status === 'pulado');
    
    const plannedMinutes = blocks.reduce((acc, b) => acc + b.duration_minutes, 0);
    const executedMinutes = completed.reduce((acc, b) => {
      if (b.actual_start && b.actual_end) {
        const diff = new Date(b.actual_end).getTime() - new Date(b.actual_start).getTime();
        return acc + Math.floor(diff / 60000);
      }
      return acc + b.duration_minutes;
    }, 0);

    const adherence = plannedMinutes > 0 
      ? Math.round((executedMinutes / plannedMinutes) * 100) 
      : 0;

    const byType = blocks.reduce((acc, b) => {
      const type = b.block_type;
      if (!acc[type]) acc[type] = { planned: 0, executed: 0 };
      acc[type].planned += b.duration_minutes;
      if (b.status === 'concluido') acc[type].executed += b.duration_minutes;
      return acc;
    }, {} as Record<string, { planned: number; executed: number }>);

    return {
      totalBlocks: blocks.length,
      completed: completed.length,
      skipped: skipped.length,
      plannedMinutes,
      executedMinutes,
      adherence,
      byType,
    };
  }, [blocks]);

  useEffect(() => {
    fetchBlocks();
    fetchTemplates();

    const channel = supabase
      .channel('routine-blocks-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'routine_blocks',
        filter: `date=eq.${targetDate}`,
      }, fetchBlocks)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (activeTimeout) clearTimeout(activeTimeout);
    };
  }, [targetDate, fetchBlocks, fetchTemplates]);

  return {
    blocks,
    templates,
    loading,
    activeBlock,
    startBlock,
    completeBlock,
    skipBlock,
    addBlock,
    insertPause,
    generateFromTemplates,
    calculateKPIs,
    blockTypes: BLOCK_TYPES,
  };
}
