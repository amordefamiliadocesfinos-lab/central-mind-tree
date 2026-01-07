import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Loader2, Tag } from 'lucide-react';
import { FinancialCategory } from '@/hooks/useFinancial';
import { useToast } from '@/hooks/use-toast';

interface CategoriesManagerProps {
  categories: FinancialCategory[];
  onSave: (category: Partial<FinancialCategory> & { name: string; type: string }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const COLORS = [
  { label: 'Verde', value: '#22c55e' },
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Vermelho', value: '#ef4444' },
  { label: 'Amarelo', value: '#eab308' },
  { label: 'Roxo', value: '#a855f7' },
  { label: 'Rosa', value: '#ec4899' },
  { label: 'Laranja', value: '#f97316' },
  { label: 'Cinza', value: '#6b7280' },
];

export function CategoriesManager({ categories, onSave, onDelete }: CategoriesManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const [form, setForm] = useState({
    name: '',
    type: 'ambos' as 'pagar' | 'receber' | 'ambos',
    color: '#3b82f6',
  });

  const handleOpenDialog = (category?: FinancialCategory) => {
    if (category) {
      setEditingCategory(category);
      setForm({
        name: category.name,
        type: category.type,
        color: category.color || '#3b82f6',
      });
    } else {
      setEditingCategory(null);
      setForm({
        name: '',
        type: 'ambos',
        color: '#3b82f6',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Nome é obrigatório' });
      return;
    }

    setLoading(true);
    try {
      await onSave({
        id: editingCategory?.id,
        name: form.name.trim(),
        type: form.type,
        color: form.color,
        is_active: true,
      });
      toast({ title: editingCategory ? 'Categoria atualizada!' : 'Categoria criada!' });
      setDialogOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao salvar categoria' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!onDelete) return;
    if (!confirm('Deseja realmente excluir esta categoria?')) return;

    try {
      await onDelete(id);
      toast({ title: 'Categoria excluída!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao excluir categoria' });
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'pagar': return 'A Pagar';
      case 'receber': return 'A Receber';
      default: return 'Ambos';
    }
  };

  const categoriesPagar = categories.filter(c => c.type === 'pagar');
  const categoriesReceber = categories.filter(c => c.type === 'receber');
  const categoriesAmbos = categories.filter(c => c.type === 'ambos');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Categorias</h2>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nova Categoria
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Categorias A Pagar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="h-4 w-4 text-red-500" />
              A Pagar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {categoriesPagar.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma categoria</p>
            )}
            {categoriesPagar.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: cat.color || '#6b7280' }}
                  />
                  <span className="text-sm">{cat.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleOpenDialog(cat)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Categorias A Receber */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="h-4 w-4 text-green-500" />
              A Receber
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {categoriesReceber.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma categoria</p>
            )}
            {categoriesReceber.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: cat.color || '#6b7280' }}
                  />
                  <span className="text-sm">{cat.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleOpenDialog(cat)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Categorias Ambos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="h-4 w-4 text-blue-500" />
              Ambos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {categoriesAmbos.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma categoria</p>
            )}
            {categoriesAmbos.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: cat.color || '#6b7280' }}
                  />
                  <span className="text-sm">{cat.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleOpenDialog(cat)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Dialog para criar/editar categoria */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Fornecedores"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select 
                value={form.type} 
                onValueChange={(v) => setForm({ ...form, type: v as 'pagar' | 'receber' | 'ambos' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagar">A Pagar</SelectItem>
                  <SelectItem value="receber">A Receber</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setForm({ ...form, color: color.value })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      form.color === color.value ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
