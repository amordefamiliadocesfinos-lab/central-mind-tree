import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DebouncedInput } from '@/components/ui/debounced-input';
import { SortableList, SortableHandle } from '@/components/ui/sortable-list';
import { Plus, Trash2, Type, AlignLeft, Hash, ListFilter, CalendarIcon, ImageIcon } from 'lucide-react';
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

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

export function CustomFieldsDefinition({ fields, onChange }: CustomFieldsDefinitionProps) {
  // Auto-fix duplicate ids from legacy data (caused by previous label-slug logic)
  useEffect(() => {
    const seen = new Set<string>();
    let hasDup = false;
    const fixed = fields.map((f) => {
      if (!f.id || seen.has(f.id)) {
        hasDup = true;
        let nid = `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        while (seen.has(nid)) nid = `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        seen.add(nid);
        return { ...f, id: nid };
      }
      seen.add(f.id);
      return f;
    });
    if (hasDup) onChange(fixed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const genId = () => {
    const existing = new Set(fields.map(f => f.id));
    let id = `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    while (existing.has(id)) {
      id = `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    return id;
  };

  const addField = () => {
    onChange([...fields, { id: genId(), label: '', type: 'input' }]);
  };

  const updateField = (index: number, updates: Partial<CustomField>) => {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const handleReorder = (newItems: CustomField[]) => {
    onChange(newItems);
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

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
          Nenhum campo definido. Clique em "Adicionar Campo" acima.
        </p>
      ) : (
        <SortableList
          items={fields}
          keyExtractor={(f) => f.id}
          onReorder={handleReorder}
          renderItem={(field, index) => {
            return (
              <div className="space-y-2 p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <SortableHandle />

                  <DebouncedInput
                    value={field.label}
                    onChange={(label) => updateField(index, { label })}
                    placeholder="Nome do campo"
                    className="h-9 flex-1"
                    delay={300}
                  />

                  <Select
                    value={field.type}
                    onValueChange={(v) => updateField(index, { type: v as CustomField['type'] })}
                  >
                    <SelectTrigger className="w-32 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((ft) => (
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
                    <DebouncedInput
                      value={field.select_options?.join(', ') || ''}
                      onChange={(v) =>
                        updateField(index, {
                          select_options: v.split(',').map((s) => s.trim()).filter(Boolean),
                        })
                      }
                      placeholder="Opções separadas por vírgula (ex: Opção 1, Opção 2)"
                      className="h-8 text-xs"
                      delay={300}
                    />
                  </div>
                )}
              </div>
            );
          }}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Arraste pela alça à esquerda para reordenar. Tipos disponíveis: texto curto, texto longo, número, seleção, data e mídia.
      </p>
    </div>
  );
}
