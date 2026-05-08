import { useMemo } from 'react';
import { PlatformReplica, ReplicaField } from '@/hooks/usePlatforms';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlatformReplicaRendererProps {
  replica: PlatformReplica;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

// Tries to get a usable HSL/HEX color for the brand header
function normalizeColor(color?: string): string {
  if (!color) return '#EE4D2D';
  const c = color.trim();
  if (c.startsWith('#')) return c;
  if (c.startsWith('rgb') || c.startsWith('hsl')) return c;
  return `#${c.replace(/^#/, '')}`;
}

function ReplicaFieldRow({
  field,
  value,
  onChange,
  brandColor,
}: {
  field: ReplicaField;
  value: string;
  onChange: (v: string) => void;
  brandColor: string;
}) {
  const labelEl = (
    <div className="flex items-center gap-1 text-[13px] font-medium text-foreground/90">
      <span>{field.label}</span>
      {field.required && <span className="text-red-500">*</span>}
      {field.max_length && (
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {value.length}/{field.max_length}
        </span>
      )}
    </div>
  );

  const hintEl = field.hint ? (
    <p className="text-[11px] text-muted-foreground mt-1">{field.hint}</p>
  ) : null;

  // For "switch" type render inline row
  if (field.type === 'switch') {
    return (
      <div className="flex items-center justify-between py-3 px-3 border-b last:border-b-0">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium">{field.label}</p>
          {field.hint && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{field.hint}</p>
          )}
        </div>
        <Switch
          checked={value === 'true' || value === '1'}
          onCheckedChange={(v) => onChange(v ? 'true' : 'false')}
          style={{ ['--switch-bg' as any]: brandColor }}
        />
      </div>
    );
  }

  // For "media" render an upload-like tile
  if (field.type === 'media') {
    const urls = (value || '').split('|').filter(Boolean);
    return (
      <div className="py-3 px-3 border-b last:border-b-0 space-y-2">
        {labelEl}
        <div className="flex flex-wrap gap-2">
          {urls.map((u, i) => (
            <div
              key={i}
              className="w-16 h-16 rounded border overflow-hidden bg-muted flex items-center justify-center"
            >
              {/\.(mp4|webm|mov)$/i.test(u) ? (
                <video src={u} className="w-full h-full object-cover" muted />
              ) : (
                <img src={u} className="w-full h-full object-cover" alt="" />
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const url = prompt('Cole a URL da mídia:');
              if (url) onChange([...urls, url].join('|'));
            }}
            className="w-16 h-16 rounded border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-foreground/40 transition-colors"
            style={{ borderColor: urls.length === 0 ? brandColor : undefined, color: urls.length === 0 ? brandColor : undefined }}
          >
            <ImageIcon className="h-5 w-5" />
            <span className="text-[9px] mt-0.5">Adicionar</span>
          </button>
        </div>
        {hintEl}
      </div>
    );
  }

  // For "select" render a chevron row that opens dropdown
  if (field.type === 'select') {
    return (
      <div className="py-3 px-3 border-b last:border-b-0">
        {labelEl}
        <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
          <SelectTrigger className="mt-1.5 h-9 border-0 border-b border-input rounded-none px-0 shadow-none focus:ring-0 [&>svg]:opacity-50">
            <SelectValue placeholder={field.placeholder || 'Selecionar'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Nenhum</SelectItem>
            {(field.options || []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hintEl}
      </div>
    );
  }

  // For "tags" render comma-separated chips
  if (field.type === 'tags') {
    const tags = (value || '').split(',').map((t) => t.trim()).filter(Boolean);
    return (
      <div className="py-3 px-3 border-b last:border-b-0 space-y-1.5">
        {labelEl}
        <div className="flex flex-wrap gap-1.5 mt-1">
          {tags.map((t, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
            >
              {t}
            </span>
          ))}
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || 'tag1, tag2, tag3'}
          className="h-9 border-0 border-b border-input rounded-none px-0 shadow-none focus-visible:ring-0"
        />
        {hintEl}
      </div>
    );
  }

  // textarea
  if (field.type === 'textarea') {
    return (
      <div className="py-3 px-3 border-b last:border-b-0">
        {labelEl}
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={field.max_length}
          rows={3}
          className="mt-1.5 resize-y border-0 border-b border-input rounded-none px-0 shadow-none focus-visible:ring-0"
        />
        {hintEl}
      </div>
    );
  }

  // default text-like field (input, number, price, date)
  const inputType =
    field.type === 'number' || field.type === 'price' ? 'number' :
    field.type === 'date' ? 'date' : 'text';

  return (
    <div className="py-3 px-3 border-b last:border-b-0">
      {labelEl}
      <div className="flex items-center gap-1 mt-1.5 border-b border-input">
        {field.prefix && (
          <span className="text-[13px] text-muted-foreground">{field.prefix}</span>
        )}
        <Input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={field.max_length}
          className="h-9 border-0 rounded-none px-0 shadow-none focus-visible:ring-0 flex-1"
        />
        {field.suffix && (
          <span className="text-[13px] text-muted-foreground">{field.suffix}</span>
        )}
        {field.type === 'select' && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
      {hintEl}
    </div>
  );
}

export function PlatformReplicaRenderer({ replica, values, onChange }: PlatformReplicaRendererProps) {
  const brandColor = useMemo(() => normalizeColor(replica.brand_color), [replica.brand_color]);

  if (!replica?.sections?.length) return null;

  const updateValue = (id: string, v: string) => onChange({ ...values, [id]: v });

  return (
    <div className="rounded-xl overflow-hidden border bg-background shadow-sm">
      {/* Brand header — mimics platform top bar */}
      <div
        className="px-4 py-3 flex items-center gap-2 text-white"
        style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}
      >
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-base font-bold">
          {replica.brand_name?.[0]?.toUpperCase() || '★'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wide opacity-80">Réplica fiel</p>
          <p className="text-sm font-semibold truncate">
            {replica.brand_name || 'Plataforma'}
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="bg-muted/30 divide-y">
        {replica.sections.map((section) => (
          <div key={section.id} className="bg-background">
            <div
              className="px-3 py-2.5 flex items-center gap-2 text-[13px] font-semibold border-b"
              style={{ color: brandColor }}
            >
              {section.icon && <span className="text-base">{section.icon}</span>}
              <span>{section.title}</span>
            </div>
            <div>
              {section.fields.map((field) => (
                <ReplicaFieldRow
                  key={field.id}
                  field={field}
                  value={values[field.id] || ''}
                  onChange={(v) => updateValue(field.id, v)}
                  brandColor={brandColor}
                />
              ))}
              {section.fields.length === 0 && (
                <p className="px-3 py-3 text-xs text-muted-foreground italic">
                  Sem campos nesta seção
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 text-[10px] text-muted-foreground text-center bg-muted/20 border-t">
        Estrutura idêntica à interface real — pronta para futura integração via API
      </div>
    </div>
  );
}
