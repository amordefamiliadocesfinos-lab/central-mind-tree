import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OnHoldData {
  on_hold: boolean;
  on_hold_who: string | null;
  on_hold_channel: string | null;
  on_hold_deadline: string | null;
  on_hold_note: string | null;
  on_hold_created_at: string | null;
}

export interface OnHoldFormData {
  who: string;
  channel: string;
  deadline: Date | null;
  note: string;
}

export const useOnHold = () => {
  const [loading, setLoading] = useState(false);

  const toggleOnHold = useCallback(async (
    taskId: string,
    currentlyOnHold: boolean,
    formData?: OnHoldFormData
  ) => {
    setLoading(true);
    try {
      if (currentlyOnHold) {
        // Removing from on hold - log the action
        const { data: taskData } = await supabase
          .from("tasks")
          .select("on_hold_who, on_hold_channel, on_hold_deadline, on_hold_note, on_hold_created_at")
          .eq("id", taskId)
          .single();

        if (taskData) {
          await supabase.from("on_hold_log").insert([{
            task_id: taskId,
            action: "removed",
            previous_data: taskData as any,
          }]);
        }

        // Clear on hold fields
        const { error } = await supabase
          .from("tasks")
          .update({
            on_hold: false,
            on_hold_who: null,
            on_hold_channel: null,
            on_hold_deadline: null,
            on_hold_note: null,
            on_hold_created_at: null,
          })
          .eq("id", taskId);

        if (error) throw error;
        toast.success("Tarefa removida de Em Espera");
      } else {
        // Setting on hold
        const { error } = await supabase
          .from("tasks")
          .update({
            on_hold: true,
            on_hold_who: formData?.who || null,
            on_hold_channel: formData?.channel || null,
            on_hold_deadline: formData?.deadline?.toISOString().split("T")[0] || null,
            on_hold_note: formData?.note || null,
            on_hold_created_at: new Date().toISOString(),
          })
          .eq("id", taskId);

        if (error) throw error;

        // Log the action
        await supabase.from("on_hold_log").insert([{
          task_id: taskId,
          action: "added",
          previous_data: formData as any,
        }]);

        toast.success("Tarefa marcada como Em Espera");
      }
      return true;
    } catch (error: any) {
      toast.error("Erro ao atualizar tarefa: " + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTodayFollowUps = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("on_hold", true)
      .lte("on_hold_deadline", today)
      .is("deleted_at", null);

    if (error) {
      console.error("Error fetching follow-ups:", error);
      return [];
    }
    return data || [];
  }, []);

  const getOnHoldTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("on_hold", true)
      .is("deleted_at", null);

    if (error) {
      console.error("Error fetching on-hold tasks:", error);
      return [];
    }
    return data || [];
  }, []);

  return {
    loading,
    toggleOnHold,
    getTodayFollowUps,
    getOnHoldTasks,
  };
};
