import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DebouncedInput, DebouncedTextarea } from '@/components/ui/debounced-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomField } from '@/hooks/usePlatforms';

interface CustomFieldsRendererProps {
  fields: CustomField[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export function CustomFieldsRenderer({ fields, values, onChange }: CustomFieldsRendererProps) {
  if (fields.length === 0) return null;

  const updateValue = (fieldId: string, value: string) => {
    onChange({ ...values, [fieldId]: value });
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Campos Personalizados
      </Label>
      {fields.map(field => (
        <div key={field.id} className="space-y-1.5">
          <Label className="text-sm">{field.label || field.id}</Label>

          {field.type === 'input' && (
            <DebouncedInput
              value={values[field.id] || ''}
              onChange={(v) => updateValue(field.id, v)}
              placeholder={field.label}
              className="h-10"
            />
          )}

          {field.type === 'textarea' && (
            <DebouncedTextarea
              value={values[field.id] || ''}
              onChange={(v) => updateValue(field.id, v)}
              placeholder={field.label}
              rows={3}
              className="resize-y"
            />
          )}

          {field.type === 'number' && (
            <DebouncedInput
              type="number"
              value={values[field.id] || ''}
              onChange={(v) => updateValue(field.id, v)}
              placeholder="0"
              className="h-10"
            />
          )}

          {field.type === 'select' && (
            <Select
              value={values[field.id] || '__none__'}
              onValueChange={(v) => updateValue(field.id, v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {(field.select_options || []).map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {field.type === 'date' && (
            <Input
              type="date"
              value={values[field.id] || ''}
              onChange={(e) => updateValue(field.id, e.target.value)}
              className="h-10"
            />
          )}

          {field.type === 'media' && (
            <Input
              value={values[field.id] || ''}
              onChange={(e) => updateValue(field.id, e.target.value)}
              placeholder="URL da mídia"
              className="h-10"
            />
          )}
        </div>
      ))}
    </div>
  );
}
