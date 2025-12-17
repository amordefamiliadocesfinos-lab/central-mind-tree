import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MergeableTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  node_id: string;
  progress: number;
  checklist: any[];
  media_urls: any[];
  due_date: string | null;
  scheduled_date: string | null;
}

export const useTaskMerge = () => {
  const [loading, setLoading] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [targetTaskId, setTargetTaskId] = useState<string | null>(null);

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTasks((prev) => {
      if (prev.includes(taskId)) {
        return prev.filter((id) => id !== taskId);
      }
      if (prev.length >= 4) {
        toast.error("Máximo de 4 tarefas para unificar");
        return prev;
      }
      return [...prev, taskId];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTasks([]);
    setTargetTaskId(null);
  }, []);

  const canMerge = selectedTasks.length >= 2 && selectedTasks.length <= 4 && targetTaskId;

  const mergeTasks = useCallback(async (
    tasks: MergeableTask[],
    targetId: string,
    newDate?: string | null
  ) => {
    // Validate: no structural tasks
    const hasStructural = tasks.some((t) => t.status === "estrutural");
    if (hasStructural) {
      toast.error("Não é possível unificar tarefas Estruturais");
      return false;
    }

    if (tasks.length < 2 || tasks.length > 4) {
      toast.error("Selecione entre 2 e 4 tarefas para unificar");
      return false;
    }

    const targetTask = tasks.find((t) => t.id === targetId);
    if (!targetTask) {
      toast.error("Tarefa principal não encontrada");
      return false;
    }

    setLoading(true);
    try {
      const otherTasks = tasks.filter((t) => t.id !== targetId);

      // Merge descriptions
      const mergedDescriptions = [
        targetTask.description || "",
        ...otherTasks.map((t) => t.description ? `\n\n--- Unificado de "${t.title}" ---\n${t.description}` : ""),
      ].join("");

      // Merge checklists
      const mergedChecklist = [
        ...(Array.isArray(targetTask.checklist) ? targetTask.checklist : []),
        ...otherTasks.flatMap((t) => Array.isArray(t.checklist) ? t.checklist : []),
      ];

      // Merge media
      const mergedMedia = [
        ...(Array.isArray(targetTask.media_urls) ? targetTask.media_urls : []),
        ...otherTasks.flatMap((t) => Array.isArray(t.media_urls) ? t.media_urls : []),
      ];

      // Calculate merged progress (weighted average)
      const totalProgress = tasks.reduce((sum, t) => sum + t.progress, 0);
      const mergedProgress = Math.floor(totalProgress / tasks.length);

      // Store merge history for undo
      const mergedData = {
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          node_id: t.node_id,
          progress: t.progress,
          checklist: t.checklist,
          media_urls: t.media_urls,
          due_date: t.due_date,
          scheduled_date: t.scheduled_date,
        })),
        targetId,
      };

      const { data: historyData, error: historyError } = await supabase
        .from("task_merge_history")
        .insert({
          merged_task_ids: tasks.map((t) => t.id),
          target_task_id: targetId,
          merged_data: mergedData,
        })
        .select()
        .single();

      if (historyError) throw historyError;

      // Update target task with merged data
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          description: mergedDescriptions.trim() || null,
          checklist: mergedChecklist,
          media_urls: mergedMedia,
          progress: mergedProgress,
          due_date: newDate !== undefined ? newDate : targetTask.due_date,
          scheduled_date: newDate !== undefined ? newDate : targetTask.scheduled_date,
        })
        .eq("id", targetId);

      if (updateError) throw updateError;

      // Soft delete other tasks
      const otherTaskIds = otherTasks.map((t) => t.id);
      const { error: deleteError } = await supabase
        .from("tasks")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", otherTaskIds);

      if (deleteError) throw deleteError;

      toast.success("Tarefas unificadas com sucesso!", {
        action: {
          label: "Desfazer",
          onClick: () => undoMerge(historyData.id),
        },
        duration: 10000, // 10 seconds to undo
      });

      clearSelection();
      return true;
    } catch (error: any) {
      toast.error("Erro ao unificar tarefas: " + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [clearSelection]);

  const undoMerge = useCallback(async (historyId: string) => {
    setLoading(true);
    try {
      // Get merge history
      const { data: history, error: fetchError } = await supabase
        .from("task_merge_history")
        .select("*")
        .eq("id", historyId)
        .single();

      if (fetchError) throw fetchError;
      if (!history) {
        toast.error("Histórico de unificação expirado");
        return false;
      }

      // Check if expired
      if (new Date(history.expires_at) < new Date()) {
        toast.error("Tempo para desfazer expirou (10 minutos)");
        return false;
      }

      const mergedData = history.merged_data as any;
      const tasks = mergedData.tasks as MergeableTask[];
      const targetId = mergedData.targetId;

      // Restore target task to original state
      const targetTask = tasks.find((t) => t.id === targetId);
      if (targetTask) {
        await supabase
          .from("tasks")
          .update({
            description: targetTask.description,
            checklist: targetTask.checklist,
            media_urls: targetTask.media_urls,
            progress: targetTask.progress,
            due_date: targetTask.due_date,
            scheduled_date: targetTask.scheduled_date,
          })
          .eq("id", targetId);
      }

      // Restore other tasks (remove soft delete)
      const otherTasks = tasks.filter((t) => t.id !== targetId);
      for (const task of otherTasks) {
        await supabase
          .from("tasks")
          .update({
            deleted_at: null,
            description: task.description,
            checklist: task.checklist,
            media_urls: task.media_urls,
            progress: task.progress,
            due_date: task.due_date,
            scheduled_date: task.scheduled_date,
          })
          .eq("id", task.id);
      }

      // Delete history record
      await supabase.from("task_merge_history").delete().eq("id", historyId);

      toast.success("Unificação desfeita com sucesso!");
      return true;
    } catch (error: any) {
      toast.error("Erro ao desfazer unificação: " + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    selectedTasks,
    targetTaskId,
    setTargetTaskId,
    toggleTaskSelection,
    clearSelection,
    canMerge,
    mergeTasks,
    undoMerge,
  };
};
