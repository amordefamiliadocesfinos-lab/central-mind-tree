import { useState, useMemo } from 'react';
import { MessageCircle, Send, Pencil, Sparkles, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WhatsAppTemplate {
  key: string;
  label: string;
  stages: string[];
  message: string;
}

const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    key: 'orcamento',
    label: 'Orçamento',
    stages: ['orcamento'],
    message: 'Olá, tudo bem?\nEstou passando para saber se você conseguiu analisar o orçamento que enviamos 😊',
  },
  {
    key: 'negociacao',
    label: 'Negociação',
    stages: ['negociacao'],
    message: 'Oi, tudo bem?\nConseguimos ajustar seu pedido, quer que eu finalize pra você?',
  },
  {
    key: 'follow_up',
    label: 'Follow-up',
    stages: ['novo', 'contato_feito', 'qualificado'],
    message: 'Olá, tudo bem?\nSó passando para ver se posso te ajudar com seu pedido 😊',
  },
  {
    key: 'cliente_ativo',
    label: 'Cliente Ativo',
    stages: ['fechado'],
    message: 'Olá! Tudo bem?\nEstamos com produção aberta essa semana, deseja fazer um novo pedido?',
  },
];

const AI_KEY = 'ia_smart';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  funnelStatus: string;
  contactId?: string;
  onSend: (message: string, templateLabel: string) => void;
}

export function WhatsAppMessageSelector({ open, onOpenChange, contactName, funnelStatus, contactId, onSend }: Props) {
  const suggestedTemplate = useMemo(() => {
    return WHATSAPP_TEMPLATES.find(t => t.stages.includes(funnelStatus)) || WHATSAPP_TEMPLATES[2];
  }, [funnelStatus]);

  const [selectedKey, setSelectedKey] = useState(suggestedTemplate.key);
  const [customMessage, setCustomMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [aiMessage, setAiMessage] = useState<string>('');
  const [aiReason, setAiReason] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  const isAiSelected = selectedKey === AI_KEY;
  const selectedTemplate = WHATSAPP_TEMPLATES.find(t => t.key === selectedKey) || suggestedTemplate;
  const baseMessage = isAiSelected ? aiMessage : selectedTemplate.message;
  const finalMessage = isEditing ? customMessage : baseMessage;

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      const suggested = WHATSAPP_TEMPLATES.find(t => t.stages.includes(funnelStatus)) || WHATSAPP_TEMPLATES[2];
      setSelectedKey(suggested.key);
      setCustomMessage(suggested.message);
      setIsEditing(false);
      setAiMessage('');
      setAiReason('');
    }
    onOpenChange(isOpen);
  };

  const handleSelectTemplate = (key: string) => {
    const tpl = WHATSAPP_TEMPLATES.find(t => t.key === key);
    if (tpl) {
      setSelectedKey(key);
      setCustomMessage(tpl.message);
      setIsEditing(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!contactId) {
      toast.error('Contato sem ID para análise');
      return;
    }
    setAiLoading(true);
    setSelectedKey(AI_KEY);
    setIsEditing(false);
    try {
      const { data, error } = await supabase.functions.invoke('smart-whatsapp-message', {
        body: { contact_id: contactId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const msg = (data?.message || '').trim();
      if (!msg) throw new Error('IA não retornou mensagem');
      setAiMessage(msg);
      setAiReason(data?.reason || 'Sugestão personalizada');
      setCustomMessage(msg);
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Erro ao gerar mensagem';
      toast.error(m);
      // volta para template anterior
      setSelectedKey(suggestedTemplate.key);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSend = () => {
    const label = isAiSelected ? `IA · ${aiReason || 'personalizada'}` : selectedTemplate.label;
    onSend(finalMessage, label);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5 text-green-600" />
            WhatsApp para {contactName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template chips */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Escolha uma mensagem:</p>
            <div className="flex flex-wrap gap-1.5">
              {/* AI chip */}
              {contactId && (
                <Badge
                  variant={isAiSelected ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer text-xs px-2.5 py-1 transition-colors gap-1',
                    isAiSelected
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-transparent hover:from-purple-700 hover:to-pink-700'
                      : 'border-purple-400 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30'
                  )}
                  onClick={handleGenerateAI}
                >
                  {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  IA Inteligente
                </Badge>
              )}
              {WHATSAPP_TEMPLATES.map(tpl => {
                const isSuggested = tpl.key === suggestedTemplate.key;
                const isSelected = tpl.key === selectedKey && !isEditing && !isAiSelected;
                return (
                  <Badge
                    key={tpl.key}
                    variant={isSelected ? 'default' : 'outline'}
                    className={cn(
                      'cursor-pointer text-xs px-2.5 py-1 transition-colors',
                      isSelected ? '' : 'hover:bg-accent',
                      isSuggested && !isSelected && 'border-green-400 dark:border-green-600'
                    )}
                    onClick={() => handleSelectTemplate(tpl.key)}
                  >
                    {tpl.label}
                    {isSuggested && <span className="ml-1 text-[9px] opacity-70">sugerida</span>}
                  </Badge>
                );
              })}
            </div>
            {isAiSelected && aiReason && !aiLoading && (
              <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {aiReason}
              </p>
            )}
          </div>

          {/* Message preview / edit */}
          <div className="space-y-2">
            {aiLoading && isAiSelected ? (
              <div className="rounded-lg border bg-muted/40 p-4 text-sm flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando histórico do cliente...
              </div>
            ) : !isEditing ? (
              <div
                className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap cursor-pointer hover:bg-muted/60 transition-colors relative group min-h-[60px]"
                onClick={() => { setIsEditing(true); setCustomMessage(baseMessage); }}
              >
                {baseMessage || <span className="text-muted-foreground italic">Selecione uma opção acima</span>}
                <Pencil className="h-3.5 w-3.5 text-muted-foreground absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ) : (
              <Textarea
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
                className="text-sm min-h-[80px] resize-none"
                autoFocus
                placeholder="Escreva sua mensagem..."
              />
            )}
          </div>

          {/* Send */}
          <Button
            className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
            disabled={!finalMessage.trim() || aiLoading}
            onClick={handleSend}
          >
            <Send className="h-4 w-4" />
            Abrir WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
