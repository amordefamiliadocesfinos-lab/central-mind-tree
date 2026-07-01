import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Pencil, Save, X, GripVertical, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { FOCUS_TYPES, FocusType } from '@/hooks/useRoutine';

interface MTBlock {
  start: string;
  end: string;
  title: string;
  focus: string;
  block_type: string;
  duration_minutes: number;
  notes?: string;
  checklist?: { text: string; done: boolean }[];
}

interface MT {
  id: string;
  area: string;
  name: string;
  description: string | null;
  target_role: string | null;
  icon: string | null;
  color: string | null;
  blocks: MTBlock[];
  is_active: boolean;
  is_default: boolean;
  order_index: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

const emptyMT = (): MT => ({
  id: '',
  area: 'gestao',
  name: '',
  description: '',
  target_role: '',
  icon: '📋',
  color: '#3B82F6',
  blocks: [],
  is_active: true,
  is_default: false,
  order_index: 0,
});

const emptyBlock = (): MTBlock => ({
  start: '08:00',
  end: '08:25',
  title: '',
  focus: 'trabalho_profundo',
  block_type: 'foco',
  duration_minutes: 25,
  notes: '',
  checklist: [],
});

function minutesBetween(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

export function MTManagerDialog({ open, onOpenChange, onChanged }: Props) {
  const [list, setList] = useState<MT[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MT | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('routine_mts' as any)
      .select('*')
      .order('order_index');
    if (error) { toast.error('Erro ao carregar MTs'); setLoading(false); return; }
    setList((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { if (open) { load(); setEditing(null); } }, [open]);

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error('Informe um nome'); return; }
    setSaving(true);
    const payload: any = {
      area: editing.area,
      name: editing.name,
      description: editing.description,
      target_role: editing.target_role,
      icon: editing.icon,
      color: editing.color,
      blocks: editing.blocks,
      is_active: editing.is_active,
      is_default: editing.is_default,
      order_index: editing.order_index,
    };
    let err;
    if (editing.id) {
      ({ error: err } = await supabase.from('routine_mts' as any).update(payload).eq('id', editing.id));
    } else {
      ({ error: err } = await supabase.from('routine_mts' as any).insert(payload));
    }
    setSaving(false);
    if (err) { toast.error('Erro: ' + err.message); return; }
    toast.success('MT salva');
    setEditing(null);
    onChanged?.();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta MT?')) return;
    const { error } = await supabase.from('routine_mts' as any).delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('MT excluída');
    onChanged?.();
    load();
  };

  const updBlock = (i: number, patch: Partial<MTBlock>) => {
    if (!editing) return;
    const next = [...editing.blocks];
    next[i] = { ...next[i], ...patch };
    if (patch.start || patch.end) {
      next[i].duration_minutes = minutesBetween(next[i].start, next[i].end) || next[i].duration_minutes;
    }
    setEditing({ ...editing, blocks: next });
  };

  const addBlock = () => editing && setEditing({ ...editing, blocks: [...editing.blocks, emptyBlock()] });
  const removeBlock = (i: number) => editing && setEditing({ ...editing, blocks: editing.blocks.filter((_, idx) => idx !== i) });
  const moveBlock = (i: number, dir: -1 | 1) => {
    if (!editing) return;
    const j = i + dir;
    if (j < 0 || j >= editing.blocks.length) return;
    const next = [...editing.blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setEditing({ ...editing, blocks: next });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2">
            {editing && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            Gerenciar Métodos de Trabalho
          </DialogTitle>
          <DialogDescription className="text-xs">
            Crie, edite ou exclua MTs e seus blocos. Áreas são livres — digite a que quiser.
          </DialogDescription>
        </DialogHeader>

        {!editing ? (
          <>
            <div className="p-3 border-b flex justify-end">
              <Button size="sm" onClick={() => setEditing(emptyMT())}>
                <Plus className="h-4 w-4 mr-1" /> Nova MT
              </Button>
            </div>
            <ScrollArea className="flex-1 p-3">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : list.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhuma MT ainda.</p>
              ) : (
                <div className="space-y-2">
                  {list.map(mt => (
                    <Card key={mt.id}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                          style={{ backgroundColor: (mt.color || '#3B82F6') + '20', color: mt.color || '#3B82F6' }}>
                          {mt.icon || '📋'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-sm">{mt.name}</h3>
                            <Badge variant="secondary" className="text-[10px]">{mt.area}</Badge>
                            {!mt.is_active && <Badge variant="outline" className="text-[10px]">inativo</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{mt.blocks.length} blocos</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(mt)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(mt.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Nome</Label>
                    <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Área</Label>
                    <Input value={editing.area} onChange={e => setEditing({ ...editing, area: e.target.value })}
                      placeholder="gestao, comercial, operacional, ..." />
                  </div>
                  <div>
                    <Label>Papel-alvo</Label>
                    <Input value={editing.target_role || ''} onChange={e => setEditing({ ...editing, target_role: e.target.value })} />
                  </div>
                  <div>
                    <Label>Ícone (emoji)</Label>
                    <Input value={editing.icon || ''} onChange={e => setEditing({ ...editing, icon: e.target.value })} />
                  </div>
                  <div>
                    <Label>Cor</Label>
                    <Input type="color" value={editing.color || '#3B82F6'} onChange={e => setEditing({ ...editing, color: e.target.value })} className="h-10 p-1" />
                  </div>
                  <div className="col-span-2">
                    <Label>Descrição</Label>
                    <Textarea rows={2} value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">Cronograma ({editing.blocks.length} blocos)</Label>
                    <Button size="sm" variant="outline" onClick={addBlock}>
                      <Plus className="h-4 w-4 mr-1" /> Bloco
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {editing.blocks.map((b, i) => (
                      <Card key={i} className="border-dashed">
                        <CardContent className="p-2 space-y-2">
                          <div className="flex items-center gap-1">
                            <div className="flex flex-col">
                              <button onClick={() => moveBlock(i, -1)} className="text-xs text-muted-foreground hover:text-foreground">▲</button>
                              <button onClick={() => moveBlock(i, 1)} className="text-xs text-muted-foreground hover:text-foreground">▼</button>
                            </div>
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <Input className="h-8 flex-1" placeholder="Título do bloco"
                              value={b.title} onChange={e => updBlock(i, { title: e.target.value })} />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeBlock(i)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <Label className="text-[10px]">Início</Label>
                              <Input type="time" className="h-8" value={b.start} onChange={e => updBlock(i, { start: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-[10px]">Fim</Label>
                              <Input type="time" className="h-8" value={b.end} onChange={e => updBlock(i, { end: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-[10px]">Duração (min)</Label>
                              <Input type="number" className="h-8" value={b.duration_minutes}
                                onChange={e => updBlock(i, { duration_minutes: parseInt(e.target.value) || 0 })} />
                            </div>
                            <div>
                              <Label className="text-[10px]">Foco</Label>
                              <Select value={b.focus} onValueChange={v => updBlock(i, { focus: v })}>
                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(FOCUS_TYPES).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{(v as any).icon} {(v as any).label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Textarea rows={2} placeholder="Notas (opcional)" value={b.notes || ''}
                            onChange={e => updBlock(i, { notes: e.target.value })} />
                        </CardContent>
                      </Card>
                    ))}
                    {editing.blocks.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-4">Nenhum bloco. Clique em "Bloco" para adicionar.</p>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
            <div className="border-t p-3 flex gap-2 bg-muted/30">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button className="flex-1" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
