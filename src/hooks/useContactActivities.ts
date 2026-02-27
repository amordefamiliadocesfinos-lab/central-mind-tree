import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ContactActivity {
  id: string;
  contact_id: string;
  activity_type: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  is_completed: boolean;
  created_at: string;
}

export function useContactActivities() {
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = useCallback(async (contactId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contact_activities')
      .select('*')
      .eq('contact_id', contactId)
      .order('is_completed')
      .order('due_date', { ascending: true, nullsFirst: false });
    if (!error) setActivities((data || []) as unknown as ContactActivity[]);
    setLoading(false);
  }, []);

  const createActivity = useCallback(async (activity: Partial<ContactActivity>) => {
    const { error } = await supabase.from('contact_activities').insert({
      contact_id: activity.contact_id!,
      activity_type: activity.activity_type || 'follow_up',
      title: activity.title!,
      description: activity.description || null,
      due_date: activity.due_date || null,
    });
    if (error) { toast.error('Erro ao criar atividade'); return; }
    toast.success('Atividade criada');
    if (activity.contact_id) await fetchActivities(activity.contact_id);
  }, [fetchActivities]);

  const toggleComplete = useCallback(async (id: string, contactId: string) => {
    const activity = activities.find(a => a.id === id);
    if (!activity) return;
    await supabase.from('contact_activities').update({
      is_completed: !activity.is_completed,
      completed_at: !activity.is_completed ? new Date().toISOString() : null,
    }).eq('id', id);
    await fetchActivities(contactId);
  }, [activities, fetchActivities]);

  const deleteActivity = useCallback(async (id: string, contactId: string) => {
    await supabase.from('contact_activities').delete().eq('id', id);
    await fetchActivities(contactId);
  }, [fetchActivities]);

  return { activities, loading, fetchActivities, createActivity, toggleComplete, deleteActivity };
}
