import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationAlert {
  id: string;
  rule: AutomationRule;
  taskId: string;
  taskTitle: string;
  message: string;
  triggeredAt: Date;
}

interface Task {
  id: string;
  title: string;
  status: string;
  on_hold: boolean;
  on_hold_created_at: string | null;
  due_date: string | null;
  updated_at: string;
  node_id: string;
}

export function useAutomationRules() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [alerts, setAlerts] = useState<AutomationAlert[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all rules
  const fetchRules = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Cast the JSONB fields properly
      const typedRules = (data || []).map(rule => ({
        ...rule,
        trigger_config: rule.trigger_config as Record<string, unknown>,
        action_config: rule.action_config as Record<string, unknown>,
      }));

      setRules(typedRules);
      return typedRules;
    } catch (error) {
      console.error('Error fetching rules:', error);
      return [];
    }
  }, []);

  // Check rules against current tasks
  const checkRules = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesData, tasksResult] = await Promise.all([
        fetchRules(),
        supabase
          .from('tasks')
          .select('*')
          .is('deleted_at', null),
      ]);

      if (tasksResult.error) throw tasksResult.error;

      const tasks = tasksResult.data as Task[];
      const activeRules = rulesData.filter(r => r.is_active);
      const newAlerts: AutomationAlert[] = [];
      const now = new Date();

      for (const rule of activeRules) {
        for (const task of tasks) {
          let shouldTrigger = false;
          let message = (rule.action_config.message as string) || 'Ação automática acionada';

          switch (rule.trigger_type) {
            case 'on_hold_days': {
              if (task.on_hold && task.on_hold_created_at) {
                const onHoldDate = new Date(task.on_hold_created_at);
                const daysDiff = Math.floor((now.getTime() - onHoldDate.getTime()) / (1000 * 60 * 60 * 24));
                const threshold = (rule.trigger_config.days as number) || 3;
                shouldTrigger = daysDiff >= threshold;
              }
              break;
            }

            case 'due_date_approaching': {
              if (task.due_date && task.status !== 'concluida') {
                const dueDate = new Date(task.due_date);
                const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const threshold = (rule.trigger_config.days_before as number) || 1;
                shouldTrigger = daysDiff >= 0 && daysDiff <= threshold;
              }
              break;
            }

            case 'stale_task': {
              if (task.status === 'andamento') {
                const updatedAt = new Date(task.updated_at);
                const daysDiff = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
                const threshold = (rule.trigger_config.days as number) || 2;
                shouldTrigger = daysDiff >= threshold;
              }
              break;
            }
          }

          if (shouldTrigger) {
            newAlerts.push({
              id: `${rule.id}-${task.id}`,
              rule,
              taskId: task.id,
              taskTitle: task.title,
              message,
              triggeredAt: now,
            });
          }
        }
      }

      setAlerts(newAlerts);
      return newAlerts;
    } catch (error) {
      console.error('Error checking rules:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [fetchRules]);

  // Create a new rule
  const createRule = useCallback(async (rule: {
    name: string;
    description?: string | null;
    trigger_type: string;
    trigger_config: Record<string, unknown>;
    action_type: string;
    action_config: Record<string, unknown>;
    is_active: boolean;
  }) => {
    try {
      const { data, error } = await supabase
        .from('automation_rules')
        .insert({
          name: rule.name,
          description: rule.description,
          trigger_type: rule.trigger_type,
          trigger_config: rule.trigger_config as unknown as Record<string, never>,
          action_type: rule.action_type,
          action_config: rule.action_config as unknown as Record<string, never>,
          is_active: rule.is_active,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchRules();
      return data;
    } catch (error) {
      console.error('Error creating rule:', error);
      return null;
    }
  }, [fetchRules]);

  // Update a rule
  const updateRule = useCallback(async (id: string, updates: { is_active?: boolean; name?: string }) => {
    try {
      const { data, error } = await supabase
        .from('automation_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await fetchRules();
      return data;
    } catch (error) {
      console.error('Error updating rule:', error);
      return null;
    }
  }, [fetchRules]);

  // Delete a rule
  const deleteRule = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchRules();
      return true;
    } catch (error) {
      console.error('Error deleting rule:', error);
      return false;
    }
  }, [fetchRules]);

  // Toggle rule active state
  const toggleRule = useCallback(async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return false;

    return updateRule(id, { is_active: !rule.is_active });
  }, [rules, updateRule]);

  // Dismiss an alert
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  // Dismiss all alerts
  const dismissAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Load rules on mount
  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  return {
    rules,
    alerts,
    loading,
    fetchRules,
    checkRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    dismissAlert,
    dismissAllAlerts,
  };
}
