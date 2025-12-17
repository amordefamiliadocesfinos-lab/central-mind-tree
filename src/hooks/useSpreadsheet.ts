import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CellValue, CellData, cellKey, evaluateFormula, hasCircularReference } from '@/lib/formulaEngine';

export interface Sheet {
  id: string;
  title: string;
  task_id: string | null;
  node_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  frozen_rows: number;
  frozen_cols: number;
  col_widths: Record<number, number>;
  row_heights: Record<number, number>;
}

export interface SheetCell {
  id: string;
  sheet_id: string;
  row_index: number;
  col_index: number;
  value: string | null;
  formula: string | null;
  cell_type: 'text' | 'number' | 'currency' | 'percentage' | 'date' | 'boolean';
  format: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: 'left' | 'center' | 'right';
    bgColor?: string;
    textColor?: string;
  };
}

export interface CellUpdate {
  row: number;
  col: number;
  value?: CellValue;
  formula?: string;
  cell_type?: SheetCell['cell_type'];
  format?: SheetCell['format'];
}

// Undo/Redo action types
interface UndoAction {
  type: 'cell_update';
  sheetId: string;
  changes: {
    row: number;
    col: number;
    before: { value: CellValue; formula?: string; format?: SheetCell['format'] };
    after: { value: CellValue; formula?: string; format?: SheetCell['format'] };
  }[];
  timestamp: number;
}

const UNDO_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export function useSpreadsheet(sheetId?: string) {
  const queryClient = useQueryClient();
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);

  // Fetch sheet metadata
  const { data: sheet, isLoading: sheetLoading } = useQuery({
    queryKey: ['sheet', sheetId],
    queryFn: async () => {
      if (!sheetId) return null;
      const { data, error } = await supabase
        .from('sheets')
        .select('*')
        .eq('id', sheetId)
        .is('deleted_at', null)
        .single();
      if (error) throw error;
      return data as Sheet;
    },
    enabled: !!sheetId,
  });

  // Fetch cells
  const { data: cells = [], isLoading: cellsLoading } = useQuery({
    queryKey: ['sheet_cells', sheetId],
    queryFn: async () => {
      if (!sheetId) return [];
      const { data, error } = await supabase
        .from('sheet_cells')
        .select('*')
        .eq('sheet_id', sheetId)
        .order('row_index')
        .order('col_index');
      if (error) throw error;
      return data as SheetCell[];
    },
    enabled: !!sheetId,
  });

  // Build cell data map for formula evaluation
  const buildCellDataMap = useCallback((): CellData => {
    const map: CellData = new Map();
    for (const cell of cells) {
      const key = cellKey(cell.row_index, cell.col_index);
      map.set(key, {
        value: cell.formula ? null : (cell.value as CellValue),
        formula: cell.formula || undefined,
      });
    }
    return map;
  }, [cells]);

  // Calculate computed values (with formulas evaluated)
  const computedCells = useCallback(() => {
    const cellMap = buildCellDataMap();
    const result: Map<string, CellValue> = new Map();

    for (const cell of cells) {
      const key = cellKey(cell.row_index, cell.col_index);
      if (cell.formula) {
        const computed = evaluateFormula(cell.formula, cellMap);
        result.set(key, computed);
      } else {
        result.set(key, cell.value as CellValue);
      }
    }

    return result;
  }, [cells, buildCellDataMap]);

  // Update cells mutation
  const updateCellsMutation = useMutation({
    mutationFn: async (updates: CellUpdate[]) => {
      if (!sheetId) throw new Error('No sheet ID');

      // Prepare upsert data
      const upsertData = updates.map((u) => ({
        sheet_id: sheetId,
        row_index: u.row,
        col_index: u.col,
        value: u.formula ? null : String(u.value ?? ''),
        formula: u.formula || null,
        cell_type: u.cell_type || 'text',
        format: u.format || {},
      }));

      const { error } = await supabase
        .from('sheet_cells')
        .upsert(upsertData, { onConflict: 'sheet_id,row_index,col_index' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheet_cells', sheetId] });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar célula');
      console.error(error);
    },
  });

  // Update cell with undo support
  const updateCell = useCallback(
    async (update: CellUpdate) => {
      if (!sheetId) return;

      // Check for circular reference if formula
      if (update.formula) {
        const cellMap = buildCellDataMap();
        const key = cellKey(update.row, update.col);
        if (hasCircularReference(key, update.formula, cellMap)) {
          toast.error('Referência circular detectada!');
          return;
        }
      }

      // Find existing cell for undo
      const existingCell = cells.find(
        (c) => c.row_index === update.row && c.col_index === update.col
      );

      const undoAction: UndoAction = {
        type: 'cell_update',
        sheetId,
        changes: [
          {
            row: update.row,
            col: update.col,
            before: {
              value: existingCell?.value as CellValue ?? null,
              formula: existingCell?.formula || undefined,
              format: existingCell?.format,
            },
            after: {
              value: update.value ?? null,
              formula: update.formula,
              format: update.format,
            },
          },
        ],
        timestamp: Date.now(),
      };

      setUndoStack((prev) => [...prev, undoAction]);
      setRedoStack([]);

      await updateCellsMutation.mutateAsync([update]);
    },
    [sheetId, cells, buildCellDataMap, updateCellsMutation]
  );

  // Batch update cells
  const updateCellsBatch = useCallback(
    async (updates: CellUpdate[]) => {
      if (!sheetId || updates.length === 0) return;

      // Build undo action
      const changes = updates.map((update) => {
        const existingCell = cells.find(
          (c) => c.row_index === update.row && c.col_index === update.col
        );
        return {
          row: update.row,
          col: update.col,
          before: {
            value: existingCell?.value as CellValue ?? null,
            formula: existingCell?.formula || undefined,
            format: existingCell?.format,
          },
          after: {
            value: update.value ?? null,
            formula: update.formula,
            format: update.format,
          },
        };
      });

      const undoAction: UndoAction = {
        type: 'cell_update',
        sheetId,
        changes,
        timestamp: Date.now(),
      };

      setUndoStack((prev) => [...prev, undoAction]);
      setRedoStack([]);

      await updateCellsMutation.mutateAsync(updates);
    },
    [sheetId, cells, updateCellsMutation]
  );

  // Undo
  const undo = useCallback(async () => {
    const now = Date.now();
    const validActions = undoStack.filter((a) => now - a.timestamp < UNDO_EXPIRY_MS);
    
    if (validActions.length === 0) {
      toast.info('Nenhuma ação para desfazer');
      return;
    }

    const action = validActions[validActions.length - 1];
    const updates: CellUpdate[] = action.changes.map((c) => ({
      row: c.row,
      col: c.col,
      value: c.before.value,
      formula: c.before.formula,
      format: c.before.format,
    }));

    await updateCellsMutation.mutateAsync(updates);

    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, action]);
    toast.success('Desfeito');
  }, [undoStack, updateCellsMutation]);

  // Redo
  const redo = useCallback(async () => {
    if (redoStack.length === 0) {
      toast.info('Nenhuma ação para refazer');
      return;
    }

    const action = redoStack[redoStack.length - 1];
    const updates: CellUpdate[] = action.changes.map((c) => ({
      row: c.row,
      col: c.col,
      value: c.after.value,
      formula: c.after.formula,
      format: c.after.format,
    }));

    await updateCellsMutation.mutateAsync(updates);

    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, action]);
    toast.success('Refeito');
  }, [redoStack, updateCellsMutation]);

  // Clean up expired undo actions
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setUndoStack((prev) => prev.filter((a) => now - a.timestamp < UNDO_EXPIRY_MS));
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return {
    sheet,
    cells,
    computedCells: computedCells(),
    isLoading: sheetLoading || cellsLoading,
    updateCell,
    updateCellsBatch,
    undo,
    redo,
    canUndo: undoStack.filter((a) => Date.now() - a.timestamp < UNDO_EXPIRY_MS).length > 0,
    canRedo: redoStack.length > 0,
  };
}

