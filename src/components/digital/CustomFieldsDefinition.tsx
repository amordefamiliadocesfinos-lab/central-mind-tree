import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Type, AlignLeft, Hash, ListFilter, CalendarIcon, ImageIcon } from 'lucide-react';
import { CustomField } from '@/hooks/usePlatforms';

interface CustomFieldsDefinitionProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
}

const FIELD_TYPES: { value: CustomField['type']; label: string; icon: React.ReactNode }[] = [
  { value: 'input', label: 'Texto Curto', icon: <Type className="h-3.5 w-3.5" /> },
  { value: 'textarea', label: 'Texto Longo', icon: <AlignLeft className="h-3.5 w-3.5" /> },
  { value: 'number', label: 'Número', icon: <Hash className="h-3.5 w-3.5" /> },
  { value: 'select', label: 'Seleção', icon: <ListFilter className="h-3.5 w-3.5" /> },
  { value: 'date', label: 'Data', icon: <CalendarIcon className="h-3.5 w-3.5" /> },
  { value: 'media', label: 'Mídia (URL)', icon: <ImageIcon className="h-3.5 w-3.5" /> },
];

export function CustomFieldsDefinition({ fields, onChange }: CustomFieldsDefinitionProps) {
  const addField = () => {
    const newId = `field_${Date.now()}`;
    onChange([...fields, { id: newId, label: '', type: 'input' }]);
  };

  const updateField = (index: number, updates: Partial<CustomField>) => {
    onChange(fields.map((f, i) =>
      i === index ? { ...f, ...updates } : f
    ));
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Campos Personalizados</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={addField}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Adicionar Campo
        </Button>
      </div>

      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="space-y-2 p-2 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

              <Input
                value={field.label}
                onChange={(e) => updateField(index, {
                  label: e.target.value,
                  id: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || field.id,
                })}
                placeholder="Nome do campo"
                className="h-9 flex-1"
              />

              <Select
                value={field.type}
                onValueChange={(v) => updateField(index, { type: v as CustomField['type'] })}
              >
                <SelectTrigger className="w-32 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(ft => (
                    <SelectItem key={ft.value} value={ft.value}>
                      <div className="flex items-center gap-2">
                        {ft.icon}
                        {ft.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive shrink-0"
                onClick={() => removeField(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Select options editor */}
            {field.type === 'select' && (
              <div className="ml-8">
                <Input
                  value={field.select_options?.join(', ') || ''}
                  onChange={(e) => updateField(index, {
                    select_options: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  })}
                  placeholder="Opções separadas por vírgula (ex: Opção 1, Opção 2)"
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
        ))}

        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
            Nenhum campo definido. Clique em "Adicionar Campo" acima.
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Tipos disponíveis: texto curto, texto longo, número, seleção, data e mídia.
      </p>
    </div>
  );
}
