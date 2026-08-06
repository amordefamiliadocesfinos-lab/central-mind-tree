import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MessageCircle, Send, SkipForward, CheckCircle2, X, Users, Plus, Pencil, Trash2, Check } from 'lucide-react';
import type { WhatsAppOperationalResult } from '@/hooks/useWhatsAppWithLog';
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  onFinished?: (contact?: Contact, result?: WhatsAppOperationalResult) => void;
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
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [apiQueue, setApiQueue] = useState<Array<{ contact: Contact; conversationId: string }>>([]);
  const [blocked, setBlocked] = useState<Array<{ contact: Contact; reason: string }>>([]);

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
      setFailedIds([]);
      setApiQueue([]);
      setBlocked([]);
      setTemplate(DEFAULT_TEMPLATE);
      setSelectedTplKey('default');
      setCreatorOpen(false);
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

  const currentRecipient = apiQueue[index];
  const current = currentRecipient?.contact;
  const total = apiQueue.length;
  const done = sentIds.length + skippedIds.length + failedIds.length;
  const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);

  const handleStart = async () => {
    if (queue.length === 0) {
      toast.error('Nenhum contato selecionado tem telefone/WhatsApp');
      return;
    }
    setBusy(true);
    const ids = queue.map(contact => contact.id);
    const { data, error } = await supabase.from('service_conversations')
      .select('id,contact_id,last_inbound_at,last_message_at')
      .in('contact_id', ids)
      .order('last_message_at', { ascending: false });
    if (error) {
      toast.error('Não foi possível validar as janelas da Meta.');
      setBusy(false);
      return;
    }
    const latest = new Map<string, { id: string; last_inbound_at: string | null }>();
    for (const conversation of data || []) {
      if (conversation.contact_id && !latest.has(conversation.contact_id)) latest.set(conversation.contact_id, conversation);
    }
    const valid: Array<{ contact: Contact; conversationId: string }> = [];
    const invalid: Array<{ contact: Contact; reason: string }> = [];
    const now = Date.now();
    for (const contact of queue) {
      const conversation = latest.get(contact.id);
      const inboundAt = conversation?.last_inbound_at ? Date.parse(conversation.last_inbound_at) : 0;
      if (!conversation) invalid.push({ contact, reason: 'Sem conversa no CRM' });
      else if (!inboundAt || now - inboundAt > 24 * 60 * 60 * 1000) invalid.push({ contact, reason: 'Janela encerrada · exige modelo Meta' });
      else valid.push({ contact, conversationId: conversation.id });
    }
    setApiQueue(valid);
    setBlocked(invalid);
    setIndex(0);
    setBusy(false);
    if (valid.length === 0) {
      toast.warning('Nenhum lead está com janela de 24 horas aberta. Use um modelo aprovado pela Meta.');
      return;
    }
    toast.success(`${valid.length} prontos para API · ${invalid.length} bloqueados pela validação`);
    setPhase('queue');
  };

  const handleSendNext = async () => {
    if (!current) return;
    setBusy(true);
    const sentContact = current;
    const msg = renderMessage(template, current);
    const { data, error } = await supabase.functions.invoke('whatsapp-send', {
      body: { conversation_id: currentRecipient.conversationId, message: msg },
    });
    const errorMessage = (data as { error?: string } | null)?.error || (error ? 'Falha no envio pela API' : null);
    if (errorMessage) {
      setFailedIds(prev => [...prev, sentContact.id]);
      toast.error(`${sentContact.name}: ${errorMessage}`);
      advance();
      setBusy(false);
      return;
    }

    setSentIds(prev => [...prev, sentContact.id]);
    const followUp = new Date(); followUp.setDate(followUp.getDate() + 2); followUp.setHours(9, 0, 0, 0);
    onFinished?.(sentContact, { nextStage: sentContact.funnel_status === 'novo_lead' ? 'contato_realizado' : sentContact.funnel_status, followUpAt: followUp.toISOString() });
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
    if (next >= apiQueue.length) {
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
                O CRM valida a janela de 24 horas e envia diretamente pela API oficial, sem abrir o WhatsApp Web.
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

              {blocked.length > 0 && (
                <div className="max-h-28 overflow-y-auto rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                  <div className="font-semibold mb-1">Não elegíveis para mensagem livre ({blocked.length})</div>
                  {blocked.slice(0, 20).map(item => <div key={item.contact.id}>{item.contact.name} · {item.reason}</div>)}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => void handleStart()}
                  disabled={busy || !template.trim() || queue.length === 0}
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  {busy ? 'Validando Meta…' : `Validar e iniciar (${queue.length})`}
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
                    Enviar pela API e próximo
                  </Button>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                O envio acontece dentro do CRM. O histórico e a próxima ação são atualizados somente após confirmação da API.
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
              <p>❌ Falharam: <strong>{failedIds.length}</strong></p>
              <p>⏭️ Pulados: <strong>{skippedIds.length}</strong></p>
              <p>🔒 Fora da janela: <strong>{blocked.length}</strong></p>
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
