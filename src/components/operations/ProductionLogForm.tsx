import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProductionLog, PRODUCTION_PERIODS, PRODUCTION_PROCESSES, PROCESS_LABELS } from '@/hooks/useProductionLogs';
import { Product } from '@/hooks/useOrders';
import { AlertTriangle } from 'lucide-react';

interface ProductionLogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log?: ProductionLog | null;
  products: Product[];
  employees: string[];
  onSave: (log: Omit<ProductionLog, 'id' | 'created_at' | 'updated_at' | 'product'>) => Promise<ProductionLog | null>;
  onUpdate?: (id: string, log: Partial<ProductionLog>) => Promise<ProductionLog | null>;
  onDelete?: (id: string) => Promise<boolean>;
  defaultDate?: string;
}

export function ProductionLogForm({
  open,
  onOpenChange,
  log,
  products,
  employees,
  onSave,
  onUpdate,
  onDelete,
  defaultDate,
}: ProductionLogFormProps) {
  const [formData, setFormData] = useState({
    date: defaultDate || new Date().toISOString().split('T')[0],
    period: 'manha' as 'manha' | 'tarde' | 'noite',
    employee_name: '',
    process: 'producao',
    product_id: null as string | null,
    quantity: 0,
    notes: '',
    warnings: '',
    order_id: null as string | null,
  });
  const [saving, setSaving] = useState(false);
  const [newEmployee, setNewEmployee] = useState('');
  const [showNewEmployee, setShowNewEmployee] = useState(false);

  useEffect(() => {
    if (log) {
      setFormData({
        date: log.date,
        period: log.period,
        employee_name: log.employee_name,
        process: log.process,
        product_id: log.product_id,
        quantity: log.quantity,
        notes: log.notes || '',
        warnings: log.warnings || '',
        order_id: log.order_id,
      });
    } else {
      setFormData({
        date: defaultDate || new Date().toISOString().split('T')[0],
        period: 'manha',
        employee_name: '',
        process: 'producao',
        product_id: null,
        quantity: 0,
        notes: '',
        warnings: '',
        order_id: null,
      });
    }
  }, [log, defaultDate, open]);

  const handleSave = async () => {
    if (!formData.employee_name || formData.quantity <= 0) {
      return;
    }

    setSaving(true);
    if (log && onUpdate) {
      await onUpdate(log.id, formData);
    } else {
      await onSave(formData);
    }
    setSaving(false);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!log || !onDelete) return;
    if (confirm('Excluir este lançamento?')) {
      await onDelete(log.id);
      onOpenChange(false);
    }
  };

  const handleEmployeeChange = (value: string) => {
    if (value === '_new') {
      setShowNewEmployee(true);
    } else {
      setFormData({ ...formData, employee_name: value });
      setShowNewEmployee(false);
    }
  };

  const handleAddNewEmployee = () => {
    if (newEmployee.trim()) {
      setFormData({ ...formData, employee_name: newEmployee.trim() });
      setShowNewEmployee(false);
      setNewEmployee('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {log ? 'Editar Lançamento' : 'Novo Lançamento'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                className="h-12"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Período</Label>
              <Select
                value={formData.period}
                onValueChange={(v: 'manha' | 'tarde' | 'noite') => setFormData({ ...formData, period: v })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRODUCTION_PERIODS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Funcionário</Label>
            {showNewEmployee ? (
              <div className="flex gap-2">
                <Input
                  className="h-12 flex-1"
                  placeholder="Nome do novo funcionário"
                  value={newEmployee}
                  onChange={(e) => setNewEmployee(e.target.value)}
                />
                <Button onClick={handleAddNewEmployee} className="h-12">
                  Adicionar
                </Button>
              </div>
            ) : (
              <Select
                value={formData.employee_name || ''}
                onValueChange={handleEmployeeChange}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                  ))}
                  <SelectItem value="_new" className="text-primary">
                    + Novo funcionário
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label>Processo</Label>
            <Select
              value={formData.process}
              onValueChange={(v) => setFormData({ ...formData, process: v })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCTION_PROCESSES.map((proc) => (
                  <SelectItem key={proc} value={proc}>{PROCESS_LABELS[proc]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Produto (opcional)</Label>
            <Select
              value={formData.product_id || ''}
              onValueChange={(v) => setFormData({ ...formData, product_id: v || null })}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Quantidade</Label>
            <Input
              type="number"
              className="h-12 text-lg"
              value={formData.quantity || ''}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <div>
            <Label className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Avisos
            </Label>
            <Textarea
              value={formData.warnings || ''}
              onChange={(e) => setFormData({ ...formData, warnings: e.target.value })}
              rows={2}
              placeholder="Problemas, alertas..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              onClick={handleSave} 
              disabled={saving || !formData.employee_name || formData.quantity <= 0} 
              className="flex-1 h-12"
            >
              {saving ? 'Salvando...' : log ? 'Atualizar' : 'Criar Lançamento'}
            </Button>
            {log && onDelete && (
              <Button variant="destructive" onClick={handleDelete} className="h-12">
                Excluir
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
