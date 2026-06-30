import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MessageCircle, Send, SkipForward, CheckCircle2, X, Users, Plus, Pencil, Trash2, Check } from 'lucide-react';
import { useWhatsAppWithLog } from '@/hooks/useWhatsAppWithLog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Contact } from '@/hooks/useContacts';
import {
  WHATSAPP_TEMPLATES,
  loadCustomTemplates,
  saveCustomTemplates,
  type CustomTemplate,
} from '@/lib/whatsappTemplates';
import { WhatsAppAttachments, appendAttachmentsToMessage, type WhatsAppAttachment } from './WhatsAppAttachments';

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
  const [selectedTplKey, setSelectedTplKey] = useState<string>('default');
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => loadCustomTemplates());
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [editingTplKey, setEditingTplKey] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [index, setIndex] = useState(0);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<WhatsAppAttachment[]>([]);

  useEffect(() => {
    saveCustomTemplates(customTemplates);
  }, [customTemplates]);

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
      setSelectedTplKey('default');
      setCreatorOpen(false);
      setAttachments([]);
    }
  }, [open]);

  const handleSelectTemplate = (key: string) => {
    setSelectedTplKey(key);
    if (key === 'default') { setTemplate(DEFAULT_TEMPLATE); return; }
    const tpl = customTemplates.find(t => t.key === key) || WHATSAPP_TEMPLATES.find(t => t.key === key);
    if (tpl) setTemplate(tpl.message);
  };

  const handleOpenCreate = () => {
    setEditingTplKey(null); setDraftLabel(''); setDraftMessage(''); setCreatorOpen(true);
  };
  const handleOpenEdit = (tpl: CustomTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTplKey(tpl.key); setDraftLabel(tpl.label); setDraftMessage(tpl.message); setCreatorOpen(true);
  };
  const handleDeleteCustom = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Excluir esta mensagem?')) return;
    setCustomTemplates(prev => prev.filter(t => t.key !== key));
    if (selectedTplKey === key) handleSelectTemplate('default');
    toast.success('Mensagem excluída');
  };
  const handleSaveDraft = () => {
    const label = draftLabel.trim(); const message = draftMessage.trim();
    if (!label || !message) { toast.error('Preencha título e mensagem'); return; }
    if (editingTplKey) {
      setCustomTemplates(prev => prev.map(t => t.key === editingTplKey ? { ...t, label, message } : t));
      if (selectedTplKey === editingTplKey) setTemplate(message);
      toast.success('Mensagem atualizada');
    } else {
      const key = `custom_${Date.now()}`;
      setCustomTemplates(prev => [...prev, { key, label, message }]);
      setSelectedTplKey(key); setTemplate(message);
      toast.success('Mensagem criada');
    }
    setCreatorOpen(false); setEditingTplKey(null); setDraftLabel(''); setDraftMessage('');
  };

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
    const baseMsg = renderMessage(template, current);
    const msg = appendAttachmentsToMessage(baseMsg, attachments);

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
      templateLabel: attachments.length ? `Disparo em fila · ${attachments.length} anexo(s)` : 'Disparo em fila',
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
              {/* Template picker */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Mensagens salvas</span>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleOpenCreate}>
                    <Plus className="h-3.5 w-3.5" /> Nova
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => handleSelectTemplate('default')}
                    className={cn(
                      'px-2 py-1 rounded-md border text-xs transition',
                      selectedTplKey === 'default' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'
                    )}
                  >
                    Padrão
                  </button>
                  {WHATSAPP_TEMPLATES.map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => handleSelectTemplate(t.key)}
                      className={cn(
                        'px-2 py-1 rounded-md border text-xs transition',
                        selectedTplKey === t.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                  {customTemplates.map(t => (
                    <div
                      key={t.key}
                      className={cn(
                        'group flex items-center gap-1 px-2 py-1 rounded-md border text-xs cursor-pointer transition',
                        selectedTplKey === t.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'
                      )}
                      onClick={() => handleSelectTemplate(t.key)}
                    >
                      <span>{t.label}</span>
                      <button onClick={(e) => handleOpenEdit(t, e)} className="opacity-60 hover:opacity-100">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={(e) => handleDeleteCustom(t.key, e)} className="opacity-60 hover:opacity-100">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {creatorOpen && (
                <div className="rounded-md border bg-muted/30 p-2 space-y-2">
                  <Input
                    placeholder="Título (ex: Reativação)"
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Textarea
                    placeholder="Mensagem... use {nome} para o primeiro nome"
                    value={draftMessage}
                    onChange={(e) => setDraftMessage(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreatorOpen(false)}>
                      <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={handleSaveDraft}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Salvar
                    </Button>
                  </div>
                </div>
              )}

              <Textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={5}
                className="text-sm"
                placeholder="Digite a mensagem..."
              />

              <WhatsAppAttachments
                attachments={attachments}
                onChange={setAttachments}
                compact
              />

              {current && (
                <div className="rounded-md border bg-muted/40 p-2 text-xs">
                  <div className="text-muted-foreground mb-1">Pré-visualização ({current.name}):</div>
                  <div className="whitespace-pre-wrap">{appendAttachmentsToMessage(renderMessage(template, current), attachments)}</div>
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
                {appendAttachmentsToMessage(renderMessage(template, current), attachments)}
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
