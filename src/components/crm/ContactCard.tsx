import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Contact } from '@/hooks/useContacts';
import { useContactConversations } from '@/hooks/useContactConversations';
import { ContactAvatar } from './ContactAvatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  MoreVertical,
  Edit,
  Trash2,
  MessageCircle,
  ShoppingCart,
  History,
  CalendarClock,
  Thermometer,
  Clock,
  ChevronDown,
  Flame,
  Snowflake,
  Sun,
  Send,
  Phone,
  Megaphone,
  Eye,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { differenceInDays, parseISO, format } from 'date-fns';

const TEMP_CONFIG = {
  frio: { label: 'Frio', icon: Snowflake, className: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-700', dot: 'bg-sky-500' },
  morno: { label: 'Morno', icon: Sun, className: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700', dot: 'bg-amber-500' },
  quente: { label: 'Quente', icon: Flame, className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700', dot: 'bg-red-500' },
};

const URGENCY_LEVELS = {
  urgente: { label: 'Urgente', emoji: '🔴', className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700', borderColor: 'border-l-red-500' },
  medio: { label: 'Médio', emoji: '🟡', className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700', borderColor: 'border-l-amber-400' },
  baixo: { label: 'Baixo', emoji: '🔵', className: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-700', borderColor: 'border-l-sky-300' },
};

const CONTACT_SUBTYPE_CONFIG: Record<string, { label: string; className: string }> = {
  revendedor: { label: 'Revendedor', className: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  cliente_final: { label: 'Cliente Final', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  atacado: { label: 'Atacado', className: 'bg-violet-100 text-violet-700 border-violet-300' },
};

const CLIENT_CLASSIFICATION_CONFIG: Record<string, { label: string; emoji: string; className: string }> = {
  vip: { label: 'VIP', emoji: '🟢', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  alto_potencial: { label: 'Alto Pot.', emoji: '🔵', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  medio: { label: 'Médio', emoji: '🟡', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  baixo_potencial: { label: 'Baixo Pot.', emoji: '⚪', className: 'bg-gray-100 text-gray-600 border-gray-300' },
};

interface ContactCardProps {
  contact: Contact;
  urgencyLevel: 'urgente' | 'medio' | 'baixo';
  noResponseInfo?: { status?: string; emoji: string; label: string; daysSince: number; suggestedMessage: string; suggestedLabel: string } | null;
  hasOrders: boolean;
  checklistData?: { messageSent: boolean; responseReceived: boolean; followUpDone: boolean; attemptConcluded: boolean } | null;
  scoreInfo?: { score: number; label: string; emoji: string; className: string };
  isDragged?: boolean;
  onEdit: () => void;
  onWhatsApp: () => void;
  onViewOrders: () => void;
  onViewHistory: () => void;
  onViewActivities: () => void;
  onCreateOrder: () => void;
  onDelete: () => void;
  onTempChange: (temp: string) => void;
  onDragStart: (e: React.DragEvent) => void;
  onFollowUp: (type: string, note: string) => Promise<void>;
  onSendSuggestion: () => Promise<void>;
  onSmartAttend: () => Promise<void>;
  hasPhone: boolean;
  nextTaskDate?: string | null;
}

export function ContactCard({
  contact,
  urgencyLevel,
  noResponseInfo,
  hasOrders: contactHasOrders,
  checklistData,
  scoreInfo,
  isDragged,
  onEdit,
  onWhatsApp,
  onViewOrders,
  onViewHistory,
  onViewActivities,
  onCreateOrder,
  onDelete,
  onTempChange,
  onDragStart,
  onFollowUp,
  onSendSuggestion,
  onSmartAttend,
  hasPhone,
}: ContactCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpType, setFollowUpType] = useState('mensagem');
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const { conversations: linkedConvos } = useContactConversations(contact.id);
  const openConvCount = linkedConvos.filter(c => c.status === 'open').length;
  const totalUnread = linkedConvos.reduce((s, c) => s + (c.unread_count || 0), 0);

  const urgencyCfg = URGENCY_LEVELS[urgencyLevel];
  const temp = contact.temperatura_lead || 'morno';
  const tempCfg = TEMP_CONFIG[temp as keyof typeof TEMP_CONFIG] || TEMP_CONFIG.morno;
  const TempIcon = tempCfg.icon;
  const subtypeCfg = CONTACT_SUBTYPE_CONFIG[contact.contact_type || ''];
  const daysSinceContact = contact.ultimo_contato ? differenceInDays(new Date(), parseISO(contact.ultimo_contato)) : null;

  const handleSaveFollowUp = async () => {
    if (!followUpNote.trim()) return;
    setSavingFollowUp(true);
    await onFollowUp(followUpType, followUpNote.trim());
    setSavingFollowUp(false);
    setShowFollowUp(false);
    setFollowUpNote('');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
    >
      <Card
        className={cn(
          'transition-all cursor-grab active:cursor-grabbing border-l-[3px] overflow-hidden select-none',
          isDragged && 'opacity-50 scale-95',
          urgencyCfg.borderColor,
        )}
        draggable
        onDragStart={onDragStart}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        title="Clique para editar"
      >
        {/* ═══════ KOMMO-STYLE COMPACT HEADER ═══════ */}
        <div className="p-3">
          <div className="flex items-start gap-2.5">
            <ContactAvatar photoUrl={contact.photo_url} name={contact.name} size="sm" />

            <div className="flex-1 min-w-0">
              {/* Row 1: Name + Date */}
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-[13px] leading-tight text-foreground truncate">
                  {contact.name}
                </p>
                <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap mt-0.5">
                  {(() => { try { return format(parseISO(contact.created_at), 'dd/MM/yyyy'); } catch { return ''; } })()}
                </span>
              </div>

              {/* Row 2: Topic in blue (Kommo style) */}
              <p
                className="text-[12px] font-medium text-blue-600 dark:text-blue-400 leading-snug mt-0.5 truncate"
                title={contact.fantasy_name || contact.notes || contact.name}
              >
                {contact.fantasy_name
                  || (contact.notes ? contact.notes.split('\n')[0] : null)
                  || `Lead #${contact.id.slice(0, 7)}`}
              </p>

              {/* Row 3: Value + small tags + task indicator */}
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {contact.valor_estimado && contact.valor_estimado > 0 ? (
                    <span className="text-[12px] font-bold text-foreground tabular-nums">
                      {contact.valor_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  ) : null}

                  {contact.client_classification === 'vip' && (
                    <span className="inline-flex items-center rounded border border-border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">VIP</span>
                  )}
                  {urgencyLevel === 'urgente' && (
                    <span className="inline-flex items-center rounded border border-border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Urgent</span>
                  )}
                  {urgencyLevel === 'medio' && (
                    <span className="inline-flex items-center rounded border border-border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Priority</span>
                  )}
                  {subtypeCfg && (
                    <span className="inline-flex items-center rounded border border-border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{subtypeCfg.label}</span>
                  )}
                </div>

                {/* Task indicator (Kommo) */}
                {(() => {
                  const next = contact.next_action_date || contact.next_contact_date;
                  if (next) {
                    try {
                      const days = differenceInDays(parseISO(next), new Date());
                      if (days < 0) return (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400 whitespace-nowrap shrink-0">
                          {Math.abs(days)}d <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        </span>
                      );
                      if (days === 0) return (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 dark:text-green-400 whitespace-nowrap shrink-0">
                          Hoje <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        </span>
                      );
                      return (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground whitespace-nowrap shrink-0">
                          {days}d <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                        </span>
                      );
                    } catch { return null; }
                  }
                  return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground whitespace-nowrap shrink-0">
                      Sem tarefas <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    </span>
                  );
                })()}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mt-1 -mr-1 opacity-50 hover:opacity-100">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={onEdit}><Edit className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                <DropdownMenuItem onClick={onWhatsApp}><MessageCircle className="h-4 w-4 mr-2" /> WhatsApp</DropdownMenuItem>
                <DropdownMenuItem onClick={async () => { await onSmartAttend(); }}><Send className="h-4 w-4 mr-2" /> Atender agora</DropdownMenuItem>
                <DropdownMenuItem onClick={onViewOrders}><ShoppingCart className="h-4 w-4 mr-2" /> Pedidos</DropdownMenuItem>
                <DropdownMenuItem onClick={onCreateOrder} className="text-green-700 dark:text-green-500 font-medium"><ShoppingCart className="h-4 w-4 mr-2" /> Novo Pedido</DropdownMenuItem>
                <DropdownMenuItem onClick={onViewHistory}><History className="h-4 w-4 mr-2" /> Histórico</DropdownMenuItem>
                <DropdownMenuItem onClick={onViewActivities}><CalendarClock className="h-4 w-4 mr-2" /> Atividades</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><Thermometer className="h-4 w-4 mr-2" /> Temperatura</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {Object.entries(TEMP_CONFIG).map(([key, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <DropdownMenuItem key={key} onClick={() => onTempChange(key)} className={contact.temperatura_lead === key ? 'font-bold' : ''}>
                          <Icon className="h-4 w-4 mr-2" />{cfg.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {totalUnread > 0 && (
            <Link
              to="/digital?tab=atendimento"
              onClick={(e) => e.stopPropagation()}
              className="mt-2 inline-flex items-center gap-1 text-[10px] text-violet-700 dark:text-violet-300 hover:underline"
            >
              <MessageCircle className="h-2.5 w-2.5" />
              {totalUnread} nova(s)
            </Link>
          )}

          {/* ═══════ EXPANDABLE — "Ver mais" ═══════ */}
          <Collapsible open={expanded} onOpenChange={setExpanded} className="mt-2">
            <CollapsibleTrigger asChild>
              <button
                className="flex items-center justify-center gap-1 w-full text-[10px] text-muted-foreground hover:text-foreground transition-colors py-1 border-t border-border/50"
                onClick={(e) => e.stopPropagation()}
              >
                <Eye className="h-2.5 w-2.5" />
                {expanded ? 'Ver menos' : 'Ver mais'}
                <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', expanded && 'rotate-180')} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 pt-2 border-t border-border/50 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                {/* No-response suggestion */}
                {noResponseInfo && (
                  <div className="rounded-md border border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20 px-2 py-1.5">
                    <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-0.5">
                      {noResponseInfo.emoji} {noResponseInfo.label} há {noResponseInfo.daysSince}d
                    </p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {noResponseInfo.suggestedMessage}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 h-6 text-[10px] gap-1 w-full border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400"
                      disabled={!hasPhone}
                      onClick={async (e) => { e.stopPropagation(); await onSendSuggestion(); }}
                    >
                      <Send className="h-2.5 w-2.5" /> Enviar mensagem
                    </Button>
                  </div>
                )}

                {/* Checklist */}
                {checklistData && (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-muted-foreground font-medium">
                      {[checklistData.messageSent, checklistData.responseReceived, checklistData.followUpDone, checklistData.attemptConcluded].filter(Boolean).length}/4
                    </span>
                    {[
                      { label: 'Msg', done: checklistData.messageSent },
                      { label: 'Resp', done: checklistData.responseReceived },
                      { label: 'FU', done: checklistData.followUpDone },
                      { label: 'Conc', done: checklistData.attemptConcluded },
                    ].map(item => (
                      <span key={item.label} title={item.label} className={cn(
                        'inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-medium border',
                        item.done ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-400 dark:border-green-700' : 'bg-muted/50 text-muted-foreground border-border'
                      )}>
                        {item.done ? '✔' : '⏳'}
                      </span>
                    ))}
                  </div>
                )}

                {/* Score */}
                {scoreInfo && (
                  <div className="flex items-center">
                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold', scoreInfo.className)}>
                      {scoreInfo.emoji} Score: {scoreInfo.score} ({scoreInfo.label})
                    </span>
                  </div>
                )}

                {/* Customer Health (auto-synced from orders + payments) */}
                {((contact.paid_orders_count || 0) > 0 || (contact.lifetime_value || 0) > 0) && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/60 dark:bg-emerald-950/20 px-2 py-1.5">
                    <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                      💎 Saúde do Cliente
                    </p>
                    <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                      <div className="text-center">
                        <div className="font-bold text-foreground">{contact.paid_orders_count || 0}</div>
                        <div className="text-muted-foreground">Pedidos</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-foreground">
                          {(contact.lifetime_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                        </div>
                        <div className="text-muted-foreground">Total</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-foreground">
                          {contact.last_purchase_date
                            ? `${differenceInDays(new Date(), parseISO(contact.last_purchase_date))}d`
                            : '—'}
                        </div>
                        <div className="text-muted-foreground">Últ. compra</div>
                      </div>
                    </div>
                  </div>
                )}

                {contact.notes && (
                  <div className="text-[11px] text-muted-foreground bg-muted/30 rounded-md px-2 py-1.5 border border-border/50">
                    <p className="font-medium text-foreground text-[10px] mb-0.5">📝 Observações</p>
                    <p className="line-clamp-3 leading-relaxed">{contact.notes}</p>
                  </div>
                )}

                {/* Origin */}
                {contact.origem_lead && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Megaphone className="h-3 w-3 shrink-0" />
                    <span>Origem: {contact.origem_lead}</span>
                  </div>
                )}

                {/* Estimated value */}
                {contact.valor_estimado !== undefined && contact.valor_estimado !== null && contact.valor_estimado > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span>💰 Ticket: {contact.valor_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}</span>
                  </div>
                )}

                {/* Next action */}
                {(contact.next_action_text || contact.next_action_date) && (
                  <div className="rounded-md px-2 py-1.5 text-[11px] border bg-muted/50 border-border">
                    {contact.next_action_text && <p className="font-medium leading-tight">{contact.next_action_text}</p>}
                    {contact.next_action_date && (
                      <p className="text-[10px] mt-0.5 text-muted-foreground">
                        {(() => { try { return format(parseISO(contact.next_action_date), "dd/MM HH:mm"); } catch { return ''; } })()}
                      </p>
                    )}
                  </div>
                )}

                {/* Follow-up inline form */}
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    disabled={!hasPhone}
                    onClick={(e) => { e.stopPropagation(); onWhatsApp(); }}
                    title="WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </Button>

                  {!showFollowUp ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-[11px] gap-1"
                      onClick={(e) => { e.stopPropagation(); setShowFollowUp(true); }}
                    >
                      <MessageCircle className="h-3 w-3" /> Registrar Follow-up
                    </Button>
                  ) : (
                    <div className="flex-1 space-y-1.5 rounded-md border bg-muted/30 p-2" onClick={(e) => e.stopPropagation()}>
                      <Select value={followUpType} onValueChange={setFollowUpType}>
                        <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensagem">💬 Mensagem</SelectItem>
                          <SelectItem value="ligacao">📞 Ligação</SelectItem>
                          <SelectItem value="whatsapp">📱 WhatsApp</SelectItem>
                          <SelectItem value="reuniao">🤝 Reunião</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Nota do contato..."
                        value={followUpNote}
                        onChange={(e) => setFollowUpNote(e.target.value)}
                        className="h-7 text-[11px]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && followUpNote.trim()) {
                            e.preventDefault();
                            handleSaveFollowUp();
                          }
                        }}
                      />
                      <div className="flex gap-1">
                        <Button size="sm" className="flex-1 h-6 text-[10px]" disabled={!followUpNote.trim() || savingFollowUp} onClick={handleSaveFollowUp}>
                          {savingFollowUp ? 'Salvando...' : 'Salvar'}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { setShowFollowUp(false); setFollowUpNote(''); }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </Card>
    </motion.div>
  );
}
