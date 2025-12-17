import React, { useState } from 'react';
import { useSheets, Sheet } from '@/hooks/useSpreadsheet';
import { SpreadsheetEditor } from '@/components/SpreadsheetEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, FileSpreadsheet, Trash2, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SheetListProps {
  taskId?: string;
  nodeId?: string;
}

export function SheetList({ taskId, nodeId }: SheetListProps) {
  const { sheets, isLoading, createSheet, deleteSheet, updateSheet } = useSheets({ taskId, nodeId });
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const handleCreate = async () => {
    const sheet = await createSheet({ task_id: taskId, node_id: nodeId });
    setSelectedSheetId(sheet.id);
  };

  const handleRename = async (id: string) => {
    if (newTitle.trim()) {
      await updateSheet(id, { title: newTitle.trim() });
    }
    setEditingTitle(null);
    setNewTitle('');
  };

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Carregando planilhas...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Planilhas</h3>
        <Button onClick={handleCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Planilha
        </Button>
      </div>

      {sheets.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma planilha vinculada</p>
            <Button onClick={handleCreate} variant="outline" className="mt-4">
              Criar primeira planilha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {sheets.map((sheet) => (
            <Card
              key={sheet.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedSheetId(sheet.id)}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  {editingTitle === sheet.id ? (
                    <Input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onBlur={() => handleRename(sheet.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(sheet.id);
                        if (e.key === 'Escape') setEditingTitle(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="h-7 w-48"
                    />
                  ) : (
                    <span className="font-medium">{sheet.title}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(sheet.updated_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewTitle(sheet.title);
                      setEditingTitle(sheet.id);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Excluir esta planilha?')) {
                        deleteSheet(sheet.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sheet Editor Dialog */}
      <Dialog open={!!selectedSheetId} onOpenChange={(open) => !open && setSelectedSheetId(null)}>
        <DialogContent className="max-w-[95vw] w-[1200px] h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {sheets.find((s) => s.id === selectedSheetId)?.title || 'Planilha'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {selectedSheetId && <SpreadsheetEditor sheetId={selectedSheetId} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
