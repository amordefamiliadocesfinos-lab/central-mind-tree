import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TimeEntry {
  id: string;
  task_id: string;
  node_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  entry_type: string;
  notes: string | null;
  created_at: string;
}

export interface TimeStats {
  totalSeconds: number;
  byTask: Record<string, number>;
  byNode: Record<string, number>;
  byDay: Record<string, number>;
  byWeek: Record<string, number>;
  byMonth: Record<string, number>;
}

export function useTimeTracking() {
  const [loading, setLoading] = useState(false);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);

  // Fetch active (unfinished) time entry on mount
  const refreshActiveTimer = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching active timer:', error);
        setActiveEntry(null);
      } else {
        setActiveEntry((data as TimeEntry) ?? null);
      }
      return (data as TimeEntry) ?? null;
    } catch (error) {
      console.error('Error fetching active timer:', error);
      setActiveEntry(null);
      return null;
    }
  }, []);

  // Start time tracking for a task
  const startTracking = useCallback(async (taskId: string, nodeId?: string, entryType: string = 'work') => {
    setLoading(true);
    try {
      // Stop any globally active entry (different task) before starting new one
      if (activeEntry && activeEntry.task_id !== taskId) {
        await stopTracking(activeEntry.task_id);
      }
      // Also stop any active entry for this specific task
      await stopTracking(taskId);

      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          task_id: taskId,
          node_id: nodeId || null,
          started_at: new Date().toISOString(),
          entry_type: entryType,
        })
        .select()
        .single();

      if (error) throw error;

      // Update task with active time entry
      await supabase
        .from('tasks')
        .update({ active_time_entry_id: data.id })
        .eq('id', taskId);

      setActiveEntry(data);
      return data;
    } catch (error) {
      console.error('Error starting time tracking:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Stop time tracking for a task
  const stopTracking = useCallback(async (taskId: string) => {
    setLoading(true);
    try {
      // Find active entry
      const { data: entries, error: fetchError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('task_id', taskId)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;
      if (!entries || entries.length === 0) return null;

      const entry = entries[0];
      const endedAt = new Date();
      const startedAt = new Date(entry.started_at);
      const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

      const { data, error } = await supabase
        .from('time_entries')
        .update({
          ended_at: endedAt.toISOString(),
          duration_seconds: durationSeconds,
        })
        .eq('id', entry.id)
        .select()
        .single();

      if (error) throw error;

      // Clear active time entry from task
      await supabase
        .from('tasks')
        .update({ active_time_entry_id: null })
        .eq('id', taskId);

      setActiveEntry(null);
      return data;
    } catch (error) {
      console.error('Error stopping time tracking:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get active entry for a task
  const getActiveEntry = useCallback(async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('task_id', taskId)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Error getting active entry:', error);
      return null;
    }
  }, []);

  // Get time entries for a task
  const getTaskEntries = useCallback(async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('task_id', taskId)
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting task entries:', error);
      return [];
    }
  }, []);

  // Get time statistics
  const getTimeStats = useCallback(async (startDate?: Date, endDate?: Date): Promise<TimeStats> => {
    try {
      let query = supabase
        .from('time_entries')
        .select('*')
        .not('duration_seconds', 'is', null);

      if (startDate) {
        query = query.gte('started_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('started_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const stats: TimeStats = {
        totalSeconds: 0,
        byTask: {},
        byNode: {},
        byDay: {},
        byWeek: {},
        byMonth: {},
      };

      (data || []).forEach((entry: TimeEntry) => {
        const seconds = entry.duration_seconds || 0;
        stats.totalSeconds += seconds;

        // By task
        stats.byTask[entry.task_id] = (stats.byTask[entry.task_id] || 0) + seconds;

        // By node
        if (entry.node_id) {
          stats.byNode[entry.node_id] = (stats.byNode[entry.node_id] || 0) + seconds;
        }

        // By day
        const day = entry.started_at.split('T')[0];
        stats.byDay[day] = (stats.byDay[day] || 0) + seconds;

        // By week (ISO week)
        const date = new Date(entry.started_at);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        stats.byWeek[weekKey] = (stats.byWeek[weekKey] || 0) + seconds;

        // By month
        const monthKey = entry.started_at.substring(0, 7);
        stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + seconds;
      });

      return stats;
    } catch (error) {
      console.error('Error getting time stats:', error);
      return {
        totalSeconds: 0,
        byTask: {},
        byNode: {},
        byDay: {},
        byWeek: {},
        byMonth: {},
      };
    }
  }, []);

  // Get total time for a specific task
  const getTaskTotalTime = useCallback(async (taskId: string): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('duration_seconds')
        .eq('task_id', taskId)
        .not('duration_seconds', 'is', null);

      if (error) throw error;

      return (data || []).reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0);
    } catch (error) {
      console.error('Error getting task total time:', error);
      return 0;
    }
  }, []);

  // Format seconds to human-readable string
  const formatDuration = useCallback((seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      return `${mins}min`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }, []);

  return {
    loading,
    activeEntry,
    startTracking,
    stopTracking,
    getActiveEntry,
    getTaskEntries,
    getTimeStats,
    getTaskTotalTime,
    formatDuration,
    refreshActiveTimer,
  };
}
