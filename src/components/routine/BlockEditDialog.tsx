import { useState, useEffect } from 'react';
import { RoutineBlock, FOCUS_TYPES, FocusType, RECURRENCE_OPTIONS, RecurrenceType } from '@/hooks/useRoutine';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface BlockEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block?: RoutineBlock | null;
  onSave: (data: Partial<RoutineBlock>) => void;
  defaultDate?: string;
}

export function BlockEditDialog({
  open,
  onOpenChange,
  block,
  onSave,
  defaultDate,
}: BlockEditDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    focus: 'trabalho_profundo' as FocusType,
    duration_minutes: 25,
    planned_start: '',
    notes: '',
    recurrence: '' as RecurrenceType | '',
  });

  useEffect(() => {
    if (block) {
      setFormData({
        title: block.title,
        focus: (block.focus as FocusType) || 'trabalho_profundo',
        duration_minutes: block.duration_minutes,
        planned_start: block.planned_start || '',
        notes: block.notes || '',
        recurrence: (block.recurrence as RecurrenceType | null) || '',
      });
    } else {
      // Default values for new block
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const mins = Math.ceil(now.getMinutes() / 5) * 5;
      const adjustedMins = mins >= 60 ? '00' : mins.toString().padStart(2, '0');
      const adjustedHours = mins >= 60 ? (now.getHours() + 1).toString().padStart(2, '0') : hours;
      
      setFormData({
        title: '',
        focus: 'trabalho_profundo',
        duration_minutes: 25,
        planned_start: `${adjustedHours}:${adjustedMins}`,
        notes: '',
        recurrence: '',
      });
    }
  }, [block, open]);

  const handleSubmit = () => {
    const { recurrence, ...rest } = formData;
    onSave({
      ...rest,
      recurrence: (recurrence === '' ? null : recurrence) as RecurrenceType | null,
      date: block?.date || defaultDate,
    });
    onOpenChange(false);
  };

  const quickDurations = [25, 50, 90, 120];

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={block ? 'Editar Bloco' : 'Novo Bloco'}
    >
      <div className="space-y-4 p-4 sm:p-0">
        {/* Title */}
        <div>
          <Label>Título</Label>
          <Input
            className="h-12"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Nome do bloco"
          />
        </div>

        {/* Focus Type */}
        <div>
          <Label>Tipo de Foco</Label>
          <Select
            value={formData.focus}
            onValueChange={(v) => setFormData({ ...formData, focus: v as FocusType })}
          >
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FOCUS_TYPES).map(([key, { label, icon, color }]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <div className={cn('w-3 h-3 rounded-full', color)} />
                    <span>{icon} {label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Duration */}
        <div>
          <Label>Duração</Label>
          <div className="flex gap-2 mb-2">
            {quickDurations.map((d) => (
              <Button
                key={d}
                type="button"
                variant={formData.duration_minutes === d ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormData({ ...formData, duration_minutes: d })}
                className="flex-1"
              >
                {d}min
              </Button>
            ))}
          </div>
          <Input
            type="number"
            className="h-12"
            value={formData.duration_minutes}
            onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 25 })}
            min={5}
            max={480}
          />
        </div>

        {/* Start Time */}
        <div>
          <Label>Horário de Início</Label>
          <Input
            type="time"
            className="h-12"
            value={formData.planned_start}
            onChange={(e) => setFormData({ ...formData, planned_start: e.target.value })}
          />
        </div>

        {/* Recurrence */}
        <div>
          <Label>Recorrência</Label>
          <Select
            value={formData.recurrence || 'none'}
            onValueChange={(v) => setFormData({ ...formData, recurrence: (v === 'none' ? '' : v) as RecurrenceType | '' })}
          >
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECURRENCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value || 'none'} value={opt.value || 'none'}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formData.recurrence && (
            <p className="text-xs text-muted-foreground mt-1">
              Ao concluir, o próximo horário é agendado automaticamente.
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <Label>Observações (opcional)</Label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Anotações sobre este bloco..."
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="flex-1 h-12"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button 
            className="flex-1 h-12"
            onClick={handleSubmit}
            disabled={!formData.title.trim()}
          >
            {block ? 'Salvar' : 'Adicionar'}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
