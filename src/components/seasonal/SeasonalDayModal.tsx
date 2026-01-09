import { useState, useEffect } from 'react';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SeasonalDay } from '@/hooks/useSeasonalDays';
import { Trash2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface SeasonalDayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonalDay?: SeasonalDay | null;
  defaultDate?: string;
  onSave: (data: Omit<SeasonalDay, 'id' | 'created_at' | 'updated_at'>) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
}

const COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const WEEKDAYS = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado',
];

const NTH_OPTIONS = [
  { value: 1, label: '1º' },
  { value: 2, label: '2º' },
  { value: 3, label: '3º' },
  { value: 4, label: '4º' },
  { value: -1, label: 'Último' },
];

export const SeasonalDayModal = ({
  open,
  onOpenChange,
  seasonalDay,
  defaultDate,
  onSave,
  onDelete,
}: SeasonalDayModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    color: '#F59E0B',
    importance: 2,
    recurrence_type: 'fixed' as 'fixed' | 'nth_weekday' | 'range',
    month: 1,
    day: 1,
    end_month: 1,
    end_day: 1,
    nth_occurrence: 1,
    weekday: 1,
    prep_days: 0,
    reminders: [] as string[],
    auto_tasks: false,
    auto_task_templates: [] as { title: string; status: string }[],
    notes: '',
    is_active: true,
  });

  const [newReminder, setNewReminder] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (seasonalDay) {
      setFormData({
        name: seasonalDay.name,
        color: seasonalDay.color,
        importance: seasonalDay.importance,
        recurrence_type: seasonalDay.recurrence_type,
        month: seasonalDay.month || 1,
        day: seasonalDay.day || 1,
        end_month: seasonalDay.end_month || 1,
        end_day: seasonalDay.end_day || 1,
        nth_occurrence: seasonalDay.nth_occurrence || 1,
        weekday: seasonalDay.weekday || 1,
        prep_days: seasonalDay.prep_days,
        reminders: seasonalDay.reminders || [],
        auto_tasks: seasonalDay.auto_tasks,
        auto_task_templates: seasonalDay.auto_task_templates || [],
        notes: seasonalDay.notes || '',
        is_active: seasonalDay.is_active,
      });
    } else if (defaultDate) {
      const [year, month, day] = defaultDate.split('-').map(Number);
      setFormData((prev) => ({
        ...prev,
        month,
        day,
        name: '',
        color: '#F59E0B',
        importance: 2,
        recurrence_type: 'fixed',
        prep_days: 0,
        reminders: [],
        auto_tasks: false,
        auto_task_templates: [],
        notes: '',
        is_active: true,
      }));
    }
  }, [seasonalDay, defaultDate, open]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Preencha o nome do dia sazonal');
      return;
    }

    setSaving(true);
    const success = await onSave({
      name: formData.name.trim(),
      color: formData.color,
      importance: formData.importance,
      recurrence_type: formData.recurrence_type,
      month: formData.month,
      day: formData.recurrence_type !== 'nth_weekday' ? formData.day : null,
      end_month: formData.recurrence_type === 'range' ? formData.end_month : null,
      end_day: formData.recurrence_type === 'range' ? formData.end_day : null,
      nth_occurrence: formData.recurrence_type === 'nth_weekday' ? formData.nth_occurrence : null,
      weekday: formData.recurrence_type === 'nth_weekday' ? formData.weekday : null,
      prep_days: formData.prep_days,
      reminders: formData.reminders,
      auto_tasks: formData.auto_tasks,
      auto_task_templates: formData.auto_task_templates,
      notes: formData.notes || null,
      is_active: formData.is_active,
    });

    setSaving(false);
    if (success) {
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!seasonalDay?.id || !onDelete) return;
    
    if (!confirm('Deseja excluir este dia sazonal?')) return;
    
    const success = await onDelete(seasonalDay.id);
    if (success) {
      toast.success('Dia sazonal excluído');
      onOpenChange(false);
    } else {
      toast.error('Erro ao excluir');
    }
  };

  const addReminder = () => {
    if (newReminder.trim()) {
      setFormData((prev) => ({
        ...prev,
        reminders: [...prev.reminders, newReminder.trim()],
      }));
      setNewReminder('');
    }
  };

  const removeReminder = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      reminders: prev.reminders.filter((_, i) => i !== index),
    }));
  };

  const addTaskTemplate = () => {
    if (newTaskTitle.trim()) {
      setFormData((prev) => ({
        ...prev,
        auto_task_templates: [
          ...prev.auto_task_templates,
          { title: newTaskTitle.trim(), status: 'pendente' },
        ],
      }));
      setNewTaskTitle('');
    }
  };

  const removeTaskTemplate = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      auto_task_templates: prev.auto_task_templates.filter((_, i) => i !== index),
    }));
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={seasonalDay ? 'Editar Dia Sazonal' : 'Novo Dia Sazonal'}
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
        {/* Name */}
        <div className="space-y-2">
          <Label>Nome *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Black Friday, Dia das Mães"
            className="h-11"
          />
        </div>

        {/* Color & Importance */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setFormData((prev) => ({ ...prev, color }))}
                  className={`w-7 h-7 rounded-full transition-all ${
                    formData.color === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Importância</Label>
            <div className="flex gap-2">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  onClick={() => setFormData((prev) => ({ ...prev, importance: level }))}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-all ${
                    formData.importance === level
                      ? 'border-primary bg-primary/10 font-medium'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {'•'.repeat(level)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recurrence Type */}
        <div className="space-y-2">
          <Label>Tipo de Recorrência</Label>
          <Select
            value={formData.recurrence_type}
            onValueChange={(value: 'fixed' | 'nth_weekday' | 'range') =>
              setFormData((prev) => ({ ...prev, recurrence_type: value }))
            }
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Data fixa (ex: 25/12)</SelectItem>
              <SelectItem value="nth_weekday">Dia da semana (ex: 2ª segunda de Nov)</SelectItem>
              <SelectItem value="range">Período (ex: 20/11 a 30/11)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Fields */}
        {formData.recurrence_type === 'fixed' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select
                value={String(formData.month)}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, month: parseInt(v) }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dia</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={formData.day}
                onChange={(e) => setFormData((prev) => ({ ...prev, day: parseInt(e.target.value) || 1 }))}
                className="h-11"
              />
            </div>
          </div>
        )}

        {formData.recurrence_type === 'nth_weekday' && (
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Ocorrência</Label>
              <Select
                value={String(formData.nth_occurrence)}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, nth_occurrence: parseInt(v) }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NTH_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dia</Label>
              <Select
                value={String(formData.weekday)}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, weekday: parseInt(v) }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select
                value={String(formData.month)}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, month: parseInt(v) }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {formData.recurrence_type === 'range' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês Início</Label>
                <Select
                  value={String(formData.month)}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, month: parseInt(v) }))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dia Início</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.day}
                  onChange={(e) => setFormData((prev) => ({ ...prev, day: parseInt(e.target.value) || 1 }))}
                  className="h-11"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês Fim</Label>
                <Select
                  value={String(formData.end_month)}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, end_month: parseInt(v) }))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dia Fim</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.end_day}
                  onChange={(e) => setFormData((prev) => ({ ...prev, end_day: parseInt(e.target.value) || 1 }))}
                  className="h-11"
                />
              </div>
            </div>
          </div>
        )}

        {/* Prep Days */}
        <div className="space-y-2">
          <Label>Dias de Preparação</Label>
          <Input
            type="number"
            min={0}
            max={90}
            value={formData.prep_days}
            onChange={(e) => setFormData((prev) => ({ ...prev, prep_days: parseInt(e.target.value) || 0 }))}
            className="h-11"
            placeholder="Dias antes do evento para preparação"
          />
        </div>

        {/* Reminders */}
        <div className="space-y-2">
          <Label>Lembretes</Label>
          <div className="flex gap-2">
            <Input
              value={newReminder}
              onChange={(e) => setNewReminder(e.target.value)}
              placeholder="Ex: -30d, -7d, 08:00"
              className="h-10"
            />
            <Button type="button" size="sm" onClick={addReminder} className="h-10">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {formData.reminders.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.reminders.map((r, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm"
                >
                  {r}
                  <button onClick={() => removeReminder(i)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Auto Tasks */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Criar tarefas automaticamente</Label>
            <Switch
              checked={formData.auto_tasks}
              onCheckedChange={(v) => setFormData((prev) => ({ ...prev, auto_tasks: v }))}
            />
          </div>
          {formData.auto_tasks && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Título da tarefa"
                  className="h-10"
                />
                <Button type="button" size="sm" onClick={addTaskTemplate} className="h-10">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.auto_task_templates.length > 0 && (
                <div className="space-y-1">
                  {formData.auto_task_templates.map((t, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 bg-muted rounded text-sm"
                    >
                      <span>{t.title}</span>
                      <button onClick={() => removeTaskTemplate(i)}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notas</Label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Observações..."
            rows={2}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {seasonalDay && onDelete && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="mr-auto"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : seasonalDay ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
};
