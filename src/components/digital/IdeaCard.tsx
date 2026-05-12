import { useState } from 'react';
import { DigitalIdea, DigitalVariation, DIGITAL_STATUS } from '@/hooks/useDigital';
import { Platform } from '@/hooks/usePlatforms';
import { ProductListItem } from '@/hooks/useProductsList';
import { IdeaType } from '@/hooks/useIdeaTypes';
import { PlatformIcon } from './PlatformsManager';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { openWhatsAppBroadcast } from '@/lib/whatsapp';
import { ChevronDown, Eye, MessageCircle, UserPlus, LinkIcon, Package, Target, Users, Calendar, Image, Layers, Minimize2 } from 'lucide-react';

const DEFAULT_TYPE = { label: 'Outro', icon: '📄', color: 'bg-muted text-muted-foreground border-border' };

const OBJECTIVE_MAP: Record<string, { label: string; emoji: string }> = {
  gerar_leads: { label: 'Lead', emoji: '🎯' },
  vender_produto: { label: 'Venda', emoji: '💰' },
  reativar_clientes: { label: 'Reativação', emoji: '🔄' },
  engajamento: { label: 'Engajamento', emoji: '💬' },
};

interface Node {
  id: string;
  title: string;
  color: string;
}

interface IdeaCardProps {
  idea: DigitalIdea;
  onClick: () => void;
  platforms?: Platform[];
  nodes?: Node[];
  products?: ProductListItem[];
  ideaTypes?: IdeaType[];
  singlePlatform?: Platform;
  singleVariation?: DigitalVariation;
  onExpandPlatforms?: () => void;
  onCollapsePlatforms?: () => void;
  isExpandedByPlatforms?: boolean;
}

