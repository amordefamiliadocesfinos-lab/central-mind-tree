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

export interface SheetTab {
  id: string;
  sheet_id: string;
  title: string;
  order_index: number;
  frozen_rows: number;
  frozen_cols: number;
  col_widths: Record<number, number>;
  row_heights: Record<number, number>;
  created_at: string;
  updated_at: string;
}

export interface SheetCell {
  id: string;
  sheet_id: string;
  tab_id: string | null;
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

interface UndoAction {
  type: 'cell_update';
  sheetId: string;
  tabId: string;
  changes: {
    row: number;
    col: number;
    before: { value: CellValue; formula?: string; format?: SheetCell['format'] };
    after: { value: CellValue; formula?: string; format?: SheetCell['format'] };
  }[];
  timestamp: number;
}

const UNDO_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Spreadsheet hook scoped to a single tab inside a sheet.
 * If `tabId` is omitted, falls back to legacy single-sheet behaviour.
 */
export function useSpreadsheet(sheetId?: string, tabId?: string) {
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

  // Fetch active tab metadata (for frozen rows/cols, col widths)
  const { data: tab } = useQuery({
    queryKey: ['sheet_tab', tabId],
    queryFn: async () => {
      if (!tabId) return null;
      const { data, error } = await supabase
        .from('sheet_tabs')
        .select('*')
        .eq('id', tabId)
        .single();
      if (error) throw error;
      return data as SheetTab;
    },
    enabled: !!tabId,
  });

  // Fetch cells for this tab (or fall back to whole sheet when tabId omitted)
  const { data: cells = [], isLoading: cellsLoading } = useQuery({
    queryKey: ['sheet_cells', sheetId, tabId],
    queryFn: async () => {
      if (!sheetId) return [];
      let query = supabase
        .from('sheet_cells')
        .select('*')
        .order('row_index')
        .order('col_index');

      if (tabId) {
        query = query.eq('tab_id', tabId);
      } else {
        query = query.eq('sheet_id', sheetId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SheetCell[];
    },
    enabled: !!sheetId,
  });

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

  const updateCellsMutation = useMutation({
    mutationFn: async (updates: CellUpdate[]) => {
      if (!sheetId) throw new Error('No sheet ID');

      const upsertData = updates.map((u) => ({
        sheet_id: sheetId,
        tab_id: tabId || null,
        row_index: u.row,
        col_index: u.col,
        value: u.formula ? null : String(u.value ?? ''),
        formula: u.formula || null,
        cell_type: u.cell_type || 'text',
        format: u.format || {},
      }));

      // When we have a tab, conflict target is (tab_id,row,col). Otherwise legacy (sheet,row,col).
      const onConflict = tabId
        ? 'tab_id,row_index,col_index'
        : 'sheet_id,row_index,col_index';

      const { error } = await supabase
        .from('sheet_cells')
        .upsert(upsertData, { onConflict });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheet_cells', sheetId, tabId] });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar célula');
      console.error(error);
    },
  });

  const updateCell = useCallback(
    async (update: CellUpdate) => {
      if (!sheetId) return;

      if (update.formula) {
        const cellMap = buildCellDataMap();
        const key = cellKey(update.row, update.col);
        if (hasCircularReference(key, update.formula, cellMap)) {
          toast.error('Referência circular detectada!');
          return;
        }
      }

      const existingCell = cells.find(
        (c) => c.row_index === update.row && c.col_index === update.col
      );

      const undoAction: UndoAction = {
        type: 'cell_update',
        sheetId,
        tabId: tabId || '',
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
    [sheetId, tabId, cells, buildCellDataMap, updateCellsMutation]
  );

  const updateCellsBatch = useCallback(
    async (updates: CellUpdate[]) => {
      if (!sheetId || updates.length === 0) return;

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
        tabId: tabId || '',
        changes,
        timestamp: Date.now(),
      };

      setUndoStack((prev) => [...prev, undoAction]);
      setRedoStack([]);

      await updateCellsMutation.mutateAsync(updates);
    },
    [sheetId, tabId, cells, updateCellsMutation]
  );

  const deleteCells = useCallback(
    async (positions: { row: number; col: number }[]) => {
      if (!sheetId || positions.length === 0) return;
      const updates: CellUpdate[] = positions.map((p) => {
        const existing = cells.find((c) => c.row_index === p.row && c.col_index === p.col);
        return { row: p.row, col: p.col, value: null, formula: undefined, format: existing?.format };
      });
      await updateCellsBatch(updates);
    },
    [sheetId, cells, updateCellsBatch]
  );

  // Update tab metadata when present, otherwise fall back to sheet metadata
  const updateSheetMeta = useCallback(
    async (patch: Partial<Pick<SheetTab, 'frozen_rows' | 'frozen_cols' | 'col_widths' | 'row_heights' | 'title'>>) => {
      if (tabId) {
        const { error } = await supabase.from('sheet_tabs').update(patch).eq('id', tabId);
        if (error) {
          toast.error('Erro ao atualizar aba');
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['sheet_tab', tabId] });
        queryClient.invalidateQueries({ queryKey: ['sheet_tabs', sheetId] });
        return;
      }
      if (!sheetId) return;
      const { error } = await supabase.from('sheets').update(patch).eq('id', sheetId);
      if (error) {
        toast.error('Erro ao atualizar planilha');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['sheet', sheetId] });
    },
    [sheetId, tabId, queryClient]
  );

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

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setUndoStack((prev) => prev.filter((a) => now - a.timestamp < UNDO_EXPIRY_MS));
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Effective layout meta: prefer tab values when a tab is active
  const effectiveSheet = (tab
    ? { ...sheet, frozen_rows: tab.frozen_rows, frozen_cols: tab.frozen_cols, col_widths: tab.col_widths, row_heights: tab.row_heights }
    : sheet) as Sheet | null;

  return {
    sheet: effectiveSheet,
    tab,
    cells,
    computedCells: computedCells(),
    isLoading: sheetLoading || cellsLoading,
    updateCell,
    updateCellsBatch,
    deleteCells,
    updateSheetMeta,
    undo,
    redo,
    canUndo: undoStack.filter((a) => Date.now() - a.timestamp < UNDO_EXPIRY_MS).length > 0,
    canRedo: redoStack.length > 0,
  };
}

// ─── Tabs hook ──────────────────────────────────────────────────────────────
export function useSheetTabs(sheetId?: string) {
  const queryClient = useQueryClient();

  const { data: tabs = [], isLoading } = useQuery({
    queryKey: ['sheet_tabs', sheetId],
    queryFn: async () => {
      if (!sheetId) return [];
      const { data, error } = await supabase
        .from('sheet_tabs')
        .select('*')
        .eq('sheet_id', sheetId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data as SheetTab[];
    },
    enabled: !!sheetId,
  });

  const createTab = useCallback(
    async (title?: string) => {
      if (!sheetId) throw new Error('No sheet ID');
      const nextOrder = tabs.length > 0 ? Math.max(...tabs.map((t) => t.order_index)) + 1 : 0;
      const newTitle = title?.trim() || `Planilha${tabs.length + 1}`;
      const { data, error } = await supabase
        .from('sheet_tabs')
        .insert({ sheet_id: sheetId, title: newTitle, order_index: nextOrder })
        .select()
        .single();
      if (error) {
        toast.error('Erro ao criar aba');
        throw error;
      }
      queryClient.invalidateQueries({ queryKey: ['sheet_tabs', sheetId] });
      toast.success('Aba criada');
      return data as SheetTab;
    },
    [sheetId, tabs, queryClient]
  );

  const renameTab = useCallback(
    async (tabId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const { error } = await supabase
        .from('sheet_tabs')
        .update({ title: trimmed })
        .eq('id', tabId);
      if (error) {
        toast.error('Erro ao renomear aba');
        throw error;
      }
      queryClient.invalidateQueries({ queryKey: ['sheet_tabs', sheetId] });
      queryClient.invalidateQueries({ queryKey: ['sheet_tab', tabId] });
    },
    [sheetId, queryClient]
  );

  const deleteTab = useCallback(
    async (tabId: string) => {
      if (tabs.length <= 1) {
        toast.error('A planilha precisa ter pelo menos uma aba');
        return;
      }
      const { error } = await supabase.from('sheet_tabs').delete().eq('id', tabId);
      if (error) {
        toast.error('Erro ao excluir aba');
        throw error;
      }
      queryClient.invalidateQueries({ queryKey: ['sheet_tabs', sheetId] });
      toast.success('Aba excluída');
    },
    [sheetId, tabs.length, queryClient]
  );

  const duplicateTab = useCallback(
    async (sourceTabId: string) => {
      if (!sheetId) throw new Error('No sheet ID');
      const source = tabs.find((t) => t.id === sourceTabId);
      if (!source) return;
      const nextOrder = Math.max(...tabs.map((t) => t.order_index)) + 1;
      const { data: newTab, error: insertErr } = await supabase
        .from('sheet_tabs')
        .insert({
          sheet_id: sheetId,
          title: `${source.title} (cópia)`,
          order_index: nextOrder,
          frozen_rows: source.frozen_rows,
          frozen_cols: source.frozen_cols,
          col_widths: source.col_widths,
          row_heights: source.row_heights,
        })
        .select()
        .single();
      if (insertErr || !newTab) {
        toast.error('Erro ao duplicar aba');
        return;
      }

      // Copy cells
      const { data: srcCells } = await supabase
        .from('sheet_cells')
        .select('*')
        .eq('tab_id', sourceTabId);

      if (srcCells && srcCells.length > 0) {
        const cloned = srcCells.map((c: any) => ({
          sheet_id: sheetId,
          tab_id: newTab.id,
          row_index: c.row_index,
          col_index: c.col_index,
          value: c.value,
          formula: c.formula,
          cell_type: c.cell_type,
          format: c.format,
        }));
        await supabase.from('sheet_cells').insert(cloned);
      }

      queryClient.invalidateQueries({ queryKey: ['sheet_tabs', sheetId] });
      toast.success('Aba duplicada');
      return newTab as SheetTab;
    },
    [sheetId, tabs, queryClient]
  );

  return { tabs, isLoading, createTab, renameTab, deleteTab, duplicateTab };
}

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
