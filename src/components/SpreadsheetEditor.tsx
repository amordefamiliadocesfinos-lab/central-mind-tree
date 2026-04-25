import React, { useState, useCallback, useEffect, useRef, useMemo, KeyboardEvent } from 'react';
import { useSpreadsheet, useSheetTabs, CellUpdate, SheetCell } from '@/hooks/useSpreadsheet';
import { SheetTabsBar } from '@/components/SheetTabsBar';
import {
  cellKey,
  colIndexToLetter,
  CellValue,
  translateFormula,
  SUPPORTED_FUNCTIONS,
} from '@/lib/formulaEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Undo2, Redo2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Download, Upload, DollarSign, Percent, Hash, Type, Palette, Paintbrush,
  Plus, Minus, Snowflake, Trash2, Copy, Scissors, ClipboardPaste,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface SpreadsheetEditorProps {
  sheetId: string;
  readOnly?: boolean;
}

const DEFAULT_ROWS = 100;
const DEFAULT_COLS = 26;
const DEFAULT_COL_WIDTH = 96;
const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 28;
const ROW_HEADER_WIDTH = 48;

const COLOR_PALETTE = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
];

interface Selection {
  startRow: number; startCol: number;
  endRow: number; endCol: number;
}

function normalizeSel(s: Selection): Selection {
  return {
    startRow: Math.min(s.startRow, s.endRow),
    endRow: Math.max(s.startRow, s.endRow),
    startCol: Math.min(s.startCol, s.endCol),
    endCol: Math.max(s.startCol, s.endCol),
  };
}

function inSelection(row: number, col: number, sel: Selection | null): boolean {
  if (!sel) return false;
  const n = normalizeSel(sel);
  return row >= n.startRow && row <= n.endRow && col >= n.startCol && col <= n.endCol;
}