// Hook for listing sheets
export function useSheets(options?: { taskId?: string; nodeId?: string }) {
  const queryClient = useQueryClient();

  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ['sheets', options?.taskId, options?.nodeId],
    queryFn: async () => {
      let query = supabase
        .from('sheets')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (options?.taskId) {
        query = query.eq('task_id', options.taskId);
      }
      if (options?.nodeId) {
        query = query.eq('node_id', options.nodeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Sheet[];
    },
  });

  // Create sheet
  const createSheet = useCallback(
    async (data: { title?: string; task_id?: string; node_id?: string }) => {
      const { data: newSheet, error } = await supabase
        .from('sheets')
        .insert({
          title: data.title || 'Nova Planilha',
          task_id: data.task_id || null,
          node_id: data.node_id || null,
        })
        .select()
        .single();

      if (error) {
        toast.error('Erro ao criar planilha');
        throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['sheets'] });
      toast.success('Planilha criada');
      return newSheet as Sheet;
    },
    [queryClient]
  );

  // Delete sheet (soft delete)
  const deleteSheet = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from('sheets')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        toast.error('Erro ao excluir planilha');
        throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['sheets'] });
      toast.success('Planilha excluída');
    },
    [queryClient]
  );

  // Update sheet metadata
  const updateSheet = useCallback(
    async (id: string, data: Partial<Sheet>) => {
      const { error } = await supabase
        .from('sheets')
        .update(data)
        .eq('id', id);

      if (error) {
        toast.error('Erro ao atualizar planilha');
        throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['sheets'] });
      queryClient.invalidateQueries({ queryKey: ['sheet', id] });
    },
    [queryClient]
  );

  // Link/unlink sheet to task or node
  const linkSheet = useCallback(
    async (sheetId: string, linkType: 'task' | 'node', linkId: string | null) => {
      const update = linkType === 'task' 
        ? { task_id: linkId } 
        : { node_id: linkId };

      const { error } = await supabase
        .from('sheets')
        .update(update)
        .eq('id', sheetId);

      if (error) {
        toast.error('Erro ao vincular planilha');
        throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['sheets'] });
      toast.success(linkId ? 'Planilha vinculada' : 'Vínculo removido');
    },
    [queryClient]
  );

  return {
    sheets,
    isLoading,
    createSheet,
    deleteSheet,
    updateSheet,
    linkSheet,
  };
}
