import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CalendarEvent {
  date: string;
  type: 'task' | 'post' | 'order' | 'block' | 'digital';
  entityId: string;
  title: string;
  status?: string;
  platform?: string;
  time?: string;
}

// This hook auto-syncs dates from tasks, posts, orders, routine blocks and digital variations
// to provide a unified calendar view
export function useCalendarService() {
  const fetchAllEvents = useCallback(async (year: number): Promise<CalendarEvent[]> => {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    const [tasksRes, postsRes, ordersRes, blocksRes, digitalRes] = await Promise.all([
      // Tasks with scheduled_date or due_date
      supabase
        .from('tasks')
        .select('id, title, scheduled_date, due_date, status')
        .or(`scheduled_date.gte.${startDate},due_date.gte.${startDate}`)
        .or(`scheduled_date.lte.${endDate},due_date.lte.${endDate}`),
      
      // Posts with scheduled_date
      supabase
        .from('posts')
        .select('id, title, scheduled_date, status')
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate),
      
      // Orders with due_date
      supabase
        .from('orders')
        .select('id, order_number, customer_name, due_date, status')
        .gte('due_date', startDate)
        .lte('due_date', endDate),
      
      // Routine blocks
      supabase
        .from('routine_blocks')
        .select('id, title, date, status')
        .eq('is_active', true)
        .gte('date', startDate)
        .lte('date', endDate),
      
      // Digital variations with scheduled_date
      supabase
        .from('digital_variations')
        .select('id, title, platform, scheduled_date, scheduled_time, status, idea_id, digital_ideas!inner(title)')
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate),
    ]);

    const events: CalendarEvent[] = [];

    // Process tasks
    if (tasksRes.data) {
      for (const task of tasksRes.data) {
        if (task.scheduled_date) {
          events.push({
            date: task.scheduled_date,
            type: 'task',
            entityId: task.id,
            title: task.title,
            status: task.status,
          });
        }
        if (task.due_date && task.due_date !== task.scheduled_date) {
          events.push({
            date: task.due_date,
            type: 'task',
            entityId: task.id,
            title: `[Prazo] ${task.title}`,
            status: task.status,
          });
        }
      }
    }

    // Process posts
    if (postsRes.data) {
      for (const post of postsRes.data) {
        if (post.scheduled_date) {
          events.push({
            date: post.scheduled_date,
            type: 'post',
            entityId: post.id,
            title: post.title,
            status: post.status,
          });
        }
      }
    }

    // Process orders
    if (ordersRes.data) {
      for (const order of ordersRes.data) {
        if (order.due_date) {
          events.push({
            date: order.due_date,
            type: 'order',
            entityId: order.id,
            title: `Pedido ${order.order_number || order.customer_name || order.id.slice(0, 8)}`,
            status: order.status,
          });
        }
      }
    }

    // Process routine blocks
    if (blocksRes.data) {
      for (const block of blocksRes.data) {
        events.push({
          date: block.date,
          type: 'block',
          entityId: block.id,
          title: block.title,
          status: block.status,
        });
      }
    }

    // Process digital variations
    if (digitalRes.data) {
      for (const variation of digitalRes.data) {
        if (variation.scheduled_date) {
          const ideaTitle = (variation as any).digital_ideas?.title || 'Conteúdo';
          events.push({
            date: variation.scheduled_date,
            type: 'digital',
            entityId: variation.id,
            title: variation.title || ideaTitle,
            status: variation.status,
            platform: variation.platform,
            time: variation.scheduled_time || undefined,
          });
        }
      }
    }

    return events;
  }, []);

  const getEventsForDate = useCallback(async (date: string): Promise<CalendarEvent[]> => {
    const [tasksRes, postsRes, ordersRes, blocksRes, digitalRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, title, scheduled_date, due_date, status')
        .or(`scheduled_date.eq.${date},due_date.eq.${date}`),
      
      supabase
        .from('posts')
        .select('id, title, scheduled_date, status')
        .eq('scheduled_date', date),
      
      supabase
        .from('orders')
        .select('id, order_number, customer_name, due_date, status')
        .eq('due_date', date),
      
      supabase
        .from('routine_blocks')
        .select('id, title, date, status')
        .eq('date', date),
      
      supabase
        .from('digital_variations')
        .select('id, title, platform, scheduled_date, scheduled_time, status, idea_id, digital_ideas!inner(title)')
        .eq('scheduled_date', date),
    ]);

    const events: CalendarEvent[] = [];

    if (tasksRes.data) {
      for (const task of tasksRes.data) {
        if (task.scheduled_date === date) {
          events.push({
            date,
            type: 'task',
            entityId: task.id,
            title: task.title,
            status: task.status,
          });
        }
        if (task.due_date === date && task.due_date !== task.scheduled_date) {
          events.push({
            date,
            type: 'task',
            entityId: task.id,
            title: `[Prazo] ${task.title}`,
            status: task.status,
          });
        }
      }
    }

    if (postsRes.data) {
      for (const post of postsRes.data) {
        events.push({
          date,
          type: 'post',
          entityId: post.id,
          title: post.title,
          status: post.status,
        });
      }
    }

    if (ordersRes.data) {
      for (const order of ordersRes.data) {
        events.push({
          date,
          type: 'order',
          entityId: order.id,
          title: `Pedido ${order.order_number || order.customer_name || order.id.slice(0, 8)}`,
          status: order.status,
        });
      }
    }

    if (blocksRes.data) {
      for (const block of blocksRes.data) {
        events.push({
          date,
          type: 'block',
          entityId: block.id,
          title: block.title,
          status: block.status,
        });
      }
    }

    if (digitalRes.data) {
      for (const variation of digitalRes.data) {
        const ideaTitle = (variation as any).digital_ideas?.title || 'Conteúdo';
        events.push({
          date,
          type: 'digital',
          entityId: variation.id,
          title: variation.title || ideaTitle,
          status: variation.status,
          platform: variation.platform,
          time: variation.scheduled_time || undefined,
        });
      }
    }

    return events;
  }, []);

  return {
    fetchAllEvents,
    getEventsForDate,
  };
}

export type { CalendarEvent };
