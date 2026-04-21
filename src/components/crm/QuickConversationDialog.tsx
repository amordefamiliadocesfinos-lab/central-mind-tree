import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ContactAutocomplete } from '@/components/operations/ContactAutocomplete';
import { useContactHistory, INTERACTION_TYPES } from '@/hooks/useContactHistory';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, Zap, UserPlus } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContactId?: string | null;
  onSaved?: (contactId: string) => void;
}

export function QuickConversationDialog({ open, onOpenChange, initialContactId, onSaved }: Props) {
  const { addEntry } = useContactHistory();
  const [contactId, setContactId] = useState<string | null>(initialContactId ?? null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [needsCreate, setNeedsCreate] = useState(false);

  const [type, setType] = useState('mensagem');
  const [summary, setSummary] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [followUpDays, setFollowUpDays] = useState('3');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setContactId(initialContactId ?? null);
      setContactName('');
      setContactPhone('');
      setNeedsCreate(false);
      setType('mensagem');
      setSummary('');
      setFollowUp(false);
      setFollowUpDays('3');
    }
  }, [open, initialContactId]);

  const handleContactSelect = (contact: any, manualName?: string) => {
    if (contact?.id) {
      setContactId(contact.id);
      setContactName(contact.name);
      setContactPhone(contact.whatsapp || contact.phone || '');
      setNeedsCreate(false);
    } else if (manualName) {
      setContactId(null);
      setContactName(manualName);
      setNeedsCreate(true);
    } else {
      setContactId(null);
      setContactName('');
      setNeedsCreate(false);
    }
  };

  const handleSave = async () => {
    if (!summary.trim()) {
      toast.error('Escreva um resumo da conversa');
      return;
    }
    if (!contactId && !contactName.trim()) {
      toast.error('Selecione ou digite o nome do contato');
      return;
    }

    setSaving(true);
    try {
      let finalContactId = contactId;

      // Create contact on the fly if needed
      if (!finalContactId && needsCreate) {
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            name: contactName.trim(),
            whatsapp: contactPhone.trim() || null,
            type: 'cliente',
            funnel_status: 'novo_lead',
            temperatura_lead: 'morno',
          })
          .select('id')
          .single();
        if (error || !data) throw error || new Error('Falha ao criar contato');
        finalContactId = data.id;
      }

      if (!finalContactId) throw new Error('Contato inválido');

      // Register history entry
      await addEntry(finalContactId, type, summary.trim(), new Date().toISOString());

      // Optional follow-up
      if (followUp) {
        const days = Math.max(1, parseInt(followUpDays) || 3);
        const next = new Date();
        next.setDate(next.getDate() + days);
        await supabase
          .from('contacts')
          .update({
            next_contact_date: next.toISOString(),
            next_action_text: `Retornar conversa: ${summary.trim().slice(0, 80)}`,
            next_action_date: next.toISOString(),
          })
          .eq('id', finalContactId);
        toast.success(`Follow-up agendado para ${days} dia(s)`);
      }

      onSaved?.(finalContactId);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar conversa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary" />
            Registrar conversa
          </DialogTitle>
          <DialogDescription className="text-xs">
            Salve rapidamente uma interação no histórico do contato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Contato</Label>
            <ContactAutocomplete
              onSelect={handleContactSelect}
              placeholder="Buscar por nome ou cadastrar novo..."
            />
            {needsCreate && (
              <div className="space-y-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
                <div className="flex items-center gap-1.5 text-xs text-primary">
                  <UserPlus className="h-3 w-3" />
                  Novo contato será criado: <strong>{contactName}</strong>
                </div>
                <Input
                  placeholder="WhatsApp (opcional)"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERACTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input value="Agora" disabled className="h-9 text-xs" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Resumo da conversa</Label>
            <Textarea
              placeholder="Ex: Cliente perguntou sobre prazo de entrega da camiseta P. Quer confirmar até sexta..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="min-h-[80px] text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
              }}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <Switch checked={followUp} onCheckedChange={setFollowUp} id="follow-up" />
              <Label htmlFor="follow-up" className="text-xs cursor-pointer">
                Lembrar de retornar em
              </Label>
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="1"
                max="60"
                value={followUpDays}
                onChange={(e) => setFollowUpDays(e.target.value)}
                disabled={!followUp}
                className="h-7 w-14 text-xs"
              />
              <span className="text-xs text-muted-foreground">dias</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              {saving ? 'Salvando...' : 'Salvar (⌘+Enter)'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
