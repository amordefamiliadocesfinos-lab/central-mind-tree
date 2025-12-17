import React, { useState, useCallback, useEffect, useRef, useMemo, KeyboardEvent } from 'react';
import { DataGrid, Column, RenderCellProps, RenderEditCellProps } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { useSpreadsheet, CellUpdate, SheetCell } from '@/hooks/useSpreadsheet';
import { cellKey, colIndexToLetter, CellValue, evaluateFormula, CellData } from '@/lib/formulaEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Undo2, Redo2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpreadsheetEditorProps {
  sheetId: string;
  readOnly?: boolean;
}

interface RowData {
  rowIndex: number;
  [key: string]: CellValue | number;
}

const DEFAULT_ROWS = 100;
const DEFAULT_COLS = 26; // A-Z

export function SpreadsheetEditor({ sheetId, readOnly = false }: SpreadsheetEditorProps) {
  const { sheet, cells, computedCells, isLoading, updateCell, undo, redo, canUndo, canRedo } = useSpreadsheet(sheetId);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Build cell data map for display
  const cellMap = useMemo(() => {
    const map = new Map<string, SheetCell>();
    for (const cell of cells) {
      const key = cellKey(cell.row_index, cell.col_index);
      map.set(key, cell);
    }
    return map;
  }, [cells]);

  // Build CellData for formula evaluation
  const cellDataMap = useMemo((): CellData => {
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

  // Update formula bar when selection changes
  useEffect(() => {
    if (selectedCell) {
      const key = cellKey(selectedCell.row, selectedCell.col);
      const cell = cellMap.get(key);
      setFormulaBarValue(cell?.formula || cell?.value || '');
    } else {
      setFormulaBarValue('');
    }
  }, [selectedCell, cellMap]);

  // Generate columns
  const columns: Column<RowData>[] = useMemo(() => {
    const cols: Column<RowData>[] = [
      {
        key: 'rowIndex',
        name: '',
        width: 50,
        frozen: true,
        renderCell: ({ row }) => (
          <div className="text-center text-muted-foreground text-xs font-medium">
            {row.rowIndex + 1}
          </div>
        ),
      },
    ];

    for (let i = 0; i < DEFAULT_COLS; i++) {
      const colKey = `col_${i}`;
      const colLetter = colIndexToLetter(i);
      
      cols.push({
        key: colKey,
        name: colLetter,
        width: sheet?.col_widths?.[i] || 100,
        resizable: true,
        renderCell: (props: RenderCellProps<RowData>) => {
          const row = props.row.rowIndex;
          const col = i;
          const key = cellKey(row, col);
          const cell = cellMap.get(key);
          const displayValue = computedCells.get(key);
          const format = cell?.format || {};

          return (
            <div
              className={cn(
                'w-full h-full px-1 flex items-center overflow-hidden text-ellipsis',
                format.bold && 'font-bold',
                format.italic && 'italic',
                format.underline && 'underline',
                format.align === 'center' && 'justify-center',
                format.align === 'right' && 'justify-end',
                !format.align && 'justify-start'
              )}
              style={{
                backgroundColor: format.bgColor || undefined,
                color: format.textColor || undefined,
              }}
            >
              {formatDisplayValue(displayValue, cell?.cell_type)}
            </div>
          );
        },
        renderEditCell: readOnly ? undefined : (props: RenderEditCellProps<RowData>) => {
          const row = props.row.rowIndex;
          const col = i;
          const key = cellKey(row, col);
          const cell = cellMap.get(key);
          const initialValue = cell?.formula || cell?.value || '';

          return (
            <input
              className="w-full h-full px-1 border-2 border-primary outline-none bg-background"
              autoFocus
              defaultValue={initialValue}
              onBlur={(e) => {
                handleCellEdit(row, col, e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCellEdit(row, col, (e.target as HTMLInputElement).value);
                  props.onClose();
                } else if (e.key === 'Escape') {
                  props.onClose();
                } else if (e.key === 'Tab') {
                  e.preventDefault();
                  handleCellEdit(row, col, (e.target as HTMLInputElement).value);
                  props.onClose();
                }
              }}
            />
          );
        },
      });
    }

    return cols;
  }, [sheet?.col_widths, cellMap, computedCells, readOnly]);

  // Generate rows
  const rows: RowData[] = useMemo(() => {
    const data: RowData[] = [];
    for (let i = 0; i < DEFAULT_ROWS; i++) {
      const row: RowData = { rowIndex: i };
      for (let j = 0; j < DEFAULT_COLS; j++) {
        row[`col_${j}`] = null;
      }
      data.push(row);
    }
    return data;
  }, []);

  // Handle cell edit
  const handleCellEdit = useCallback(
    async (row: number, col: number, value: string) => {
      if (readOnly) return;

      const isFormula = value.startsWith('=');
      const update: CellUpdate = {
        row,
        col,
        value: isFormula ? null : value,
        formula: isFormula ? value : undefined,
      };

      await updateCell(update);
      setEditingCell(null);
    },
    [updateCell, readOnly]
  );

  // Handle formula bar submit
  const handleFormulaBarSubmit = useCallback(() => {
    if (!selectedCell || readOnly) return;
    handleCellEdit(selectedCell.row, selectedCell.col, formulaBarValue);
  }, [selectedCell, formulaBarValue, handleCellEdit, readOnly]);

  // Handle cell selection
  const handleCellClick = useCallback(
    (args: { rowIdx: number; column: Column<RowData> }) => {
      if (args.column.key === 'rowIndex') return;
      const colIndex = parseInt(args.column.key.replace('col_', ''), 10);
      if (!isNaN(colIndex)) {
        setSelectedCell({ row: args.rowIdx, col: colIndex });
      }
    },
    []
  );

  // Format display value based on cell type
  function formatDisplayValue(value: CellValue, cellType?: string): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' && value.startsWith('#')) return value; // Error

    switch (cellType) {
      case 'currency':
        const num = typeof value === 'number' ? value : parseFloat(String(value));
        return isNaN(num) ? String(value) : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      case 'percentage':
        const pct = typeof value === 'number' ? value : parseFloat(String(value));
        return isNaN(pct) ? String(value) : `${(pct * 100).toFixed(2)}%`;
      case 'date':
        return String(value);
      case 'boolean':
        return value ? 'VERDADEIRO' : 'FALSO';
      default:
        return String(value);
    }
  }

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Ctrl/Cmd + Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z = Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      // Ctrl/Cmd + B = Bold
      if ((e.ctrlKey || e.metaKey) && e.key === 'b' && selectedCell) {
        e.preventDefault();
        toggleFormat('bold');
      }
    },
    [undo, redo, selectedCell]
  );

  // Toggle cell format
  const toggleFormat = useCallback(
    async (formatKey: 'bold' | 'italic' | 'underline') => {
      if (!selectedCell || readOnly) return;

      const key = cellKey(selectedCell.row, selectedCell.col);
      const cell = cellMap.get(key);
      const currentFormat = cell?.format || {};
      const newFormat = { ...currentFormat, [formatKey]: !currentFormat[formatKey] };

      const update: CellUpdate = {
        row: selectedCell.row,
        col: selectedCell.col,
        value: cell?.value as CellValue ?? null,
        formula: cell?.formula || undefined,
        format: newFormat,
      };

      await updateCell(update);
    },
    [selectedCell, cellMap, updateCell, readOnly]
  );

  // Set alignment
  const setAlignment = useCallback(
    async (align: 'left' | 'center' | 'right') => {
      if (!selectedCell || readOnly) return;

      const key = cellKey(selectedCell.row, selectedCell.col);
      const cell = cellMap.get(key);
      const currentFormat = cell?.format || {};
      const newFormat = { ...currentFormat, align };

      const update: CellUpdate = {
        row: selectedCell.row,
        col: selectedCell.col,
        value: cell?.value as CellValue ?? null,
        formula: cell?.formula || undefined,
        format: newFormat,
      };

      await updateCell(update);
    },
    [selectedCell, cellMap, updateCell, readOnly]
  );

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Carregando planilha...</div>;
  }

  const selectedCellKey = selectedCell ? cellKey(selectedCell.row, selectedCell.col) : null;
  const selectedCellData = selectedCellKey ? cellMap.get(selectedCellKey) : null;

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={undo}
          disabled={!canUndo || readOnly}
          title="Desfazer (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={redo}
          disabled={!canRedo || readOnly}
          title="Refazer (Ctrl+Y)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          variant={selectedCellData?.format?.bold ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => toggleFormat('bold')}
          disabled={!selectedCell || readOnly}
          title="Negrito (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={selectedCellData?.format?.italic ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => toggleFormat('italic')}
          disabled={!selectedCell || readOnly}
          title="Itálico"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={selectedCellData?.format?.underline ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => toggleFormat('underline')}
          disabled={!selectedCell || readOnly}
          title="Sublinhado"
        >
          <Underline className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          variant={selectedCellData?.format?.align === 'left' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setAlignment('left')}
          disabled={!selectedCell || readOnly}
          title="Alinhar à esquerda"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant={selectedCellData?.format?.align === 'center' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setAlignment('center')}
          disabled={!selectedCell || readOnly}
          title="Centralizar"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant={selectedCellData?.format?.align === 'right' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setAlignment('right')}
          disabled={!selectedCell || readOnly}
          title="Alinhar à direita"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Formula Bar */}
      <div className="flex items-center gap-2 p-2 border-b bg-background">
        <div className="w-16 text-center font-mono text-sm text-muted-foreground border rounded px-2 py-1">
          {selectedCell ? cellKey(selectedCell.row, selectedCell.col) : ''}
        </div>
        <div className="flex-1 flex items-center gap-2">
          <span className="text-muted-foreground">fx</span>
          <Input
            value={formulaBarValue}
            onChange={(e) => setFormulaBarValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleFormulaBarSubmit();
              }
            }}
            onBlur={handleFormulaBarSubmit}
            disabled={!selectedCell || readOnly}
            placeholder={selectedCell ? 'Digite um valor ou fórmula (começando com =)' : 'Selecione uma célula'}
            className="font-mono text-sm"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto" ref={gridRef}>
        <DataGrid
          columns={columns}
          rows={rows}
          rowHeight={28}
          headerRowHeight={32}
          onCellClick={handleCellClick}
          className="rdg-light h-full"
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
}
