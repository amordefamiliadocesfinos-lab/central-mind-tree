import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const UNDO_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'pc.undo.history';

export type ActionType = 'create' | 'update' | 'delete';
export type EntityType = 'task' | 'order' | 'product';

interface UndoAction {
  id: string;
  type: ActionType;
  entity: EntityType;
  entityId: string;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  timestamp: number;
}

interface UndoState {
  past: UndoAction[];
  future: UndoAction[];
}

const TABLE_MAP: Record<EntityType, 'tasks' | 'orders' | 'products'> = {
  task: 'tasks',
  order: 'orders',
  product: 'products',
};

function loadState(): UndoState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const state = JSON.parse(stored) as UndoState;
      const now = Date.now();
      // Filter out expired actions
      state.past = state.past.filter(a => now - a.timestamp < UNDO_EXPIRY_MS);
      state.future = state.future.filter(a => now - a.timestamp < UNDO_EXPIRY_MS);
      return state;
    }
  } catch (e) {
    console.error('Failed to load undo state:', e);
  }
  return { past: [], future: [] };
}

function saveState(state: UndoState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save undo state:', e);
  }
}

export function useUndoRedo() {
  const [state, setState] = useState<UndoState>(loadState);
  const { toast } = useToast();
  const cleanupRef = useRef<number | null>(null);

  // Cleanup expired actions periodically
  useEffect(() => {
    const cleanup = () => {
      setState(prev => {
        const now = Date.now();
        const newPast = prev.past.filter(a => now - a.timestamp < UNDO_EXPIRY_MS);
        const newFuture = prev.future.filter(a => now - a.timestamp < UNDO_EXPIRY_MS);
        if (newPast.length !== prev.past.length || newFuture.length !== prev.future.length) {
          const newState = { past: newPast, future: newFuture };
          saveState(newState);
          return newState;
        }
        return prev;
      });
    };

    cleanupRef.current = window.setInterval(cleanup, 30000); // Check every 30s
    return () => {
      if (cleanupRef.current) clearInterval(cleanupRef.current);
    };
  }, []);

  // Save state when it changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  const recordAction = useCallback((
    type: ActionType,
    entity: EntityType,
    entityId: string,
    previousData: Record<string, unknown> | null,
    newData: Record<string, unknown> | null
  ) => {
    const action: UndoAction = {
      id: crypto.randomUUID(),
      type,
      entity,
      entityId,
      previousData,
      newData,
      timestamp: Date.now(),
    };

    setState(prev => ({
      past: [...prev.past, action],
      future: [], // Clear redo stack on new action
    }));
  }, []);

  const undo = useCallback(async () => {
    if (state.past.length === 0) {
      toast({ title: 'Nada para desfazer' });
      return false;
    }

    const action = state.past[state.past.length - 1];
    const table = TABLE_MAP[action.entity];
    const now = Date.now();

    // Check if action is still valid
    if (now - action.timestamp >= UNDO_EXPIRY_MS) {
      toast({ variant: 'destructive', title: 'Ação expirada (limite de 5 min)' });
      setState(prev => ({
        past: prev.past.slice(0, -1),
        future: prev.future,
      }));
      return false;
    }

    try {
      switch (action.type) {
        case 'create':
          // Undo create = soft delete (set deleted_at)
          await (supabase.from(table) as any)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', action.entityId);
          break;
        case 'update':
          // Undo update = restore previous data
          if (action.previousData) {
            await (supabase.from(table) as any)
              .update(action.previousData)
              .eq('id', action.entityId);
          }
          break;
        case 'delete':
          // Undo delete = restore (clear deleted_at)
          if (action.previousData) {
            const { deleted_at, ...restData } = action.previousData;
            await (supabase.from(table) as any)
              .update({ ...restData, deleted_at: null })
              .eq('id', action.entityId);
          }
          break;
      }

      setState(prev => ({
        past: prev.past.slice(0, -1),
        future: [...prev.future, action],
      }));

      toast({ title: 'Ação desfeita' });
      return true;
    } catch (error) {
      console.error('Undo failed:', error);
      toast({ variant: 'destructive', title: 'Erro ao desfazer' });
      return false;
    }
  }, [state.past, toast]);

  const redo = useCallback(async () => {
    if (state.future.length === 0) {
      toast({ title: 'Nada para refazer' });
      return false;
    }

    const action = state.future[state.future.length - 1];
    const table = TABLE_MAP[action.entity];

    try {
      switch (action.type) {
        case 'create':
          // Redo create = restore (clear deleted_at)
          await (supabase.from(table) as any)
            .update({ deleted_at: null })
            .eq('id', action.entityId);
          break;
        case 'update':
          // Redo update = apply new data
          if (action.newData) {
            await (supabase.from(table) as any)
              .update(action.newData)
              .eq('id', action.entityId);
          }
          break;
        case 'delete':
          // Redo delete = soft delete again
          await (supabase.from(table) as any)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', action.entityId);
          break;
      }

      setState(prev => ({
        past: [...prev.past, action],
        future: prev.future.slice(0, -1),
      }));

      toast({ title: 'Ação refeita' });
      return true;
    } catch (error) {
      console.error('Redo failed:', error);
      toast({ variant: 'destructive', title: 'Erro ao refazer' });
      return false;
    }
  }, [state.future, toast]);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  return {
    recordAction,
    undo,
    redo,
    canUndo,
    canRedo,
    pastCount: state.past.length,
    futureCount: state.future.length,
  };
}
