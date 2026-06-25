import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MessageCircle, Send, SkipForward, CheckCircle2, X, Users } from 'lucide-react';
import { useWhatsAppWithLog } from '@/hooks/useWhatsAppWithLog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Contact } from '@/hooks/useContacts';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  onFinished?: () => void;
}

const DEFAULT_TEMPLATE =
  'Olá {nome}, tudo bem?\nEstou passando para retomar nosso contato 😊';

type Phase = 'compose' | 'queue' | 'done';

function firstName(name: string) {
  return (name || '').trim().split(/\s+/)[0] || '';
}

function renderMessage(template: string, contact: Contact) {
  return template
    .replace(/\{nome\}/g, firstName(contact.name))
    .replace(/\{nome_completo\}/g, contact.name || '');
}

export function BulkWhatsAppDispatch({ open, onOpenChange, contacts, onFinished }: Props) {
  const { logAndOpen } = useWhatsAppWithLog();
  const [phase, setPhase] = useState<Phase>('compose');
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [index, setIndex] = useState(0);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Apenas contatos com telefone
  const queue = useMemo(
    () => contacts.filter(c => !!(c.whatsapp || c.mobile || c.phone)),
    [contacts]
  );
  const noPhoneCount = contacts.length - queue.length;

  useEffect(() => {
    if (open) {
      setPhase('compose');
      setIndex(0);
      setSentIds([]);
      setSkippedIds([]);
      setTemplate(DEFAULT_TEMPLATE);
    }
  }, [open]);

  const current = queue[index];
  const total = queue.length;
  const done = sentIds.length + skippedIds.length;
  const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);

  const handleStart = () => {
    if (queue.length === 0) {
      toast.error('Nenhum contato selecionado tem telefone/WhatsApp');
      return;
    }
    setPhase('queue');
  };

  const handleSendNext = async () => {
    if (!current) return;
    setBusy(true);
    const phone = current.whatsapp || current.mobile || current.phone!;
    const msg = renderMessage(template, current);

    // Atualização otimista: marca último contato como hoje para sair da lista
    await supabase
      .from('contacts')
      .update({ ultimo_contato: new Date().toISOString().split('T')[0] })
      .eq('id', current.id);

    await logAndOpen({
      contactId: current.id,
      contactName: current.name,
      phone,
      message: msg,
      templateLabel: 'Disparo em fila',
      source: 'crm_card',
    });

    setSentIds(prev => [...prev, current.id]);
    advance();
    setBusy(false);
  };

  const handleSkip = () => {
    if (!current) return;
    setSkippedIds(prev => [...prev, current.id]);
    advance();
  };

  const advance = () => {
    const next = index + 1;
    if (next >= queue.length) {
      setPhase('done');
      onFinished?.();
    } else {
      setIndex(next);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    if (sentIds.length > 0) onFinished?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {phase === 'compose' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                Disparo em fila · {queue.length} leads
              </DialogTitle>
              <DialogDescription>
                Use <code className="px-1 rounded bg-muted">{'{nome}'}</code> para o primeiro nome do lead.
                A cada envio você confirma com 1 clique e o próximo abre automaticamente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={5}
                className="text-sm"
                placeholder="Digite a mensagem..."
              />

              {current && (
                <div className="rounded-md border bg-muted/40 p-2 text-xs">
                  <div className="text-muted-foreground mb-1">Pré-visualização ({current.name}):</div>
                  <div className="whitespace-pre-wrap">{renderMessage(template, current)}</div>
                </div>
              )}

              {noPhoneCount > 0 && (
                <div className="text-xs text-amber-600">
                  ⚠ {noPhoneCount} contato(s) sem telefone serão ignorados.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleStart}
                  disabled={!template.trim() || queue.length === 0}
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Iniciar fila ({queue.length})
                </Button>
              </div>
            </div>
          </>
        )}

        {phase === 'queue' && current && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-2">
                <span>Lead {index + 1} de {total}</span>
                <Badge variant="secondary">{sentIds.length} enviados · {skippedIds.length} pulados</Badge>
              </DialogTitle>
            </DialogHeader>

            <Progress value={progressPct} className="h-1.5" />

            <div className="space-y-3">
              <div className="rounded-md border p-3">
                <div className="font-semibold text-base">{current.name}</div>
                <div className="text-xs text-muted-foreground">
                  📱 {current.whatsapp || current.mobile || current.phone}
                </div>
              </div>

              <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                {renderMessage(template, current)}
              </div>

              <div className="flex justify-between gap-2 pt-2">
                <Button variant="ghost" onClick={handleSkip} disabled={busy}>
                  <SkipForward className="h-4 w-4 mr-1" />
                  Pular
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose} disabled={busy}>
                    <X className="h-4 w-4 mr-1" />
                    Encerrar
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleSendNext}
                    disabled={busy}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Enviar e próximo
                  </Button>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                Ao clicar em "Enviar", o WhatsApp abre com a mensagem pronta. Após enviar lá, volte aqui para o próximo lead.
              </p>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Fila concluída
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <p>✅ Enviados: <strong>{sentIds.length}</strong></p>
              <p>⏭️ Pulados: <strong>{skippedIds.length}</strong></p>
              <div className="flex justify-end pt-2">
                <Button onClick={handleClose}>Fechar</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
