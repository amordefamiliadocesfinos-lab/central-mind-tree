import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useContactHistory, ContactHistoryEntry, INTERACTION_TYPES } from '@/hooks/useContactHistory';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  contactName: string;
}

export function ContactHistoryDialog({ open, onOpenChange, contactId, contactName }: Props) {
  const { entries, loading, fetchHistory, addEntry, updateEntry, deleteEntry } = useContactHistory();
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('observacao');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState('');

  useEffect(() => {
    if (open && contactId) {
      fetchHistory(contactId);
      setShowForm(false);
      setEditingId(null);
      setFormDate(new Date().toISOString().slice(0, 16));
    }
  }, [open, contactId, fetchHistory]);

  const handleAdd = async () => {
    if (!formDesc.trim() || !contactId) return;
    await addEntry(contactId, formType, formDesc.trim(), formDate || new Date().toISOString());
    setFormDesc('');
    setFormType('observacao');
    setFormDate(new Date().toISOString().slice(0, 16));
    setShowForm(false);
  };

  const startEdit = (entry: ContactHistoryEntry) => {
    setEditingId(entry.id);
    setEditType(entry.interaction_type || entry.event_type);
    setEditDesc(entry.description);
    setEditDate(entry.interaction_date ? entry.interaction_date.slice(0, 16) : '');
  };

  const handleEdit = async () => {
    if (!editingId || !contactId) return;
    await updateEntry(editingId, contactId, {
      interaction_type: editType,
      description: editDesc,
      interaction_date: editDate,
    });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!contactId) return;
    await deleteEntry(id, contactId);
  };

  const getTypeInfo = (type: string) => INTERACTION_TYPES.find(t => t.value === type) || { label: type, icon: '📝' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center justify-between">
            <span>Histórico — {contactName}</span>
            {!showForm && (
              <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Nova interação
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Add form */}
        {showForm && (
          <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
            <div className="flex gap-2">
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger className="h-9 text-sm w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERACTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="datetime-local"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="h-9 text-sm flex-1"
              />
            </div>
            <Textarea
              placeholder="Descreva a interação..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="min-h-[60px] text-sm"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAdd} disabled={!formDesc.trim()}>Salvar</Button>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma interação registrada</p>
          ) : (
            <div className="relative pl-8 space-y-3 py-2">
              <div className="absolute left-3 top-4 bottom-4 w-px bg-border" />
              {entries.map((entry) => {
                const typeInfo = getTypeInfo(entry.interaction_type || entry.event_type);
                const isEditing = editingId === entry.id;

                return (
                  <div key={entry.id} className="relative group">
                    {/* Timeline dot */}
                    <div className="absolute -left-8 top-1 w-6 h-6 rounded-full border-2 border-border bg-background flex items-center justify-center text-xs">
                      {typeInfo.icon}
                    </div>

                    {isEditing ? (
                      <div className="space-y-2 border rounded-lg p-2 bg-muted/30">
                        <div className="flex gap-2">
                          <Select value={editType} onValueChange={setEditType}>
                            <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {INTERACTION_TYPES.map(t => (
                                <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-8 text-xs flex-1" />
                        </div>
                        <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="min-h-[40px] text-sm" />
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          <Button size="icon" variant="default" className="h-7 w-7" onClick={handleEdit}><Check className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium text-primary">{typeInfo.label}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {entry.interaction_date
                                  ? format(parseISO(entry.interaction_date), "dd/MM/yy 'às' HH:mm", { locale: ptBR })
                                  : format(parseISO(entry.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{entry.description}</p>
                          </div>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(entry)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive" onClick={() => handleDelete(entry.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
