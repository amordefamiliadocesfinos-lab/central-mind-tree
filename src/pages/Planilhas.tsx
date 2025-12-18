import React, { useState } from 'react';
import { useSheets, Sheet } from '@/hooks/useSpreadsheet';
import { SpreadsheetEditor } from '@/components/SpreadsheetEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, FileSpreadsheet, Trash2, Pencil, Search, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

export default function Planilhas() {
  const { sheets, isLoading, createSheet, deleteSheet, updateSheet } = useSheets({});
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreate = async () => {
    const sheet = await createSheet({});
    setSelectedSheetId(sheet.id);
  };

  const handleRename = async (id: string) => {
    if (newTitle.trim()) {
      await updateSheet(id, { title: newTitle.trim() });
    }
    setEditingTitle(null);
    setNewTitle('');
  };

  const filteredSheets = sheets.filter((sheet) =>
    sheet.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-muted-foreground">Carregando planilhas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 pb-20">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Planilhas</h1>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Planilha
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar planilhas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sheets List */}
        {filteredSheets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileSpreadsheet className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">
                {searchQuery ? 'Nenhuma planilha encontrada' : 'Nenhuma planilha criada'}
              </p>
              {!searchQuery && (
                <Button onClick={handleCreate} variant="outline" className="mt-4">
                  Criar primeira planilha
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredSheets.map((sheet) => (
              <Card
                key={sheet.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedSheetId(sheet.id)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <FileSpreadsheet className="h-6 w-6 text-primary" />
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
                        className="h-8 w-64"
                      />
                    ) : (
                      <div>
                        <span className="font-medium text-lg">{sheet.title}</span>
                        <p className="text-sm text-muted-foreground">
                          Atualizado em {format(new Date(sheet.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
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
    </div>
  );
}
