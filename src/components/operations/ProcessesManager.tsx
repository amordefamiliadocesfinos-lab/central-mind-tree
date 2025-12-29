import { useState, useEffect } from 'react';
import { useProcesses, Process } from '@/hooks/useProcesses';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/ui/decimal-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Cog } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

export function ProcessesManager() {
  const { processes, loading, createProcess, updateProcess, deleteProcess } = useProcesses();
  const [showForm, setShowForm] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [valueText, setValueText] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    unit: 'un',
    value_per_unit: 0,
    is_active: true,
    description: '',
  });

  useEffect(() => {
    if (editingProcess) {
      setFormData({
        name: editingProcess.name,
        unit: editingProcess.unit,
        value_per_unit: editingProcess.value_per_unit,
        is_active: editingProcess.is_active,
        description: editingProcess.description || '',
      });
      setValueText(String(editingProcess.value_per_unit ?? 0));
    } else {
      setFormData({
        name: '',
        unit: 'un',
        value_per_unit: 0,
        is_active: true,
        description: '',
      });
      setValueText('0');
    }
  }, [editingProcess]);

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    if (editingProcess) {
      await updateProcess(editingProcess.id, formData);
    } else {
      await createProcess(formData);
    }

    setShowForm(false);
    setEditingProcess(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Excluir este processo?')) {
      await deleteProcess(id);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground text-center py-4">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Cog className="h-5 w-5" />
          Processos ({processes.length})
        </h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo
        </Button>
      </div>

      <div className="space-y-2">
        {processes.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Nenhum processo cadastrado</p>
          </Card>
        ) : (
          processes.map((process) => (
            <Card 
              key={process.id}
              className={cn(
                "cursor-pointer hover:bg-muted/50 transition-colors",
                !process.is_active && "opacity-60"
              )}
              onClick={() => {
                setEditingProcess(process);
                setShowForm(true);
              }}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{process.name}</span>
                      {!process.is_active && (
                        <Badge variant="secondary" className="text-xs">Inativo</Badge>
                      )}
                    </div>
                    {process.description && (
                      <p className="text-sm text-muted-foreground">{process.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">
                      {formatCurrency(process.value_per_unit)}
                    </p>
                    <p className="text-xs text-muted-foreground">por {process.unit}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => {
        setShowForm(open);
        if (!open) setEditingProcess(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProcess ? 'Editar Processo' : 'Novo Processo'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                className="h-12"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Montagem, Pintura, Embalagem"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unidade</Label>
                <Input
                  className="h-12"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="un, pç, kg"
                />
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <DecimalInput
                  className="h-12"
                  value={valueText}
                  onValueChange={setValueText}
                  onValueCommit={(parsed) => {
                    setFormData({ ...formData, value_per_unit: parsed?.number ?? 0 });
                  }}
                  min={0}
                  maxDecimals={10}
                />
              </div>
            </div>

            <div>
              <Label>Descrição</Label>
              <Input
                className="h-12"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <div className="flex gap-2">
              {editingProcess && (
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    handleDelete(editingProcess.id);
                    setShowForm(false);
                    setEditingProcess(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              )}
              <Button className="flex-1" onClick={handleSave}>
                {editingProcess ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
