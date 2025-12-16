import { createContext, useContext, ReactNode } from 'react';
import { useUndoRedo, ActionType, EntityType } from '@/hooks/useUndoRedo';

interface UndoRedoContextValue {
  recordAction: (
    type: ActionType,
    entity: EntityType,
    entityId: string,
    previousData: Record<string, unknown> | null,
    newData: Record<string, unknown> | null
  ) => void;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  canUndo: boolean;
  canRedo: boolean;
  pastCount: number;
  futureCount: number;
}

const UndoRedoContext = createContext<UndoRedoContextValue | null>(null);

export function UndoRedoProvider({ children }: { children: ReactNode }) {
  const undoRedo = useUndoRedo();

  return (
    <UndoRedoContext.Provider value={undoRedo}>
      {children}
    </UndoRedoContext.Provider>
  );
}

export function useUndoRedoContext() {
  const context = useContext(UndoRedoContext);
  if (!context) {
    throw new Error('useUndoRedoContext must be used within UndoRedoProvider');
  }
  return context;
}
