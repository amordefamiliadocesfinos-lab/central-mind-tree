import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

/**
 * Hook that checks on app load if any tasks have scheduled_date equal to today
 * and promotes them to "andamento" status automatically.
 */
export function useScheduledTaskPromotion() {
  const hasChecked = useRef(false);

  useEffect(() => {
    // Only run once per app session
    if (hasChecked.current) return;
    hasChecked.current = true;

    const checkAndPromoteScheduledTasks = async () => {
      const todayISO = format(new Date(), "yyyy-MM-dd");

      // Fetch tasks that are scheduled for today and NOT already in "andamento"
      const { data: tasksToPromote, error } = await supabase
        .from("tasks")
        .select("id, title, status, scheduled_date")
        .eq("scheduled_date", todayISO)
        .neq("status", "andamento")
        .neq("status", "concluído");

      if (error) {
        console.error("Error checking scheduled tasks:", error);
        return;
      }

      if (!tasksToPromote || tasksToPromote.length === 0) {
        return;
      }

      // Update all matching tasks to "andamento"
      const taskIds = tasksToPromote.map((t) => t.id);
      
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ status: "andamento" })
        .in("id", taskIds);

      if (updateError) {
        console.error("Error promoting scheduled tasks:", updateError);
        return;
      }

      console.log(`Promoted ${taskIds.length} scheduled task(s) to "andamento"`);
    };

    checkAndPromoteScheduledTasks();
  }, []);
}