export function SpreadsheetEditor({ sheetId, readOnly = false }: SpreadsheetEditorProps) {
  const {
    sheet, cells, computedCells, isLoading,
    updateCell, updateCellsBatch, deleteCells, updateSheetMeta,
    undo, redo, canUndo, canRedo,
  } = useSpreadsheet(sheetId);

  const [activeCell, setActiveCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [fillEnd, setFillEnd] = useState<{ row: number; col: number } | null>(null);
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIdx, setSuggestionIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Sync col widths from sheet
  useEffect(() => {
    if (sheet?.col_widths) setColWidths(sheet.col_widths as Record<number, number>);
  }, [sheet?.col_widths]);

  const getColWidth = (col: number) => colWidths[col] || DEFAULT_COL_WIDTH;

  const cellMap = useMemo(() => {
    const map = new Map<string, SheetCell>();
    for (const cell of cells) map.set(cellKey(cell.row_index, cell.col_index), cell);
    return map;
  }, [cells]);

  const activeKey = cellKey(activeCell.row, activeCell.col);
  const activeData = cellMap.get(activeKey);

  // Update formula bar when active cell changes
  useEffect(() => {
    setFormulaBarValue(activeData?.formula || activeData?.value || '');
  }, [activeKey, activeData?.formula, activeData?.value]);

  // Focus edit input
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      const v = inputRef.current.value;
      inputRef.current.setSelectionRange(v.length, v.length);
    }
  }, [editingCell]);

  // ─── Helpers ──────────────────────────────────────────────────
  const startEdit = useCallback((row: number, col: number, initial?: string) => {
    if (readOnly) return;
    const k = cellKey(row, col);
    const cell = cellMap.get(k);
    setEditingCell({ row, col });
    setEditValue(initial !== undefined ? initial : (cell?.formula || cell?.value || ''));
    setActiveCell({ row, col });
    setSelection(null);
  }, [cellMap, readOnly]);

  const commitEdit = useCallback(async (moveDir?: 'down' | 'right' | 'up' | 'left') => {
    if (!editingCell) return;
    const { row, col } = editingCell;
    const value = editValue;
    const isFormula = value.startsWith('=');
    await updateCell({
      row, col,
      value: isFormula ? null : value,
      formula: isFormula ? value : undefined,
    });
    setEditingCell(null);
    setEditValue('');
    setShowSuggestions(false);
    if (moveDir) {
      const dr = moveDir === 'down' ? 1 : moveDir === 'up' ? -1 : 0;
      const dc = moveDir === 'right' ? 1 : moveDir === 'left' ? -1 : 0;
      const nr = Math.max(0, Math.min(DEFAULT_ROWS - 1, row + dr));
      const nc = Math.max(0, Math.min(DEFAULT_COLS - 1, col + dc));
      setActiveCell({ row: nr, col: nc });
    }
  }, [editingCell, editValue, updateCell]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
    setShowSuggestions(false);
  }, []);

  // ─── Selection helpers ────────────────────────────────────────
  const selectionRange = useMemo<Selection>(() => {
    return selection ? normalizeSel(selection) : { startRow: activeCell.row, endRow: activeCell.row, startCol: activeCell.col, endCol: activeCell.col };
  }, [selection, activeCell]);

  const selectedPositions = useMemo(() => {
    const positions: { row: number; col: number }[] = [];
    for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
      for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) positions.push({ row: r, col: c });
    }
    return positions;
  }, [selectionRange]);

  // ─── Status bar stats ─────────────────────────────────────────
  const stats = useMemo(() => {
    if (selectedPositions.length < 2) return null;
    const nums: number[] = [];
    let count = 0;
    for (const p of selectedPositions) {
      const v = computedCells.get(cellKey(p.row, p.col));
      if (v !== null && v !== undefined && v !== '') {
        count++;
        const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
        if (!isNaN(n)) nums.push(n);
      }
    }
    const sum = nums.reduce((s, n) => s + n, 0);
    const avg = nums.length ? sum / nums.length : 0;
    return { count, sum, avg, min: nums.length ? Math.min(...nums) : 0, max: nums.length ? Math.max(...nums) : 0, numCount: nums.length };
  }, [selectedPositions, computedCells]);

  // ─── Format display value ─────────────────────────────────────
  const formatDisplayValue = useCallback((value: CellValue, cellType?: string): string => {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'string' && value.startsWith('#')) return value;
    switch (cellType) {
      case 'currency': {
        const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
        return isNaN(n) ? String(value) : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      }
      case 'percentage': {
        const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
        return isNaN(n) ? String(value) : `${(n * 100).toFixed(2)}%`;
      }
      case 'number': {
        const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
        return isNaN(n) ? String(value) : n.toLocaleString('pt-BR');
      }
      case 'boolean': return value ? 'VERDADEIRO' : 'FALSO';
      default:
        if (typeof value === 'boolean') return value ? 'VERDADEIRO' : 'FALSO';
        return String(value);
    }
  }, []);

  // ─── Format actions ───────────────────────────────────────────
  const applyFormatToSelection = useCallback(async (mutator: (current: SheetCell['format']) => SheetCell['format']) => {
    if (readOnly) return;
    const updates: CellUpdate[] = selectedPositions.map((p) => {
      const existing = cellMap.get(cellKey(p.row, p.col));
      const newFormat = mutator(existing?.format || {});
      return {
        row: p.row, col: p.col,
        value: existing?.value as CellValue ?? null,
        formula: existing?.formula || undefined,
        format: newFormat,
        cell_type: existing?.cell_type,
      };
    });
    await updateCellsBatch(updates);
  }, [readOnly, selectedPositions, cellMap, updateCellsBatch]);

  const applyTypeToSelection = useCallback(async (cell_type: SheetCell['cell_type']) => {
    if (readOnly) return;
    const updates: CellUpdate[] = selectedPositions.map((p) => {
      const existing = cellMap.get(cellKey(p.row, p.col));
      return {
        row: p.row, col: p.col,
        value: existing?.value as CellValue ?? null,
        formula: existing?.formula || undefined,
        format: existing?.format,
        cell_type,
      };
    });
    await updateCellsBatch(updates);
  }, [readOnly, selectedPositions, cellMap, updateCellsBatch]);

  const toggleFormat = useCallback((key: 'bold' | 'italic' | 'underline') => {
    applyFormatToSelection((c) => ({ ...c, [key]: !c[key] }));
  }, [applyFormatToSelection]);

  const setAlignment = useCallback((align: 'left' | 'center' | 'right') => {
    applyFormatToSelection((c) => ({ ...c, align }));
  }, [applyFormatToSelection]);

  const setColor = useCallback((kind: 'textColor' | 'bgColor', color: string | null) => {
    applyFormatToSelection((c) => {
      const next = { ...c };
      if (color) next[kind] = color;
      else delete next[kind];
      return next;
    });
  }, [applyFormatToSelection]);

  const clearFormatting = useCallback(() => {
    applyFormatToSelection(() => ({}));
  }, [applyFormatToSelection]);

  // ─── Clipboard ────────────────────────────────────────────────
  const buildClipboardText = useCallback(() => {
    const sel = selectionRange;
    const rows: string[] = [];
    for (let r = sel.startRow; r <= sel.endRow; r++) {
      const cols: string[] = [];
      for (let c = sel.startCol; c <= sel.endCol; c++) {
        const cell = cellMap.get(cellKey(r, c));
        const v = cell?.formula || cell?.value || '';
        cols.push(String(v).replace(/\t/g, ' ').replace(/\n/g, ' '));
      }
      rows.push(cols.join('\t'));
    }
    return rows.join('\n');
  }, [selectionRange, cellMap]);

  const handleCopy = useCallback(async (e?: React.ClipboardEvent | ClipboardEvent) => {
    if (editingCell) return;
    const text = buildClipboardText();
    try {
      if (e && 'clipboardData' in e && e.clipboardData) {
        e.clipboardData.setData('text/plain', text);
        e.preventDefault();
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // ignore
    }
  }, [buildClipboardText, editingCell]);

  const handleCut = useCallback(async (e?: React.ClipboardEvent | ClipboardEvent) => {
    if (editingCell || readOnly) return;
    await handleCopy(e);
    await deleteCells(selectedPositions);
  }, [editingCell, readOnly, handleCopy, deleteCells, selectedPositions]);

  const handlePaste = useCallback(async (e?: React.ClipboardEvent | ClipboardEvent) => {
    if (editingCell || readOnly) return;
    let text = '';
    if (e && 'clipboardData' in e && e.clipboardData) {
      text = e.clipboardData.getData('text/plain');
      e.preventDefault();
    } else {
      try { text = await navigator.clipboard.readText(); } catch { return; }
    }
    if (!text) return;
    const lines = text.split(/\r?\n/);
    if (!lines[lines.length - 1]) lines.pop();
    const updates: CellUpdate[] = [];
    for (let r = 0; r < lines.length; r++) {
      const cols = lines[r].split('\t');
      for (let c = 0; c < cols.length; c++) {
        const value = cols[c];
        const targetRow = activeCell.row + r;
        const targetCol = activeCell.col + c;
        if (targetRow >= DEFAULT_ROWS || targetCol >= DEFAULT_COLS) continue;
        const isFormula = value.startsWith('=');
        updates.push({
          row: targetRow, col: targetCol,
          value: isFormula ? null : value,
          formula: isFormula ? value : undefined,
        });
      }
    }
    if (updates.length) await updateCellsBatch(updates);
  }, [editingCell, readOnly, activeCell, updateCellsBatch]);

  // ─── Fill handle ──────────────────────────────────────────────
  const performFill = useCallback(async (target: { row: number; col: number }) => {
    const src = selectionRange;
    const srcW = src.endCol - src.startCol + 1;
    const srcH = src.endRow - src.startRow + 1;
    // Determine fill direction
    const isVertical = target.row > src.endRow || target.row < src.startRow;
    const updates: CellUpdate[] = [];

    if (isVertical) {
      const startR = target.row > src.endRow ? src.endRow + 1 : target.row;
      const endR = target.row > src.endRow ? target.row : src.startRow - 1;
      for (let r = startR; r <= endR; r++) {
        for (let c = src.startCol; c <= src.endCol; c++) {
          const srcRow = src.startRow + ((r - src.startRow) % srcH + srcH) % srcH;
          const srcCell = cellMap.get(cellKey(srcRow, c));
          if (!srcCell) continue;
          const dRow = r - srcRow;
          if (srcCell.formula) {
            updates.push({ row: r, col: c, formula: translateFormula(srcCell.formula, dRow, 0), format: srcCell.format, cell_type: srcCell.cell_type });
          } else {
            updates.push({ row: r, col: c, value: srcCell.value as CellValue, format: srcCell.format, cell_type: srcCell.cell_type });
          }
        }
      }
    } else {
      const startC = target.col > src.endCol ? src.endCol + 1 : target.col;
      const endC = target.col > src.endCol ? target.col : src.startCol - 1;
      for (let c = startC; c <= endC; c++) {
        for (let r = src.startRow; r <= src.endRow; r++) {
          const srcCol = src.startCol + ((c - src.startCol) % srcW + srcW) % srcW;
          const srcCell = cellMap.get(cellKey(r, srcCol));
          if (!srcCell) continue;
          const dCol = c - srcCol;
          if (srcCell.formula) {
            updates.push({ row: r, col: c, formula: translateFormula(srcCell.formula, 0, dCol), format: srcCell.format, cell_type: srcCell.cell_type });
          } else {
            updates.push({ row: r, col: c, value: srcCell.value as CellValue, format: srcCell.format, cell_type: srcCell.cell_type });
          }
        }
      }
    }
    if (updates.length) await updateCellsBatch(updates);
    // Expand selection
    setSelection({
      startRow: Math.min(src.startRow, target.row), endRow: Math.max(src.endRow, target.row),
      startCol: Math.min(src.startCol, target.col), endCol: Math.max(src.endCol, target.col),
    });
  }, [selectionRange, cellMap, updateCellsBatch]);

  // ─── Insert / delete rows-cols ────────────────────────────────
  const insertRow = useCallback(async (at: number, after = false) => {
    if (readOnly) return;
    const insertAt = after ? at + 1 : at;
    const updates: CellUpdate[] = [];
    cells.forEach((c) => {
      if (c.row_index >= insertAt) {
        updates.push({ row: c.row_index + 1, col: c.col_index, value: c.value as CellValue, formula: c.formula || undefined, format: c.format, cell_type: c.cell_type });
      }
    });
    // Clear original moved cells
    cells.forEach((c) => {
      if (c.row_index >= insertAt) updates.push({ row: c.row_index, col: c.col_index, value: null, formula: undefined, format: {} });
    });
    // Note: simple approach — upsert order will overwrite. Better: delete then insert
    // Simpler: do via temporary trick — process moves first
    if (updates.length) await updateCellsBatch(updates);
  }, [readOnly, cells, updateCellsBatch]);

  const insertCol = useCallback(async (at: number, after = false) => {
    if (readOnly) return;
    const insertAt = after ? at + 1 : at;
    const updates: CellUpdate[] = [];
    cells.forEach((c) => {
      if (c.col_index >= insertAt) {
        updates.push({ row: c.row_index, col: c.col_index + 1, value: c.value as CellValue, formula: c.formula || undefined, format: c.format, cell_type: c.cell_type });
      }
    });
    cells.forEach((c) => {
      if (c.col_index >= insertAt) updates.push({ row: c.row_index, col: c.col_index, value: null, formula: undefined, format: {} });
    });
    if (updates.length) await updateCellsBatch(updates);
  }, [readOnly, cells, updateCellsBatch]);

  const deleteRow = useCallback(async (at: number) => {
    if (readOnly) return;
    const updates: CellUpdate[] = [];
    cells.forEach((c) => {
      if (c.row_index === at) updates.push({ row: c.row_index, col: c.col_index, value: null, formula: undefined, format: {} });
      else if (c.row_index > at) {
        updates.push({ row: c.row_index - 1, col: c.col_index, value: c.value as CellValue, formula: c.formula || undefined, format: c.format, cell_type: c.cell_type });
        updates.push({ row: c.row_index, col: c.col_index, value: null, formula: undefined, format: {} });
      }
    });
    if (updates.length) await updateCellsBatch(updates);
  }, [readOnly, cells, updateCellsBatch]);

  const deleteCol = useCallback(async (at: number) => {
    if (readOnly) return;
    const updates: CellUpdate[] = [];
    cells.forEach((c) => {
      if (c.col_index === at) updates.push({ row: c.row_index, col: c.col_index, value: null, formula: undefined, format: {} });
      else if (c.col_index > at) {
        updates.push({ row: c.row_index, col: c.col_index - 1, value: c.value as CellValue, formula: c.formula || undefined, format: c.format, cell_type: c.cell_type });
        updates.push({ row: c.row_index, col: c.col_index, value: null, formula: undefined, format: {} });
      }
    });
    if (updates.length) await updateCellsBatch(updates);
  }, [readOnly, cells, updateCellsBatch]);

  // ─── Freeze ───────────────────────────────────────────────────
  const toggleFreezeRows = useCallback(async () => {
    if (!sheet) return;
    const next = sheet.frozen_rows > 0 ? 0 : (activeCell.row + 1);
    await updateSheetMeta({ frozen_rows: next });
    toast({ title: next > 0 ? `${next} linha(s) congelada(s)` : 'Linhas descongeladas' });
  }, [sheet, activeCell.row, updateSheetMeta, toast]);

  const toggleFreezeCols = useCallback(async () => {
    if (!sheet) return;
    const next = sheet.frozen_cols > 0 ? 0 : (activeCell.col + 1);
    await updateSheetMeta({ frozen_cols: next });
    toast({ title: next > 0 ? `${next} coluna(s) congelada(s)` : 'Colunas descongeladas' });
  }, [sheet, activeCell.col, updateSheetMeta, toast]);

  // ─── CSV export/import (kept) ─────────────────────────────────
  const handleExportCSV = useCallback(() => {
    const maxRow = Math.max(...cells.map((c) => c.row_index), 0);
    const maxCol = Math.max(...cells.map((c) => c.col_index), 0);
    const rows: string[][] = [];
    for (let r = 0; r <= maxRow; r++) {
      const row: string[] = [];
      for (let c = 0; c <= maxCol; c++) {
        const v = computedCells.get(cellKey(r, c));
        const value = v !== null && v !== undefined ? String(v) : '';
        const escaped = value.includes(',') || value.includes('"') || value.includes('\n')
          ? `"${value.replace(/"/g, '""')}"` : value;
        row.push(escaped);
      }
      rows.push(row);
    }
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${sheet?.title || 'planilha'}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado' });
  }, [cells, computedCells, sheet?.title, toast]);

  const handleImportCSV = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    const updates: CellUpdate[] = [];
    for (let r = 0; r < lines.length; r++) {
      if (!lines[r].trim()) continue;
      const values: string[] = [];
      let cur = '', inQ = false;
      for (let i = 0; i < lines[r].length; i++) {
        const ch = lines[r][i];
        if (ch === '"') {
          if (inQ && lines[r][i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (ch === ',' && !inQ) { values.push(cur); cur = ''; }
        else cur += ch;
      }
      values.push(cur);
      for (let c = 0; c < values.length; c++) {
        const v = values[c];
        if (v) {
          const isF = v.startsWith('=');
          updates.push({ row: r, col: c, value: isF ? null : v, formula: isF ? v : undefined });
        }
      }
    }
    if (updates.length) {
      await updateCellsBatch(updates);
      toast({ title: `${updates.length} células importadas` });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [updateCellsBatch, toast]);

  // ─── Mouse selection ──────────────────────────────────────────
  const handleCellMouseDown = useCallback((row: number, col: number, e: React.MouseEvent) => {
    if (editingCell && (editingCell.row !== row || editingCell.col !== col)) commitEdit();
    if (e.shiftKey) {
      setSelection({ startRow: activeCell.row, startCol: activeCell.col, endRow: row, endCol: col });
    } else {
      setActiveCell({ row, col });
      setSelection(null);
      setIsDragging(true);
    }
    containerRef.current?.focus();
  }, [activeCell, editingCell, commitEdit]);

  const handleCellMouseEnter = useCallback((row: number, col: number) => {
    if (isDragging) {
      setSelection({ startRow: activeCell.row, startCol: activeCell.col, endRow: row, endCol: col });
    } else if (isFilling) {
      setFillEnd({ row, col });
    }
  }, [isDragging, isFilling, activeCell]);

  useEffect(() => {
    const handleUp = async () => {
      if (isFilling && fillEnd) {
        await performFill(fillEnd);
      }
      setIsDragging(false);
      setIsFilling(false);
      setFillEnd(null);
      setResizingCol(null);
    };
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, [isFilling, fillEnd, performFill]);

  // ─── Column resize ────────────────────────────────────────────
  useEffect(() => {
    if (resizingCol === null) return;
    const startX = (window as any).__resizeStartX || 0;
    const startW = colWidths[resizingCol] || DEFAULT_COL_WIDTH;
    const onMove = (e: MouseEvent) => {
      const newW = Math.max(40, startW + (e.clientX - startX));
      setColWidths((prev) => ({ ...prev, [resizingCol]: newW }));
    };
    const onUp = async () => {
      const finalWidths = { ...colWidths };
      finalWidths[resizingCol] = (window as any).__lastResizeWidth || finalWidths[resizingCol];
      await updateSheetMeta({ col_widths: colWidths });
      setResizingCol(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizingCol, colWidths, updateSheetMeta]);

  const startColResize = (col: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (window as any).__resizeStartX = e.clientX;
    setResizingCol(col);
  };

  // ─── Keyboard ─────────────────────────────────────────────────
  const handleContainerKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (editingCell) return;
    const meta = e.ctrlKey || e.metaKey;

    if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (meta && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (meta && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleFormat('bold'); return; }
    if (meta && e.key.toLowerCase() === 'i') { e.preventDefault(); toggleFormat('italic'); return; }
    if (meta && e.key.toLowerCase() === 'u') { e.preventDefault(); toggleFormat('underline'); return; }
    if (meta && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      setSelection({ startRow: 0, startCol: 0, endRow: DEFAULT_ROWS - 1, endCol: DEFAULT_COLS - 1 });
      return;
    }

    let dr = 0, dc = 0;
    switch (e.key) {
      case 'ArrowUp': dr = -1; break;
      case 'ArrowDown': dr = 1; break;
      case 'ArrowLeft': dc = -1; break;
      case 'ArrowRight': dc = 1; break;
      case 'Tab': e.preventDefault(); dc = e.shiftKey ? -1 : 1; break;
      case 'Enter': e.preventDefault(); startEdit(activeCell.row, activeCell.col); return;
      case 'F2': e.preventDefault(); startEdit(activeCell.row, activeCell.col); return;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        deleteCells(selectedPositions);
        return;
      case 'Escape':
        setSelection(null);
        return;
      case 'Home':
        e.preventDefault();
        setActiveCell({ row: activeCell.row, col: 0 });
        setSelection(null);
        return;
      case 'End':
        e.preventDefault();
        setActiveCell({ row: activeCell.row, col: DEFAULT_COLS - 1 });
        setSelection(null);
        return;
      case 'PageDown':
        e.preventDefault();
        setActiveCell({ row: Math.min(DEFAULT_ROWS - 1, activeCell.row + 10), col: activeCell.col });
        setSelection(null);
        return;
      case 'PageUp':
        e.preventDefault();
        setActiveCell({ row: Math.max(0, activeCell.row - 10), col: activeCell.col });
        setSelection(null);
        return;
    }

    if (dr !== 0 || dc !== 0) {
      e.preventDefault();
      const nr = Math.max(0, Math.min(DEFAULT_ROWS - 1, activeCell.row + dr));
      const nc = Math.max(0, Math.min(DEFAULT_COLS - 1, activeCell.col + dc));
      if (e.shiftKey) {
        const start = selection ? { row: selection.startRow, col: selection.startCol } : activeCell;
        setSelection({ startRow: start.row, startCol: start.col, endRow: nr, endCol: nc });
      } else {
        setActiveCell({ row: nr, col: nc });
        setSelection(null);
      }
      return;
    }

    // Printable character → start editing with that character
    if (!meta && e.key.length === 1 && !readOnly) {
      e.preventDefault();
      startEdit(activeCell.row, activeCell.col, e.key);
    }
  }, [editingCell, activeCell, selection, selectedPositions, undo, redo, toggleFormat, startEdit, deleteCells, readOnly]);

  // Global clipboard handlers (only when grid is focused)
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      if (containerRef.current?.contains(document.activeElement) && !editingCell) handleCopy(e);
    };
    const onCut = (e: ClipboardEvent) => {
      if (containerRef.current?.contains(document.activeElement) && !editingCell) handleCut(e);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (containerRef.current?.contains(document.activeElement) && !editingCell) handlePaste(e);
    };
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
    };
  }, [editingCell, handleCopy, handleCut, handlePaste]);

  // ─── Formula autocomplete ─────────────────────────────────────
  const suggestions = useMemo(() => {
    if (!editValue.startsWith('=')) return [];
    const m = editValue.match(/([A-Z]+)$/i);
    if (!m) return [];
    const prefix = m[1].toUpperCase();
    if (prefix.length < 1) return [];
    return SUPPORTED_FUNCTIONS.filter((f) => f.startsWith(prefix)).slice(0, 8);
  }, [editValue]);

  useEffect(() => {
    setShowSuggestions(suggestions.length > 0 && editingCell !== null);
    setSuggestionIdx(0);
  }, [suggestions.length, editingCell]);

  const insertSuggestion = useCallback((fn: string) => {
    setEditValue((prev) => prev.replace(/([A-Z]+)$/i, fn + '('));
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);

  // ─── Edit input keydown ───────────────────────────────────────
  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIdx((i) => (i + 1) % suggestions.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestionIdx((i) => (i - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === 'Tab') { e.preventDefault(); insertSuggestion(suggestions[suggestionIdx]); return; }
    }
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(e.shiftKey ? 'up' : 'down'); }
    else if (e.key === 'Tab') { e.preventDefault(); commitEdit(e.shiftKey ? 'left' : 'right'); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }, [showSuggestions, suggestions, suggestionIdx, commitEdit, cancelEdit, insertSuggestion]);

  if (isLoading) return <div className="p-4 text-muted-foreground">Carregando planilha...</div>;

  // ─── Compute selection-merged & fill preview ──────────────────
  const previewSel: Selection | null = isFilling && fillEnd
    ? {
        startRow: Math.min(selectionRange.startRow, fillEnd.row),
        endRow: Math.max(selectionRange.endRow, fillEnd.row),
        startCol: Math.min(selectionRange.startCol, fillEnd.col),
        endCol: Math.max(selectionRange.endCol, fillEnd.col),
      }
    : null;

  const totalWidth = ROW_HEADER_WIDTH + Array.from({ length: DEFAULT_COLS }, (_, i) => getColWidth(i)).reduce((s, w) => s + w, 0);

  // Range label: e.g. A1 or A1:C5
  const rangeLabel = (() => {
    const sel = selectionRange;
    if (sel.startRow === sel.endRow && sel.startCol === sel.endCol) return cellKey(activeCell.row, activeCell.col);
    return `${cellKey(sel.startRow, sel.startCol)}:${cellKey(sel.endRow, sel.endCol)}`;
  })();

  return (
    <div className="flex flex-col h-full select-none">
      {/* ─── Toolbar ────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-muted/30 flex-wrap">
        <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo || readOnly} title="Desfazer (Ctrl+Z)" className="h-8 w-8 p-0">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo || readOnly} title="Refazer (Ctrl+Y)" className="h-8 w-8 p-0">
          <Redo2 className="h-4 w-4" />
        </Button>
        <Separator />

        <Button variant="ghost" size="sm" onClick={() => handleCopy()} title="Copiar (Ctrl+C)" className="h-8 w-8 p-0"><Copy className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => handleCut()} disabled={readOnly} title="Recortar (Ctrl+X)" className="h-8 w-8 p-0"><Scissors className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => handlePaste()} disabled={readOnly} title="Colar (Ctrl+V)" className="h-8 w-8 p-0"><ClipboardPaste className="h-4 w-4" /></Button>
        <Separator />

        <Button variant={activeData?.format?.bold ? 'secondary' : 'ghost'} size="sm" onClick={() => toggleFormat('bold')} disabled={readOnly} title="Negrito (Ctrl+B)" className="h-8 w-8 p-0"><Bold className="h-4 w-4" /></Button>
        <Button variant={activeData?.format?.italic ? 'secondary' : 'ghost'} size="sm" onClick={() => toggleFormat('italic')} disabled={readOnly} title="Itálico (Ctrl+I)" className="h-8 w-8 p-0"><Italic className="h-4 w-4" /></Button>
        <Button variant={activeData?.format?.underline ? 'secondary' : 'ghost'} size="sm" onClick={() => toggleFormat('underline')} disabled={readOnly} title="Sublinhado (Ctrl+U)" className="h-8 w-8 p-0"><Underline className="h-4 w-4" /></Button>
        <Separator />

        {/* Text color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} title="Cor do texto" className="h-8 w-8 p-0 relative">
              <Type className="h-4 w-4" />
              <span className="absolute bottom-1 left-1 right-1 h-1 rounded" style={{ backgroundColor: activeData?.format?.textColor || '#000' }} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <ColorGrid onPick={(c) => setColor('textColor', c)} onClear={() => setColor('textColor', null)} />
          </PopoverContent>
        </Popover>

        {/* Bg color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} title="Cor de preenchimento" className="h-8 w-8 p-0 relative">
              <Paintbrush className="h-4 w-4" />
              <span className="absolute bottom-1 left-1 right-1 h-1 rounded" style={{ backgroundColor: activeData?.format?.bgColor || 'transparent', border: '1px solid hsl(var(--border))' }} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <ColorGrid onPick={(c) => setColor('bgColor', c)} onClear={() => setColor('bgColor', null)} />
          </PopoverContent>
        </Popover>
        <Separator />

        <Button variant={activeData?.format?.align === 'left' ? 'secondary' : 'ghost'} size="sm" onClick={() => setAlignment('left')} disabled={readOnly} title="Alinhar à esquerda" className="h-8 w-8 p-0"><AlignLeft className="h-4 w-4" /></Button>
        <Button variant={activeData?.format?.align === 'center' ? 'secondary' : 'ghost'} size="sm" onClick={() => setAlignment('center')} disabled={readOnly} title="Centralizar" className="h-8 w-8 p-0"><AlignCenter className="h-4 w-4" /></Button>
        <Button variant={activeData?.format?.align === 'right' ? 'secondary' : 'ghost'} size="sm" onClick={() => setAlignment('right')} disabled={readOnly} title="Alinhar à direita" className="h-8 w-8 p-0"><AlignRight className="h-4 w-4" /></Button>
        <Separator />

        <Button variant={activeData?.cell_type === 'currency' ? 'secondary' : 'ghost'} size="sm" onClick={() => applyTypeToSelection('currency')} disabled={readOnly} title="Formatar como moeda" className="h-8 w-8 p-0"><DollarSign className="h-4 w-4" /></Button>
        <Button variant={activeData?.cell_type === 'percentage' ? 'secondary' : 'ghost'} size="sm" onClick={() => applyTypeToSelection('percentage')} disabled={readOnly} title="Formatar como porcentagem" className="h-8 w-8 p-0"><Percent className="h-4 w-4" /></Button>
        <Button variant={activeData?.cell_type === 'number' ? 'secondary' : 'ghost'} size="sm" onClick={() => applyTypeToSelection('number')} disabled={readOnly} title="Formatar como número" className="h-8 w-8 p-0"><Hash className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => applyTypeToSelection('text')} disabled={readOnly} title="Limpar formato numérico" className="h-8 px-2 text-xs">123</Button>
        <Separator />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} className="h-8 px-2 gap-1 text-xs"><Plus className="h-3 w-3" />Inserir</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => insertRow(activeCell.row)}>Linha acima</DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertRow(activeCell.row, true)}>Linha abaixo</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => insertCol(activeCell.col)}>Coluna à esquerda</DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertCol(activeCell.col, true)}>Coluna à direita</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} className="h-8 px-2 gap-1 text-xs"><Minus className="h-3 w-3" />Excluir</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => deleteRow(activeCell.row)}>Linha {activeCell.row + 1}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => deleteCol(activeCell.col)}>Coluna {colIndexToLetter(activeCell.col)}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => deleteCells(selectedPositions)}>Limpar conteúdo</DropdownMenuItem>
            <DropdownMenuItem onClick={clearFormatting}>Limpar formatação</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} className="h-8 px-2 gap-1 text-xs"><Snowflake className="h-3 w-3" />Congelar</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={toggleFreezeRows}>{sheet?.frozen_rows ? 'Descongelar linhas' : `Congelar até linha ${activeCell.row + 1}`}</DropdownMenuItem>
            <DropdownMenuItem onClick={toggleFreezeCols}>{sheet?.frozen_cols ? 'Descongelar colunas' : `Congelar até coluna ${colIndexToLetter(activeCell.col)}`}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator />

        <Button variant="ghost" size="sm" onClick={handleExportCSV} disabled={cells.length === 0} title="Exportar CSV" className="h-8 w-8 p-0"><Download className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={readOnly} title="Importar CSV" className="h-8 w-8 p-0"><Upload className="h-4 w-4" /></Button>
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
      </div>

      {/* ─── Formula bar ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b bg-background">
        <div className="w-20 text-center font-mono text-xs text-muted-foreground border rounded px-2 py-1 bg-muted/30">
          {rangeLabel}
        </div>
        <span className="text-muted-foreground italic text-sm font-serif">fx</span>
        <Input
          value={formulaBarValue}
          onChange={(e) => setFormulaBarValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const isF = formulaBarValue.startsWith('=');
              updateCell({
                row: activeCell.row, col: activeCell.col,
                value: isF ? null : formulaBarValue,
                formula: isF ? formulaBarValue : undefined,
              });
              containerRef.current?.focus();
            }
          }}
          disabled={readOnly}
          placeholder="Digite valor ou =FÓRMULA"
          className="font-mono text-sm h-8"
        />
      </div>

      {/* ─── Grid ───────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto outline-none"
        tabIndex={0}
        onKeyDown={handleContainerKeyDown}
      >
        <div ref={gridRef} className="relative" style={{ width: totalWidth }}>
          {/* Header row */}
          <div className="flex sticky top-0 z-20 bg-muted border-b" style={{ height: HEADER_HEIGHT }}>
            <div className="flex items-center justify-center border-r bg-muted text-[10px] text-muted-foreground sticky left-0 z-10" style={{ width: ROW_HEADER_WIDTH }} />
            {Array.from({ length: DEFAULT_COLS }, (_, i) => {
              const w = getColWidth(i);
              const isActiveCol = i >= selectionRange.startCol && i <= selectionRange.endCol;
              return (
                <ContextMenu key={i}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn(
                        'flex items-center justify-center border-r text-xs font-medium cursor-pointer relative',
                        isActiveCol ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
                      )}
                      style={{ width: w }}
                      onClick={() => {
                        setSelection({ startRow: 0, startCol: i, endRow: DEFAULT_ROWS - 1, endCol: i });
                        setActiveCell({ row: 0, col: i });
                      }}
                    >
                      {colIndexToLetter(i)}
                      <div
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary z-30"
                        onMouseDown={(e) => startColResize(i, e)}
                      />
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => insertCol(i)}>Inserir coluna à esquerda</ContextMenuItem>
                    <ContextMenuItem onClick={() => insertCol(i, true)}>Inserir coluna à direita</ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => deleteCol(i)} className="text-destructive">Excluir coluna {colIndexToLetter(i)}</ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>

          {/* Data rows */}
          {Array.from({ length: DEFAULT_ROWS }, (_, rowIndex) => {
            const isActiveRow = rowIndex >= selectionRange.startRow && rowIndex <= selectionRange.endRow;
            const isFrozenRow = sheet && rowIndex < sheet.frozen_rows;
            return (
              <div
                key={rowIndex}
                className={cn('flex border-b', isFrozenRow && 'sticky z-10 bg-background border-b-2 border-primary/40')}
                style={isFrozenRow ? { top: HEADER_HEIGHT + rowIndex * ROW_HEIGHT, height: ROW_HEIGHT } : { height: ROW_HEIGHT }}
              >
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn(
                        'flex items-center justify-center border-r text-xs cursor-pointer sticky left-0 z-10',
                        isActiveRow ? 'bg-primary/15 text-primary font-medium' : 'bg-muted/50 text-muted-foreground'
                      )}
                      style={{ width: ROW_HEADER_WIDTH }}
                      onClick={() => {
                        setSelection({ startRow: rowIndex, startCol: 0, endRow: rowIndex, endCol: DEFAULT_COLS - 1 });
                        setActiveCell({ row: rowIndex, col: 0 });
                      }}
                    >
                      {rowIndex + 1}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => insertRow(rowIndex)}>Inserir linha acima</ContextMenuItem>
                    <ContextMenuItem onClick={() => insertRow(rowIndex, true)}>Inserir linha abaixo</ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => deleteRow(rowIndex)} className="text-destructive">Excluir linha {rowIndex + 1}</ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>

                {Array.from({ length: DEFAULT_COLS }, (_, colIndex) => {
                  const key = cellKey(rowIndex, colIndex);
                  const cell = cellMap.get(key);
                  const displayValue = computedCells.get(key);
                  const format = cell?.format || {};
                  const isActive = activeCell.row === rowIndex && activeCell.col === colIndex;
                  const isInSel = inSelection(rowIndex, colIndex, selectionRange);
                  const isInFillPreview = inSelection(rowIndex, colIndex, previewSel) && !isInSel;
                  const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                  const isFrozenCol = sheet && colIndex < sheet.frozen_cols;
                  const w = getColWidth(colIndex);

                  // Only show fill handle on bottom-right of selection
                  const isFillCorner = rowIndex === selectionRange.endRow && colIndex === selectionRange.endCol;

                  return (
                    <ContextMenu key={colIndex}>
                      <ContextMenuTrigger asChild>
                        <div
                          className={cn(
                            'border-r relative',
                            !isEditing && 'cursor-cell',
                            isInSel && !isActive && 'bg-primary/10',
                            isInFillPreview && 'bg-primary/5 border-dashed border-primary/40',
                            isActive && !isEditing && 'ring-2 ring-primary ring-inset z-10',
                            isFrozenCol && 'sticky bg-background z-[5] border-r-2 border-primary/40',
                          )}
                          style={{
                            width: w,
                            height: ROW_HEIGHT,
                            ...(isFrozenCol ? { left: ROW_HEADER_WIDTH + Array.from({ length: colIndex }, (_, i) => getColWidth(i)).reduce((s, x) => s + x, 0) } : {}),
                          }}
                          onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                          onDoubleClick={() => startEdit(rowIndex, colIndex)}
                        >
                          {isEditing ? (
                            <>
                              <input
                                ref={inputRef}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => commitEdit()}
                                onKeyDown={handleEditKeyDown}
                                className="w-full h-full px-1 outline-none border-2 border-primary bg-background text-sm font-mono"
                              />
                              {showSuggestions && (
                                <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-md shadow-lg min-w-[180px] py-1">
                                  {suggestions.map((s, i) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onMouseDown={(ev) => { ev.preventDefault(); insertSuggestion(s); }}
                                      className={cn('w-full text-left px-3 py-1 text-sm font-mono', i === suggestionIdx ? 'bg-accent' : 'hover:bg-accent/50')}
                                    >
                                      {s}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : (
                            <div
                              className={cn(
                                'w-full h-full px-1 flex items-center text-sm overflow-hidden text-ellipsis whitespace-nowrap',
                                format.bold && 'font-bold',
                                format.italic && 'italic',
                                format.underline && 'underline',
                                format.align === 'center' && 'justify-center',
                                format.align === 'right' && 'justify-end',
                                (!format.align || format.align === 'left') && 'justify-start',
                                typeof displayValue === 'string' && displayValue.startsWith('#') && 'text-destructive',
                                typeof displayValue === 'number' && !format.align && 'justify-end',
                              )}
                              style={{
                                backgroundColor: format.bgColor || undefined,
                                color: format.textColor || undefined,
                              }}
                            >
                              {formatDisplayValue(displayValue ?? null, cell?.cell_type)}
                            </div>
                          )}
                          {/* Fill handle */}
                          {isFillCorner && !isEditing && !readOnly && (
                            <div
                              className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-primary border-2 border-background cursor-crosshair z-20 rounded-sm"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsFilling(true);
                                setFillEnd({ row: rowIndex, col: colIndex });
                              }}
                            />
                          )}
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => handleCopy()}>Copiar</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleCut()} disabled={readOnly}>Recortar</ContextMenuItem>
                        <ContextMenuItem onClick={() => handlePaste()} disabled={readOnly}>Colar</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => insertRow(rowIndex)} disabled={readOnly}>Inserir linha acima</ContextMenuItem>
                        <ContextMenuItem onClick={() => insertCol(colIndex)} disabled={readOnly}>Inserir coluna à esquerda</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => deleteCells(selectedPositions)} disabled={readOnly} className="text-destructive">Limpar</ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Status bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-3 py-1 border-t bg-muted/40 text-xs text-muted-foreground">
        <div className="flex items-center gap-3 font-mono">
          <span>{rangeLabel}</span>
          {selectedPositions.length > 1 && <span>· {selectedPositions.length} células</span>}
        </div>
        {stats && (
          <div className="flex items-center gap-4 font-mono tabular-nums">
            <span>Soma: <strong className="text-foreground">{stats.sum.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</strong></span>
            <span>Média: <strong className="text-foreground">{stats.avg.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</strong></span>
            <span>Mín: <strong className="text-foreground">{stats.min.toLocaleString('pt-BR')}</strong></span>
            <span>Máx: <strong className="text-foreground">{stats.max.toLocaleString('pt-BR')}</strong></span>
            <span>Cont.: <strong className="text-foreground">{stats.count}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}

function Separator() {
  return <div className="h-5 w-px bg-border mx-1" />;
}

function ColorGrid({ onPick, onClear }: { onPick: (c: string) => void; onClear: () => void }) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClear}
        className="w-full text-xs text-muted-foreground hover:text-foreground py-1 border rounded"
      >
        Sem cor
      </button>
      <div className="grid grid-cols-10 gap-1">
        {COLOR_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
            style={{ backgroundColor: c }}
            aria-label={c}
          />
        ))}
      </div>
    </div>
  );
}
