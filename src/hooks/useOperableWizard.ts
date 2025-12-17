import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";

export interface WizardStepConfig {
  id: string;
  step_key: string;
  label: string;
  module_route: string | null;
  order_index: number;
  is_active: boolean;
}

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

export interface WizardChanges {
  taskSchedules: Record<string, string>;
  taskStatuses: Record<string, string>;
}

const STORAGE_KEY = "pc.operable.wizard";

interface WizardState {
  isOpen: boolean;
  currentStepIndex: number;
  changes: WizardChanges;
  skippedSteps: number[];
  pendingSave: boolean;
  returnFromModule: boolean;
}

export const useOperableWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Step configuration from database
  const [steps, setSteps] = useState<WizardStepConfig[]>([]);
  const [stepsLoading, setStepsLoading] = useState(true);

  // Persistent wizard state
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
      currentStepIndex: 0,
      changes: { taskSchedules: {}, taskStatuses: {} },
      skippedSteps: [],
      pendingSave: false,
      returnFromModule: false,
    };
  });

  // Data
  const [tasks, setTasks] = useState<WizardTask[]>([]);
  const [loading, setLoading] = useState(false);

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Load wizard steps configuration
  useEffect(() => {
    const loadSteps = async () => {
      const { data } = await supabase
        .from("wizard_steps")
        .select("*")
        .eq("is_active", true)
        .order("order_index");

      if (data) {
        setSteps(data);
      }
      setStepsLoading(false);
    };
    loadSteps();
  }, []);

  // Check if returning from module with save
  useEffect(() => {
    if (state.returnFromModule && state.isOpen) {
      // Auto-advance to next step after returning from module
      const timer = setTimeout(() => {
        goToNext();
        setState((prev) => ({ ...prev, returnFromModule: false }));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state.returnFromModule, state.isOpen, location.pathname]);

  // Load task data
  const loadData = async () => {
    setLoading(true);
    const [tasksRes, nodesRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, status, node_id, progress, due_date, scheduled_date")
        .is("deleted_at", null)
        .in("status", ["estrutural", "andamento", "pendente"]),
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
    setLoading(false);
  };

  // Open wizard
  const open = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: true, currentStepIndex: 0 }));
    loadData();
  }, []);

  // Close wizard
  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Reset wizard
  const reset = useCallback(() => {
    setState({
      isOpen: false,
      currentStepIndex: 0,
      changes: { taskSchedules: {}, taskStatuses: {} },
      skippedSteps: [],
      pendingSave: false,
      returnFromModule: false,
    });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Get current step
  const currentStep = steps[state.currentStepIndex] || null;
  const isFirstStep = state.currentStepIndex === 0;
  const isLastStep = state.currentStepIndex >= steps.length - 1;

  // Navigate to module for editing
  const openModuleForEdit = useCallback(() => {
    if (!currentStep?.module_route) return;

    // Mark that we're going to module
    setState((prev) => ({ ...prev, pendingSave: true }));

    // Navigate to the module
    navigate(currentStep.module_route);
  }, [currentStep, navigate]);

  // Called when returning from module after save
  const markModuleSaved = useCallback(() => {
    setState((prev) => ({
      ...prev,
      pendingSave: false,
      returnFromModule: true,
    }));
  }, []);

  // Navigation
  const goToNext = useCallback(() => {
    if (!isLastStep) {
      setState((prev) => ({
        ...prev,
        currentStepIndex: prev.currentStepIndex + 1,
      }));
    }
  }, [isLastStep]);

  const goToPrevious = useCallback(() => {
    if (!isFirstStep) {
      setState((prev) => ({
        ...prev,
        currentStepIndex: prev.currentStepIndex - 1,
      }));
    }
  }, [isFirstStep]);

  const skipStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      skippedSteps: [...prev.skippedSteps, prev.currentStepIndex],
    }));
    goToNext();
  }, [goToNext]);

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) {
      setState((prev) => ({ ...prev, currentStepIndex: index }));
    }
  }, [steps.length]);

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

    for (const [taskId, date] of Object.entries(taskSchedules)) {
      await supabase.from("tasks").update({ scheduled_date: date }).eq("id", taskId);
    }

    for (const [taskId, status] of Object.entries(taskStatuses)) {
      await supabase.from("tasks").update({ status }).eq("id", taskId);
    }

    localStorage.setItem("pc.plan.lastCompletedAt", Date.now().toString());
    reset();
    return true;
  };

  // Summary
  const changeSummary = {
    scheduledCount: Object.keys(state.changes.taskSchedules).length,
    statusChangedCount: Object.keys(state.changes.taskStatuses).length,
    skippedStepsCount: state.skippedSteps.length,
  };

  return {
    // State
    isOpen: state.isOpen,
    currentStep,
    currentStepIndex: state.currentStepIndex,
    totalSteps: steps.length,
    steps,
    changes: state.changes,
    skippedSteps: state.skippedSteps,
    pendingSave: state.pendingSave,
    loading: loading || stepsLoading,

    // Data
    tasks,

    // Navigation
    open,
    close,
    reset,
    goToNext,
    goToPrevious,
    skipStep,
    goToStep,
    isFirstStep,
    isLastStep,

    // Module interaction
    openModuleForEdit,
    markModuleSaved,

    // Actions
    scheduleTask,
    updateTaskStatus,
    applyChanges,

    // Summary
    changeSummary,
  };
};
