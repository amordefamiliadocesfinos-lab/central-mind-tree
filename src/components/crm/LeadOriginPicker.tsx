import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Megaphone } from 'lucide-react';

interface LeadOriginPickerProps {
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  compact?: boolean;
}

const PRESETS = [
  'Não Informado',
  'Instagram',
  'Facebook',
  'WhatsApp',
  'Indicação',
  'Site',
  'Google',
  'Importação',
];

/**
 * Picker para a Origem do Lead.
 * - Combina presets fixos + campanhas cadastradas no módulo Digital.
 * - Permite digitar valor livre via opção "Outro...".
 * - Origem é rastreada internamente; não aparece nos cards do funil.
 */
export function LeadOriginPicker({ value, onChange, onBlur, placeholder, compact }: LeadOriginPickerProps) {
  const [campaigns, setCampaigns] = useState<{ id: string; title: string }[]>([]);
  const [mode, setMode] = useState<'select' | 'custom'>('select');

  useEffect(() => {
    let mounted = true;
    supabase
      .from('digital_ideas')
      .select('id,title,idea_type,status')
      .eq('idea_type', 'campanha')
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (mounted) setCampaigns((data || []) as any);
      });
    return () => { mounted = false; };
  }, []);

  // Determine if current value matches any preset/campaign
  const allOptions = [
    ...PRESETS,
    ...campaigns.map(c => `Campanha: ${c.title}`),
  ];
  const isKnown = !value || allOptions.includes(value);
  const effectiveMode = mode === 'custom' || !isKnown ? 'custom' : 'select';

  if (effectiveMode === 'custom') {
    return (
      <div className="flex gap-1.5">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder || 'Origem personalizada'}
          className={compact ? 'h-9' : ''}
        />
        <button
          type="button"
          onClick={() => { setMode('select'); onChange('Não Informado'); onBlur?.(); }}
          className="text-[11px] text-muted-foreground hover:text-foreground px-2 underline shrink-0"
        >
          lista
        </button>
      </div>
    );
  }

  return (
    <Select
      value={value || 'Não Informado'}
      onValueChange={(v) => {
        if (v === '__custom__') {
          setMode('custom');
          onChange('');
          return;
        }
        onChange(v);
        onBlur?.();
      }}
    >
      <SelectTrigger className={compact ? 'h-9' : ''}>
        <SelectValue placeholder="Selecione a origem" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {PRESETS.map(p => (
          <SelectItem key={p} value={p}>{p}</SelectItem>
        ))}
        {campaigns.length > 0 && (
          <>
            <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Megaphone className="h-3 w-3" /> Campanhas do Digital
            </div>
            {campaigns.map(c => (
              <SelectItem key={c.id} value={`Campanha: ${c.title}`}>
                📣 {c.title}
              </SelectItem>
            ))}
          </>
        )}
        <SelectItem value="__custom__">✏️ Outro (digitar)…</SelectItem>
      </SelectContent>
    </Select>
  );
}
