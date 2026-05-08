import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { useProductCategories, ProductCategory } from '@/hooks/useProductCategories';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ProductCategoriesManager({ open, onOpenChange }: Props) {
  const { categories, createCategory, updateCategory, deleteCategory, loading } = useProductCategories();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const result = await createCategory(newName);
    setCreating(false);
    if (result) setNewName('');
  };

  const startEdit = (cat: ProductCategory) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    await updateCategory(editingId, { name: editingName.trim() });
    setEditingId(null);
  };

  const handleDelete = async (cat: ProductCategory) => {
    if (!confirm(`Excluir a categoria "${cat.name}"?`)) return;
    await deleteCategory(cat.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Nome da nova categoria"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        <div className="space-y-1 max-h-[50vh] overflow-y-auto">
          {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!loading && categories.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma categoria.</p>
          )}
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
              {editingId === cat.id ? (
                <>
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    autoFocus
                    className="h-8"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={saveEdit}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{cat.name}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(cat)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(cat)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
