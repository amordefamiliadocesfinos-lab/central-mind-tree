import React, { useState, useCallback, useEffect, useRef, useMemo, KeyboardEvent } from 'react';
import { useSpreadsheet, CellUpdate, SheetCell } from '@/hooks/useSpreadsheet';
import { cellKey, colIndexToLetter, CellValue, evaluateFormula, CellData } from '@/lib/formulaEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Undo2, Redo2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SpreadsheetEditorProps {
  sheetId: string;
  readOnly?: boolean;
}

const DEFAULT_ROWS = 50;
const DEFAULT_COLS = 26; // A-Z

export function SpreadsheetEditor({ sheetId, readOnly = false }: SpreadsheetEditorProps) {
  const { sheet, cells, computedCells, isLoading, updateCell, undo, redo, canUndo, canRedo } = useSpreadsheet(sheetId);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Build cell data map for display
  const cellMap = useMemo(() => {
    const map = new Map<string, SheetCell>();
    for (const cell of cells) {
      const key = cellKey(cell.row_index, cell.col_index);
      map.set(key, cell);
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

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

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
      setEditValue('');
    },
    [updateCell, readOnly]
  );

  // Handle formula bar submit
  const handleFormulaBarSubmit = useCallback(() => {
    if (!selectedCell || readOnly) return;
    handleCellEdit(selectedCell.row, selectedCell.col, formulaBarValue);
  }, [selectedCell, formulaBarValue, handleCellEdit, readOnly]);

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

  // Handle cell click
  const handleCellClick = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
    setEditingCell(null);
  }, []);

  // Handle cell double-click to edit
  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    if (readOnly) return;
    const key = cellKey(row, col);
    const cell = cellMap.get(key);
    setEditingCell({ row, col });
    setEditValue(cell?.formula || cell?.value || '');
  }, [cellMap, readOnly]);

  // Handle edit submit
  const handleEditSubmit = useCallback(() => {
    if (editingCell) {
      handleCellEdit(editingCell.row, editingCell.col, editValue);
    }
  }, [editingCell, editValue, handleCellEdit]);

  // Handle edit key down
  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditSubmit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleEditSubmit();
      // Move to next cell
      if (editingCell) {
        const nextCol = e.shiftKey ? editingCell.col - 1 : editingCell.col + 1;
        if (nextCol >= 0 && nextCol < DEFAULT_COLS) {
          setSelectedCell({ row: editingCell.row, col: nextCol });
        }
      }
    }
  }, [handleEditSubmit, editingCell]);

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

      {/* Grid - Custom implementation */}
      <ScrollArea className="flex-1">
        <div className="inline-block min-w-full">
          {/* Header Row */}
          <div className="flex sticky top-0 z-10 bg-muted border-b">
            <div className="w-12 h-8 flex items-center justify-center border-r text-xs font-medium text-muted-foreground bg-muted">
              {/* Row number header */}
            </div>
            {Array.from({ length: DEFAULT_COLS }, (_, i) => (
              <div
                key={i}
                className="w-24 h-8 flex items-center justify-center border-r text-xs font-medium text-muted-foreground bg-muted"
              >
                {colIndexToLetter(i)}
              </div>
            ))}
          </div>

          {/* Data Rows */}
          {Array.from({ length: DEFAULT_ROWS }, (_, rowIndex) => (
            <div key={rowIndex} className="flex border-b">
              {/* Row number */}
              <div className="w-12 h-7 flex items-center justify-center border-r text-xs text-muted-foreground bg-muted/50 sticky left-0">
                {rowIndex + 1}
              </div>
              {/* Cells */}
              {Array.from({ length: DEFAULT_COLS }, (_, colIndex) => {
                const key = cellKey(rowIndex, colIndex);
                const cell = cellMap.get(key);
                const displayValue = computedCells.get(key);
                const format = cell?.format || {};
                const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;

                return (
                  <div
                    key={colIndex}
                    className={cn(
                      'w-24 h-7 border-r relative',
                      isSelected && 'ring-2 ring-primary ring-inset',
                      !isEditing && 'cursor-cell'
                    )}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                    onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                  >
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleEditSubmit}
                        onKeyDown={handleEditKeyDown}
                        className="w-full h-full px-1 border-2 border-primary outline-none bg-background text-sm font-mono"
                      />
                    ) : (
                      <div
                        className={cn(
                          'w-full h-full px-1 flex items-center text-sm overflow-hidden text-ellipsis whitespace-nowrap',
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
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}