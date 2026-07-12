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
import { Loader2, Plus, Trash2, Pencil, Save, X, GripVertical, ArrowLeft, ArrowUp, ArrowDown, Copy, ListChecks, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { FOCUS_TYPES } from '@/hooks/useRoutine';
import { MODULE_CATALOG } from './MTWorkspaceBar';

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
  priority_modules: string[];
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
  priority_modules: [],
});

const emptyBlock = (start = '08:00'): MTBlock => {
  const [h, m] = start.split(':').map(Number);
  const endMin = h * 60 + m + 25;
  const eh = Math.floor(endMin / 60) % 24;
  const em = endMin % 60;
  return {
    start,
    end: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
    title: '',
    focus: 'trabalho_profundo',
    block_type: 'foco',
    duration_minutes: 25,
    notes: '',
    checklist: [],
  };
};

function minutesBetween(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function normalizeMT(mt: any): MT {
  const blocks = Array.isArray(mt?.blocks) ? mt.blocks : [];
  return {
    id: mt?.id || '',
    area: mt?.area || 'gestao',
    name: mt?.name || '',
    description: mt?.description ?? '',
    target_role: mt?.target_role ?? '',
    icon: mt?.icon || '📋',
    color: mt?.color || '#3B82F6',
    blocks: blocks.map((b: any) => ({
      start: b?.start || '08:00',
      end: b?.end || '08:25',
      title: b?.title || '',
      focus: b?.focus || 'trabalho_profundo',
      block_type: b?.block_type || 'foco',
      duration_minutes: b?.duration_minutes ?? minutesBetween(b?.start || '08:00', b?.end || '08:25') ?? 25,
      notes: b?.notes || '',
      checklist: Array.isArray(b?.checklist) ? b.checklist : [],
    })),
    is_active: mt?.is_active ?? true,
    is_default: mt?.is_default ?? false,
    order_index: mt?.order_index ?? 0,
    priority_modules: Array.isArray(mt?.priority_modules) ? mt.priority_modules : [],
  };
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
    setList(((data as any[]) || []).map(normalizeMT));
    setLoading(false);
  };

  useEffect(() => { if (open) { load(); setEditing(null); } }, [open]);

  const startEdit = (mt: MT) => setEditing(normalizeMT(mt));

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
      priority_modules: editing.priority_modules || [],
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
    if (!confirm('Arquivar esta MT?')) return;
    const { error } = await supabase.from('routine_mts' as any).update({ is_active: false }).eq('id', id);
    if (error) { toast.error('Erro ao arquivar'); return; }
    toast.success('MT arquivada');
    onChanged?.();
    load();
  };

  const duplicate = async (mt: MT) => {
    const payload: any = {
      area: mt.area, name: mt.name + ' (cópia)', description: mt.description,
      target_role: mt.target_role, icon: mt.icon, color: mt.color,
      blocks: mt.blocks, is_active: mt.is_active, is_default: false, order_index: mt.order_index + 1,
    };
    const { error } = await supabase.from('routine_mts' as any).insert(payload);
    if (error) { toast.error('Erro ao duplicar'); return; }
    toast.success('MT duplicada');
    load();
  };

  const updBlock = (i: number, patch: Partial<MTBlock>) => {
    if (!editing) return;
    const next = [...editing.blocks];
    next[i] = { ...next[i], ...patch };
    if (patch.start !== undefined || patch.end !== undefined) {
      const d = minutesBetween(next[i].start, next[i].end);
      if (d > 0) next[i].duration_minutes = d;
    }
    setEditing({ ...editing, blocks: next });
  };

  const addBlock = () => {
    if (!editing) return;
    const last = editing.blocks[editing.blocks.length - 1];
    const start = last?.end || '08:00';
    setEditing({ ...editing, blocks: [...editing.blocks, emptyBlock(start)] });
  };
  const removeBlock = (i: number) => editing && setEditing({ ...editing, blocks: editing.blocks.filter((_, idx) => idx !== i) });
  const dupBlock = (i: number) => {
    if (!editing) return;
    const next = [...editing.blocks];
    next.splice(i + 1, 0, { ...editing.blocks[i] });
    setEditing({ ...editing, blocks: next });
  };
  const moveBlock = (i: number, dir: -1 | 1) => {
    if (!editing) return;
    const j = i + dir;
    if (j < 0 || j >= editing.blocks.length) return;
    const next = [...editing.blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setEditing({ ...editing, blocks: next });
  };

  const addChecklist = (i: number) => {
    if (!editing) return;
    const next = [...editing.blocks];
    next[i] = { ...next[i], checklist: [...(next[i].checklist || []), { text: '', done: false }] };
    setEditing({ ...editing, blocks: next });
  };
  const updChecklist = (bi: number, ci: number, text: string) => {
    if (!editing) return;
    const next = [...editing.blocks];
    const cl = [...(next[bi].checklist || [])];
    cl[ci] = { ...cl[ci], text };
    next[bi] = { ...next[bi], checklist: cl };
    setEditing({ ...editing, blocks: next });
  };
  const rmChecklist = (bi: number, ci: number) => {
    if (!editing) return;
    const next = [...editing.blocks];
    next[bi] = { ...next[bi], checklist: (next[bi].checklist || []).filter((_, i) => i !== ci) };
    setEditing({ ...editing, blocks: next });
  };

  const totalMin = editing?.blocks.reduce((s, b) => s + (b.duration_minutes || 0), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[96vw] h-[94vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            {editing && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {editing ? (editing.id ? `Editar: ${editing.name || 'MT'}` : 'Nova Método de Trabalho') : 'Gerenciar Métodos de Trabalho'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {editing
              ? `${editing.blocks.length} blocos • ${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')} totais`
              : 'Crie, edite, duplique ou exclua MTs e seus cronogramas.'}
          </DialogDescription>
        </DialogHeader>

        {!editing ? (
          <>
            <div className="p-3 border-b flex justify-between items-center shrink-0">
              <span className="text-sm text-muted-foreground">{list.length} MT(s)</span>
              <Button size="sm" onClick={() => setEditing(emptyMT())}>
                <Plus className="h-4 w-4 mr-1" /> Nova MT
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : list.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhuma MT ainda.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {list.map(mt => (
                    <Card key={mt.id} className="hover:border-primary/40 transition-colors">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="h-11 w-11 rounded-lg flex items-center justify-center text-xl shrink-0"
                          style={{ backgroundColor: (mt.color || '#3B82F6') + '20', color: mt.color || '#3B82F6' }}>
                          {mt.icon || '📋'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-sm truncate">{mt.name}</h3>
                            <Badge variant="secondary" className="text-[10px]">{mt.area}</Badge>
                            {!mt.is_active && <Badge variant="outline" className="text-[10px]">inativo</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{mt.blocks.length} blocos</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(mt)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicate(mt)} title="Duplicar">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(mt.id)} title="Arquivar">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-4 grid gap-4 lg:grid-cols-[320px_1fr]">
                {/* Metadata */}
                <div className="space-y-3 lg:border-r lg:pr-4">
                  <div>
                    <Label className="text-xs">Nome</Label>
                    <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Ícone</Label>
                      <Input value={editing.icon || ''} onChange={e => setEditing({ ...editing, icon: e.target.value })} placeholder="📋" />
                    </div>
                    <div>
                      <Label className="text-xs">Cor</Label>
                      <Input type="color" value={editing.color || '#3B82F6'} onChange={e => setEditing({ ...editing, color: e.target.value })} className="h-10 p-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Área</Label>
                    <Input value={editing.area} onChange={e => setEditing({ ...editing, area: e.target.value })}
                      placeholder="gestao, comercial, ..." />
                  </div>
                  <div>
                    <Label className="text-xs">Papel-alvo</Label>
                    <Input value={editing.target_role || ''} onChange={e => setEditing({ ...editing, target_role: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Descrição</Label>
                    <Textarea rows={3} value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
                  </div>

                  <div className="pt-2 border-t">
                    <Label className="text-xs flex items-center gap-1 mb-1.5">
                      <LayoutGrid className="h-3 w-3" /> Área de Trabalho (módulos em destaque)
                    </Label>
                    <p className="text-[10px] text-muted-foreground mb-2">
                      Marque os módulos mais usados nesta função. Aparecerão em destaque no Dashboard quando este MT estiver ativo.
                    </p>
                    <div className="grid grid-cols-2 gap-1 max-h-56 overflow-y-auto pr-1">
                      {Object.entries(MODULE_CATALOG).map(([key, info]) => {
                        const checked = editing.priority_modules?.includes(key);
                        return (
                          <label key={key} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-accent cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!checked}
                              onChange={e => {
                                const cur = editing.priority_modules || [];
                                const next = e.target.checked
                                  ? [...cur, key]
                                  : cur.filter(k => k !== key);
                                setEditing({ ...editing, priority_modules: next });
                              }}
                            />
                            <span className="truncate">{info.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} />
                      Ativa
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={editing.is_default} onChange={e => setEditing({ ...editing, is_default: e.target.checked })} />
                      Padrão
                    </label>
                  </div>
                </div>


                {/* Blocks */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between sticky top-0 bg-background pb-2 z-10">
                    <div>
                      <Label className="text-sm font-semibold">Cronograma</Label>
                      <p className="text-xs text-muted-foreground">{editing.blocks.length} blocos • {Math.floor(totalMin / 60)}h{String(totalMin % 60).padStart(2, '0')}</p>
                    </div>
                    <Button size="sm" onClick={addBlock}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar Bloco
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {editing.blocks.map((b, i) => (
                      <Card key={i} className="border-l-4" style={{ borderLeftColor: (FOCUS_TYPES as any)[b.focus]?.color || '#3B82F6' }}>
                        <CardContent className="p-3 space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-0.5">
                              <button onClick={() => moveBlock(i, -1)} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === 0}>
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button onClick={() => moveBlock(i, 1)} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === editing.blocks.length - 1}>
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>
                            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground font-mono shrink-0">#{i + 1}</span>
                            <Input className="h-9 flex-1 font-medium" placeholder="Título do bloco"
                              value={b.title} onChange={e => updBlock(i, { title: e.target.value })} />
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => dupBlock(i)} title="Duplicar">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeBlock(i)} title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <Label className="text-[10px]">Início</Label>
                              <Input type="time" className="h-9" value={b.start} onChange={e => updBlock(i, { start: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-[10px]">Fim</Label>
                              <Input type="time" className="h-9" value={b.end} onChange={e => updBlock(i, { end: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-[10px]">Duração (min)</Label>
                              <Input type="number" className="h-9" value={b.duration_minutes}
                                onChange={e => updBlock(i, { duration_minutes: parseInt(e.target.value) || 0 })} />
                            </div>
                            <div>
                              <Label className="text-[10px]">Foco</Label>
                              <Select value={b.focus} onValueChange={v => updBlock(i, { focus: v })}>
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(FOCUS_TYPES).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{(v as any).icon} {(v as any).label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <Textarea rows={2} placeholder="Notas (opcional)" value={b.notes || ''}
                            onChange={e => updBlock(i, { notes: e.target.value })} className="text-sm" />

                          <div className="space-y-1.5 pt-1 border-t">
                            <div className="flex items-center justify-between">
                              <Label className="text-[11px] flex items-center gap-1">
                                <ListChecks className="h-3 w-3" /> Checklist ({(b.checklist || []).length})
                              </Label>
                              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => addChecklist(i)}>
                                <Plus className="h-3 w-3 mr-1" /> Item
                              </Button>
                            </div>
                            {(b.checklist || []).map((c, ci) => (
                              <div key={ci} className="flex items-center gap-1">
                                <Input className="h-7 text-xs" placeholder="Item do checklist"
                                  value={c.text} onChange={e => updChecklist(i, ci, e.target.value)} />
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => rmChecklist(i, ci)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {editing.blocks.length === 0 && (
                      <div className="text-center py-10 border-2 border-dashed rounded-lg">
                        <p className="text-sm text-muted-foreground mb-3">Nenhum bloco no cronograma.</p>
                        <Button size="sm" variant="outline" onClick={addBlock}>
                          <Plus className="h-4 w-4 mr-1" /> Adicionar primeiro bloco
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t p-3 flex gap-2 bg-muted/30 shrink-0">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button className="flex-1" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar MT
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
