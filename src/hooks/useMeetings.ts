import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AppUser {
  id: string;
  name: string;
  role: string | null;
  email?: string | null;
  is_active?: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  objective: string | null;
  meeting_date: string;
  start_time: string;
  duration_minutes: number;
  location: string | null;
  status: string;
  owner_id: string | null;
  notes: string | null;
  decisions: string | null;
  created_at: string;
  updated_at: string;
  owner?: AppUser;
  participants?: MeetingParticipant[];
  items?: MeetingItem[];
}

export interface MeetingParticipant {
  id: string;
  meeting_id?: string;
  user_id: string;
  role: string;
  confirmed: boolean;
  user?: AppUser;
}

export interface MeetingItem {
  id: string;
  meeting_id: string;
  title: string;
  description: string | null;
  item_type: string;
  owner_id: string | null;
  duration_minutes: number;
  order_index: number;
  status: string;
  notes: string | null;
  task_id: string | null;
  created_at: string;
  owner?: AppUser;
}

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeUserId, setActiveUserId] = useState<string | null>(() => {
    return localStorage.getItem('pc.activeUserId') || null;
  });

  // Persist active user
  useEffect(() => {
    if (activeUserId) {
      localStorage.setItem('pc.activeUserId', activeUserId);
    }
  }, [activeUserId]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }

    setUsers(data || []);
    
    // Set first user as active if none selected
    if (!activeUserId && data && data.length > 0) {
      setActiveUserId(data[0].id);
    }
    
    return data || [];
  }, [activeUserId]);

  // Fetch meetings
  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          *,
          owner:app_users!meetings_owner_id_fkey(id, name, role),
          participants:meeting_participants(
            id, user_id, role, confirmed,
            user:app_users(id, name, role)
          )
        `)
        .order('meeting_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get meeting with items
  const getMeeting = useCallback(async (id: string): Promise<Meeting | null> => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          *,
          owner:app_users!meetings_owner_id_fkey(id, name, role),
          participants:meeting_participants(
            id, user_id, role, confirmed,
            user:app_users(id, name, role)
          ),
          items:meeting_items(
            *,
            owner:app_users(id, name, role)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Sort items by order_index
      if (data?.items) {
        data.items.sort((a: MeetingItem, b: MeetingItem) => a.order_index - b.order_index);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching meeting:', error);
      return null;
    }
  }, []);

  // Create meeting
  const createMeeting = useCallback(async (meeting: {
    title: string;
    objective?: string;
    meeting_date: string;
    start_time: string;
    duration_minutes: number;
    location?: string;
    owner_id?: string;
    participant_ids?: string[];
  }) => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .insert({
          title: meeting.title,
          objective: meeting.objective,
          meeting_date: meeting.meeting_date,
          start_time: meeting.start_time,
          duration_minutes: meeting.duration_minutes,
          location: meeting.location,
          owner_id: meeting.owner_id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add participants
      if (meeting.participant_ids && meeting.participant_ids.length > 0) {
        const participants = meeting.participant_ids.map(userId => ({
          meeting_id: data.id,
          user_id: userId,
          role: userId === meeting.owner_id ? 'responsavel' : 'participante',
        }));

        await supabase.from('meeting_participants').insert(participants);
      }

      // Create default agenda items
      const defaultItems = [
        { title: 'Abertura', item_type: 'estrutura', order_index: 0, duration_minutes: 5 },
        { title: 'Alinhamento de expectativas', item_type: 'estrutura', order_index: 1, duration_minutes: 5 },
        { title: 'Encerramento', item_type: 'estrutura', order_index: 99, duration_minutes: 5 },
      ];

      await supabase.from('meeting_items').insert(
        defaultItems.map(item => ({ ...item, meeting_id: data.id }))
      );

      await fetchMeetings();
      return data;
    } catch (error) {
      console.error('Error creating meeting:', error);
      return null;
    }
  }, [fetchMeetings]);

  // Update meeting
  const updateMeeting = useCallback(async (id: string, updates: Partial<Meeting>) => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchMeetings();
      return data;
    } catch (error) {
      console.error('Error updating meeting:', error);
      return null;
    }
  }, [fetchMeetings]);

  // Delete meeting
  const deleteMeeting = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchMeetings();
      return true;
    } catch (error) {
      console.error('Error deleting meeting:', error);
      return false;
    }
  }, [fetchMeetings]);

  // Add meeting item
  const addMeetingItem = useCallback(async (item: {
    meeting_id: string;
    title: string;
    description?: string;
    item_type: string;
    owner_id?: string;
    duration_minutes?: number;
    order_index?: number;
  }) => {
    try {
      // Get max order_index for non-estrutura items
      const { data: existingItems } = await supabase
        .from('meeting_items')
        .select('order_index')
        .eq('meeting_id', item.meeting_id)
        .lt('order_index', 99)
        .order('order_index', { ascending: false })
        .limit(1);

      const nextIndex = existingItems && existingItems.length > 0 
        ? existingItems[0].order_index + 1 
        : 10;

      const { data, error } = await supabase
        .from('meeting_items')
        .insert({
          ...item,
          order_index: item.order_index ?? nextIndex,
          duration_minutes: item.duration_minutes ?? 5,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding meeting item:', error);
      return null;
    }
  }, []);

  // Update meeting item
  const updateMeetingItem = useCallback(async (id: string, updates: Partial<MeetingItem>) => {
    try {
      const { data, error } = await supabase
        .from('meeting_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating meeting item:', error);
      return null;
    }
  }, []);

  // Delete meeting item
  const deleteMeetingItem = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('meeting_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting meeting item:', error);
      return false;
    }
  }, []);

  // Create action (task) from meeting item
  const createActionFromItem = useCallback(async (item: MeetingItem, nodeId: string) => {
    try {
      // Create task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: item.title,
          description: item.description || item.notes,
          node_id: nodeId,
          status: 'pendente',
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Update item with task reference
      await supabase
        .from('meeting_items')
        .update({ task_id: task.id, item_type: 'acao' })
        .eq('id', item.id);

      return task;
    } catch (error) {
      console.error('Error creating action:', error);
      return null;
    }
  }, []);

  // Get meetings for user
  const getMyMeetings = useCallback((userId: string) => {
    return meetings.filter(m => 
      m.owner_id === userId || 
      m.participants?.some(p => p.user_id === userId)
    );
  }, [meetings]);

  // Get stats
  const getStats = useCallback(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const next7Days = new Date(today);
    next7Days.setDate(today.getDate() + 7);

    const thisWeek = meetings.filter(m => {
      const d = new Date(m.meeting_date);
      return d >= startOfWeek && d <= endOfWeek;
    });

    const upcoming = meetings.filter(m => {
      const d = new Date(m.meeting_date);
      return d >= today && d <= next7Days;
    });

    return {
      thisWeek: thisWeek.length,
      upcoming: upcoming.length,
      total: meetings.length,
    };
  }, [meetings]);

  // Load initial data
  useEffect(() => {
    fetchUsers();
    fetchMeetings();
  }, [fetchUsers, fetchMeetings]);

  return {
    meetings,
    users,
    loading,
    activeUserId,
    setActiveUserId,
    fetchMeetings,
    fetchUsers,
    getMeeting,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    addMeetingItem,
    updateMeetingItem,
    deleteMeetingItem,
    createActionFromItem,
    getMyMeetings,
    getStats,
  };
}