export function IdeaCard({ idea, onClick, platforms = [], nodes = [], products = [], ideaTypes = [], singlePlatform, singleVariation, onExpandPlatforms, onCollapsePlatforms, isExpandedByPlatforms }: IdeaCardProps) {
  const [expanded, setExpanded] = useState(false);
  // When a single variation is provided, derive its status; otherwise use idea status
  const statusConfig = DIGITAL_STATUS[singleVariation ? singleVariation.status : idea.status];
  

  const getPlatform = (platformId: string) => platforms.find(p => p.id === platformId);

  const allVariations = idea.variations || [];
  const variations = singleVariation
    ? [singleVariation]
    : singlePlatform
      ? allVariations.filter(v => v.platform === singlePlatform.id)
      : allVariations;

  const completedVariations = variations.filter(v => v.status === 'concluido').length;
  const progress = variations.length > 0 ? (completedVariations / variations.length) * 100 : 0;

  const dynamicType = ideaTypes.find(t => t.key === idea.idea_type);
  const ideaType = dynamicType
    ? { label: dynamicType.label, icon: dynamicType.icon, color: dynamicType.color }
    : DEFAULT_TYPE;
  const linkedNode = idea.node_id ? nodes.find(n => n.id === idea.node_id) : null;
  const linkedProduct = idea.product_id ? products.find(p => p.id === idea.product_id) : null;

  const variationPlatform = singleVariation ? getPlatform(singleVariation.platform as string) : null;
  const effectivePlatform = singlePlatform || variationPlatform || null;

  const uniquePlatforms = new Map<string, Platform>();
  if (effectivePlatform) {
    uniquePlatforms.set(effectivePlatform.id, effectivePlatform);
  } else {
    allVariations.forEach(v => {
      const p = getPlatform(v.platform);
      if (p && !uniquePlatforms.has(p.id)) {
        uniquePlatforms.set(p.id, p);
      }
    });
  }

  const actionTags = (idea as any).action_tags || [];

  // Get preview image scoped to platform/variation when applicable
  const ideaMedia = (idea.media_urls as string[] | null) || [];
  const variationMedia = variations.flatMap(v => (v.media_urls as string[] | null) || []);
  const previewUrl = (singleVariation || singlePlatform)
    ? (variationMedia[0] || ideaMedia[0] || null)
    : (ideaMedia[0] || variationMedia[0] || null);

  // Derive platform-specific title for a single variation (mirrors KanbanBoard logic)
  const derivePlatformTitle = (v: DigitalVariation, plat: Platform | null): string | null => {
    if (v.title && v.title.trim()) return v.title.trim();
    const cfv = (v as any).custom_field_values as Record<string, string> | undefined;
    if (cfv && plat?.custom_fields?.length) {
      const titleRegex = /(nome|name|t[ií]tulo|title|produto|headline|assunto)/i;
      const titleField = plat.custom_fields.find(f =>
        titleRegex.test(f.id || '') || titleRegex.test(f.label || '')
      );
      if (titleField) {
        const val = cfv[titleField.id];
        if (val && String(val).trim()) return String(val).trim();
      }
      for (const f of plat.custom_fields) {
        const val = cfv[f.id];
        if (val && String(val).trim()) return String(val).trim();
      }
    }
    return null;
  };

  const displayTitle = singleVariation
    ? (derivePlatformTitle(singleVariation, variationPlatform) || idea.title)
    : singlePlatform
      ? `${idea.title} — ${singlePlatform.name}`
      : idea.title;
  const showSecondaryIdea = !!singleVariation && displayTitle !== idea.title;
  const platformCount = new Set(allVariations.map(v => v.platform).filter(Boolean)).size;

  const objectiveInfo = idea.objective ? OBJECTIVE_MAP[idea.objective] : null;

  const scheduledDates = variations
    .filter(v => v.scheduled_date)
    .map(v => v.scheduled_date!)
    .sort();
  const firstDate = scheduledDates[0];
  const lastDate = scheduledDates[scheduledDates.length - 1];

  const formatDate = (d: string) => {
    const parts = d.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]}`;
  };

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all touch-manipulation active:scale-[0.99] overflow-hidden',
        'border-l-4 hover:shadow-lg hover:-translate-y-0.5',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        statusConfig.color.replace('bg-', 'border-l-')
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      aria-label={`Abrir ideia ${idea.title}`}
    >
      {/* ═══════ PREVIEW IMAGE ═══════ */}
      {previewUrl ? (
        <div className="relative w-full bg-muted overflow-hidden flex items-center justify-center py-2">
          <img
            src={previewUrl}
            alt={idea.title}
            className="max-w-full max-h-[160px] object-contain transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
          {/* Status badge over image */}
          <Badge className={cn('absolute top-2 right-2 text-[10px] font-semibold text-white shadow-md backdrop-blur-sm', statusConfig.color)}>
            {statusConfig.label}
          </Badge>
          {/* Platform icons over image */}
          {uniquePlatforms.size > 0 && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 shadow-sm">
              {Array.from(uniquePlatforms.values()).slice(0, 4).map(p => (
                <Tooltip key={p.id}>
                  <TooltipTrigger asChild>
                    <span className="brightness-150"><PlatformIcon icon={p.icon} size="md" /></span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">{p.name}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full bg-gradient-to-br from-muted/40 to-muted/70 flex items-center justify-center py-6">
          <Image className="h-8 w-8 text-muted-foreground/30" />
          <Badge className={cn('absolute top-2 right-2 text-[10px] font-semibold text-white shadow-md', statusConfig.color)}>
            {statusConfig.label}
          </Badge>
        </div>
      )}

      <div className="p-3.5 space-y-3">
        {/* ═══════ TITLE ═══════ */}
        <div className="space-y-0.5">
          <h3 className="font-semibold text-[15px] leading-snug break-words tracking-tight">{displayTitle}</h3>
          {showSecondaryIdea && (
            <p className="text-[11px] text-muted-foreground leading-tight truncate">
              Ideia base: {idea.title}
            </p>
          )}
          {singleVariation && variationPlatform && (
            <p className="text-[11px] text-muted-foreground/80 leading-tight flex items-center gap-1">
              <PlatformIcon icon={variationPlatform.icon} size="sm" />
              <span>{variationPlatform.name}</span>
            </p>
          )}
        </div>

        {/* ═══════ QUICK ID — Type + Objective + Progress ═══════ */}
        <div className="flex items-center flex-wrap gap-1.5">
          <Badge variant="outline" className={cn('text-[10px] gap-1 font-medium border', ideaType.color)}>
            <span>{ideaType.icon}</span>
            {ideaType.label}
          </Badge>
          {objectiveInfo && (
            <Badge variant="outline" className="text-[10px] gap-1 font-medium border-border text-muted-foreground">
              {objectiveInfo.emoji} {objectiveInfo.label}
            </Badge>
          )}
          {variations.length > 0 && (
            <div className="flex items-center gap-1.5 ml-auto" aria-label={`${completedVariations} de ${variations.length} variações concluídas`}>
              <span className="text-[10px] text-muted-foreground tabular-nums font-medium">{completedVariations}/{variations.length}</span>
              <Progress value={progress} className="w-12 h-1.5" />
            </div>
          )}
        </div>

        {/* Action tags */}
        {actionTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {actionTags.includes('campanha_ativa') && (
              <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 border">📣 Campanha</Badge>
            )}
            {actionTags.includes('venda_ativa') && (
              <Badge className="text-[10px] bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 border">💰 Venda</Badge>
            )}
          </div>
        )}

        {/* ═══════ ACTIONS ═══════ */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-9 text-xs gap-1.5 font-medium"
            onClick={(e) => {
              e.stopPropagation();
              openWhatsAppBroadcast(idea.key_message || idea.title);
            }}
            aria-label="Enviar via WhatsApp"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-9 text-xs gap-1.5 font-medium"
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `/contatos?campaign=${idea.id}`;
            }}
            aria-label="Enviar para CRM"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Enviar p/ CRM
          </Button>
        </div>

        {/* Plataformas — expandir em cards por plataforma */}
        {!singlePlatform && !singleVariation && platformCount > 1 && onExpandPlatforms && (
          <Button
            size="sm"
            variant={isExpandedByPlatforms ? 'secondary' : 'outline'}
            className="w-full h-9 text-xs gap-1.5 font-medium"
            onClick={(e) => {
              e.stopPropagation();
              isExpandedByPlatforms ? onCollapsePlatforms?.() : onExpandPlatforms();
            }}
            aria-label="Expandir por plataforma"
          >
            {isExpandedByPlatforms ? (
              <><Minimize2 className="h-3.5 w-3.5" /> Recolher plataformas</>
            ) : (
              <><Layers className="h-3.5 w-3.5" /> Plataformas ({platformCount})</>
            )}
          </Button>
        )}

        {/* ═══════ EXPANDABLE ═══════ */}
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <button
              className="flex items-center justify-center gap-1 w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1 rounded-md hover:bg-muted/50"
              onClick={(e) => e.stopPropagation()}
            >
              <Eye className="h-3 w-3" />
              {expanded ? 'Ver menos' : 'Ver mais'}
              <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 pt-2 border-t border-border/50 animate-in fade-in-0 slide-in-from-top-1 duration-200">
              {/* Description / Key message */}
              {idea.key_message && (
                <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2">
                  <span className="font-medium text-foreground block mb-0.5">Copy:</span>
                  {idea.key_message}
                </div>
              )}

              {/* CTA */}
              {variations.some(v => v.cta) && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">CTA:</span>{' '}
                  {variations.find(v => v.cta)?.cta}
                </div>
              )}

              {/* Dates */}
              {firstDate && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span className="tabular-nums">
                    {formatDate(firstDate)}
                    {lastDate && lastDate !== firstDate && ` → ${formatDate(lastDate)}`}
                  </span>
                </div>
              )}

              {/* KPI */}
              {idea.kpi && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">KPI:</span> {idea.kpi}
                </div>
              )}

              {/* Platforms list */}
              {uniquePlatforms.size > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                  <span className="font-medium">Plataformas:</span>
                  {Array.from(uniquePlatforms.values()).map(p => (
                    <span key={p.id} className="inline-flex items-center gap-1">
                      <PlatformIcon icon={p.icon} size="sm" />
                      <span>{p.name}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Linked node & product */}
              {linkedNode && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LinkIcon className="h-3 w-3 shrink-0" />
                  <span>{linkedNode.title}</span>
                </div>
              )}
              {linkedProduct && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Package className="h-3 w-3 shrink-0" />
                  <span>{linkedProduct.name}</span>
                </div>
              )}

              {/* Target audience */}
              {idea.target_audience && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3 w-3 shrink-0" />
                  <span>Público: {idea.target_audience}</span>
                </div>
              )}

              {/* Variations summary */}
              {variations.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Variações:</span> {variations.length} ({completedVariations} concluídas)
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Card>
  );
}
