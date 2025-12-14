import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, format, addDays, isAfter, isBefore, parseISO } from "date-fns";

export interface WizardTask {
  id: string;
  title: string;
  status: string;
  node_id: string;
  progress: number;
  due_date: string | null;
  scheduled_date: string | null;
  node_title?: string;
}

export interface WizardBlock {
  id: string;
  title: string;
  block_type: string;
  planned_start: string | null;
  planned_end: string | null;
  duration_minutes: number;
  status: string;
}

export interface WizardOrder {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  status: string;
  due_date: string | null;
}

export interface WizardChanges {
  taskSchedules: Record<string, string>; // taskId -> scheduled_date
  taskStatuses: Record<string, string>; // taskId -> new status
  blocksToAdd: Partial<WizardBlock>[];
  blocksToRemove: string[];
}

export type WizardStep = 
  | "priorities"
  | "overdue"
  | "calendar"
  | "production"
  | "blocks"
  | "alerts"
  | "summary";

const STEP_ORDER: WizardStep[] = [
  "priorities",
  "overdue", 
  "calendar",
  "production",
  "blocks",
  "alerts",
  "summary",
];

const STEP_LABELS: Record<WizardStep, string> = {
  priorities: "Revisar Prioridades",
  overdue: "Tarefas Atrasadas",
  calendar: "Distribuir na Semana",
  production: "Planejamento de Produção",
  blocks: "Blocos de Trabalho",
  alerts: "Alertas e Lembretes",
  summary: "Resumo Final",
};

const STORAGE_KEY = "pc.replanning.wizard";

interface WizardState {
  isOpen: boolean;
  currentStep: WizardStep;
  changes: WizardChanges;
  skippedSteps: WizardStep[];
}

export const useReplanningWizard = () => {
  // Persistent state
  const [state, setState] = useState<WizardState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      isOpen: false,
      currentStep: "priorities" as WizardStep,
      changes: {
        taskSchedules: {},
        taskStatuses: {},
        blocksToAdd: [],
        blocksToRemove: [],
      },
      skippedSteps: [],
    };
  });

  // Data state
  const [tasks, setTasks] = useState<WizardTask[]>([]);
  const [blocks, setBlocks] = useState<WizardBlock[]>([]);
  const [orders, setOrders] = useState<WizardOrder[]>([]);
  const [loading, setLoading] = useState(false);

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Load data when wizard opens
  useEffect(() => {
    if (state.isOpen) {
      loadData();
    }
  }, [state.isOpen]);

  const loadData = async () => {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    
    const [tasksRes, blocksRes, ordersRes, nodesRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, status, node_id, progress, due_date, scheduled_date")
        .in("status", ["estrutural", "andamento", "pendente"]),
      supabase
        .from("routine_blocks")
        .select("id, title, block_type, planned_start, planned_end, duration_minutes, status")
        .eq("date", today),
      supabase
        .from("orders")
        .select("id, order_number, customer_name, status, due_date")
        .neq("status", "concluido"),
      supabase.from("nodes").select("id, title"),
    ]);

    const nodesMap: Record<string, string> = {};
    if (nodesRes.data) {
      nodesRes.data.forEach((n) => {
        nodesMap[n.id] = n.title;
      });
    }

    if (tasksRes.data) {
      setTasks(
        tasksRes.data.map((t) => ({
          ...t,
          node_title: nodesMap[t.node_id],
        }))
      );
    }
    if (blocksRes.data) setBlocks(blocksRes.data);
    if (ordersRes.data) setOrders(ordersRes.data);
    
    setLoading(false);
  };

  // Derived data
  const priorityTasks = tasks
    .filter((t) => t.status === "estrutural" || t.status === "andamento")
    .sort((a, b) => {
      const order = { estrutural: 0, andamento: 1, pendente: 2 };
      return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
    });

  const overdueTasks = tasks.filter((t) => {
    if (!t.due_date) return false;
    return isBefore(parseISO(t.due_date), new Date()) && t.status !== "concluído";
  });

  const unscheduledTasks = tasks.filter((t) => !t.scheduled_date && t.status !== "concluído");

  const pendingOrders = orders.filter((o) => o.status === "pendente" || o.status === "producao");

  // Navigation
  const open = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: true }));
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isOpen: false,
      currentStep: "priorities",
      changes: {
        taskSchedules: {},
        taskStatuses: {},
        blocksToAdd: [],
        blocksToRemove: [],
      },
      skippedSteps: [],
    });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const currentStepIndex = STEP_ORDER.indexOf(state.currentStep);

  const goToNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEP_ORDER.length) {
      setState((prev) => ({ ...prev, currentStep: STEP_ORDER[nextIndex] }));
    }
  }, [currentStepIndex]);

  const goToPrevious = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setState((prev) => ({ ...prev, currentStep: STEP_ORDER[prevIndex] }));
    }
  }, [currentStepIndex]);

  const skipStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      skippedSteps: [...prev.skippedSteps, prev.currentStep],
    }));
    goToNext();
  }, [goToNext]);

  const goToStep = useCallback((step: WizardStep) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  // Change tracking
  const scheduleTask = useCallback((taskId: string, date: string) => {
    setState((prev) => ({
      ...prev,
      changes: {
        ...prev.changes,
        taskSchedules: { ...prev.changes.taskSchedules, [taskId]: date },
      },
    }));
  }, []);

  const updateTaskStatus = useCallback((taskId: string, status: string) => {
    setState((prev) => ({
      ...prev,
      changes: {
        ...prev.changes,
        taskStatuses: { ...prev.changes.taskStatuses, [taskId]: status },
      },
    }));
  }, []);

  // Apply all changes
  const applyChanges = async () => {
    const { taskSchedules, taskStatuses } = state.changes;

    // Update scheduled dates
    for (const [taskId, date] of Object.entries(taskSchedules)) {
      await supabase.from("tasks").update({ scheduled_date: date }).eq("id", taskId);
    }

    // Update statuses
    for (const [taskId, status] of Object.entries(taskStatuses)) {
      await supabase.from("tasks").update({ status }).eq("id", taskId);
    }

    // Mark planning as completed
    localStorage.setItem("pc.plan.lastCompletedAt", Date.now().toString());
    
    reset();
    return true;
  };

  // Summary of changes
  const changeSummary = {
    scheduledCount: Object.keys(state.changes.taskSchedules).length,
    statusChangedCount: Object.keys(state.changes.taskStatuses).length,
    skippedStepsCount: state.skippedSteps.length,
  };

  return {
    // State
    isOpen: state.isOpen,
    currentStep: state.currentStep,
    currentStepIndex,
    totalSteps: STEP_ORDER.length,
    stepLabel: STEP_LABELS[state.currentStep],
    changes: state.changes,
    skippedSteps: state.skippedSteps,
    loading,

    // Data
    tasks,
    priorityTasks,
    overdueTasks,
    unscheduledTasks,
    blocks,
    orders: pendingOrders,

    // Navigation
    open,
    close,
    reset,
    goToNext,
    goToPrevious,
    skipStep,
    goToStep,
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === STEP_ORDER.length - 1,

    // Actions
    scheduleTask,
    updateTaskStatus,
    applyChanges,

    // Summary
    changeSummary,
    STEP_ORDER,
    STEP_LABELS,
  };
};
