import { useState } from 'react';
import { useIdeaTypes, IdeaType } from '@/hooks/useIdeaTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLOR_OPTIONS = [
  { label: 'Azul', value: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  { label: 'Laranja', value: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30' },
  { label: 'Verde', value: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  { label: 'Roxo', value: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30' },
  { label: 'Vermelho', value: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30' },
  { label: 'Rosa', value: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30' },
  { label: 'Amarelo', value: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30' },
  { label: 'Ciano', value: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30' },
];

export function IdeaTypesManager() {
  const { ideaTypes, createType, updateType, deleteType } = useIdeaTypes();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: '', icon: '📌', color: COLOR_OPTIONS[0].value });

  const handleCreate = async () => {
    if (!form.label.trim()) return;
    const result = await createType(form);
    if (result) {
      setForm({ label: '', icon: '📌', color: COLOR_OPTIONS[0].value });
      setAdding(false);
    }
  };

  const handleUpdate = async (type: IdeaType) => {
    await updateType(type.id, { label: form.label, icon: form.icon, color: form.color });
    setEditingId(null);
  };

  const startEdit = (type: IdeaType) => {
    setEditingId(type.id);
    setForm({ label: type.label, icon: type.icon, color: type.color });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Tipos de Ideia</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => { setAdding(!adding); setEditingId(null); }}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Tipo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Add form */}
        {adding && (
          <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
            <div className="flex gap-2">
              <Input
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="w-14 text-center"
                placeholder="📌"
              />
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Nome do tipo"
                className="flex-1"
                autoFocus
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setForm({ ...form, color: c.value })}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] border transition-all',
                    c.value,
                    form.color === c.value && 'ring-2 ring-ring ring-offset-1'
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!form.label.trim()}>
                <Check className="h-3 w-3 mr-1" /> Criar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                <X className="h-3 w-3 mr-1" /> Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Type list */}
        {ideaTypes.map(type => (
          <div key={type.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
            {editingId === type.id ? (
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className="w-14 text-center h-8"
                  />
                  <Input
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    className="flex-1 h-8"
                    autoFocus
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setForm({ ...form, color: c.value })}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] border transition-all',
                        c.value,
                        form.color === c.value && 'ring-2 ring-ring ring-offset-1'
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={() => handleUpdate(type)} className="h-7 text-xs">
                    <Check className="h-3 w-3 mr-1" /> Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs">
                    <X className="h-3 w-3 mr-1" /> Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Badge variant="outline" className={cn('text-xs gap-1 border', type.color)}>
                  <span>{type.icon}</span>
                  {type.label}
                </Badge>
                {type.is_default && (
                  <span className="text-[10px] text-muted-foreground">padrão</span>
                )}
                <div className="ml-auto flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(type)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  {!type.is_default && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteType(type.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
