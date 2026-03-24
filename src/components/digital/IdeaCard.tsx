import { useState } from 'react';
import { DigitalIdea, DIGITAL_STATUS } from '@/hooks/useDigital';
import { Platform } from '@/hooks/usePlatforms';
import { ProductListItem } from '@/hooks/useProductsList';
import { IdeaType } from '@/hooks/useIdeaTypes';
import { PlatformIcon } from './PlatformsManager';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Calendar, Eye, ChevronDown, LinkIcon, Package, Target, Users } from 'lucide-react';

const DEFAULT_TYPE = { label: 'Outro', icon: '📄', color: 'bg-muted text-muted-foreground border-border' };

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
}

export function IdeaCard({ idea, onClick, platforms = [], nodes = [], products = [], ideaTypes = [] }: IdeaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig = DIGITAL_STATUS[idea.status];
  const variations = idea.variations || [];

  const getPlatform = (platformId: string) => platforms.find(p => p.id === platformId);

  const completedVariations = variations.filter(v => v.status === 'concluido').length;
  const progress = variations.length > 0 ? (completedVariations / variations.length) * 100 : 0;

  const scheduledDates = variations
    .filter(v => v.scheduled_date)
    .map(v => v.scheduled_date!)
    .sort();
  const firstDate = scheduledDates[0];
  const lastDate = scheduledDates[scheduledDates.length - 1];

  const dynamicType = ideaTypes.find(t => t.key === idea.idea_type);
  const ideaType = dynamicType
    ? { label: dynamicType.label, icon: dynamicType.icon, color: dynamicType.color }
    : DEFAULT_TYPE;
  const linkedNode = idea.node_id ? nodes.find(n => n.id === idea.node_id) : null;
  const linkedProduct = idea.product_id ? products.find(p => p.id === idea.product_id) : null;

  const uniquePlatforms = new Map<string, Platform>();
  variations.forEach(v => {
    const p = getPlatform(v.platform);
    if (p && !uniquePlatforms.has(p.id)) {
      uniquePlatforms.set(p.id, p);
    }
  });

  const formatDate = (d: string) => {
    const parts = d.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]}`;
  };

  const actionTags = (idea as any).action_tags || [];

  return (
    <Card
      className={cn(
        'cursor-pointer hover:bg-muted/50 transition-all touch-manipulation active:scale-[0.99]',
        'border-l-4',
        statusConfig.color.replace('bg-', 'border-l-')
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4 space-y-2">
        {/* ═══════ TOP — Always visible ═══════ */}

        {/* Row 1: Type badge + Status + Platforms */}
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className={cn('text-[10px] gap-1 font-medium border', ideaType.color)}>
            <span>{ideaType.icon}</span>
            {ideaType.label}
          </Badge>
          <div className="flex items-center gap-1.5">
            {uniquePlatforms.size > 0 && (
              <div className="flex items-center gap-1">
                {Array.from(uniquePlatforms.values()).map(p => (
                  <Tooltip key={p.id}>
                    <TooltipTrigger asChild>
                      <span><PlatformIcon icon={p.icon} size="md" /></span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">{p.name}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
            <Badge className={cn('text-[10px] text-white shrink-0', statusConfig.color)}>
              {statusConfig.label}
            </Badge>
          </div>
        </div>

        {/* Row 2: Title */}
        <h3 className="font-semibold text-sm leading-snug">{idea.title}</h3>

        {/* Row 3: Date + Progress (compact) */}
        <div className="flex items-center justify-between gap-2">
          {firstDate ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" />
              <span className="tabular-nums">
                {formatDate(firstDate)}
                {lastDate && lastDate !== firstDate && ` → ${formatDate(lastDate)}`}
              </span>
            </div>
          ) : <span />}
          {variations.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground tabular-nums font-medium">{completedVariations}/{variations.length}</span>
              <Progress value={progress} className="w-14 h-1.5" />
              <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(progress)}%</span>
            </div>
          )}
        </div>

        {/* Action tags (compact) */}
        {actionTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {actionTags.includes('campanha_ativa') && (
              <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30 border">📣 Campanha</Badge>
            )}
            {actionTags.includes('reativacao_clientes') && (
              <Badge className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/30 border">🔄 Reativação</Badge>
            )}
            {actionTags.includes('venda_ativa') && (
              <Badge className="text-[10px] bg-blue-500/15 text-blue-700 border-blue-500/30 border">💰 Venda</Badge>
            )}
            {actionTags.includes('engajamento') && (
              <Badge className="text-[10px] bg-purple-500/15 text-purple-700 border-purple-500/30 border">💬 Engajamento</Badge>
            )}
          </div>
        )}

        {/* ═══════ EXPANDABLE — "Ver mais" ═══════ */}
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <button
              className="flex items-center justify-center gap-1 w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors py-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Eye className="h-3 w-3" />
              {expanded ? 'Ver menos' : 'Ver mais'}
              <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1.5 pt-2 border-t border-border/50 animate-in fade-in-0 slide-in-from-top-1 duration-200">
              {idea.kpi && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-medium uppercase">{idea.kpi}</span>
                </div>
              )}
              {linkedNode && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LinkIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{linkedNode.title}</span>
                </div>
              )}
              {linkedProduct && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Package className="h-3 w-3 shrink-0" />
                  <span className="truncate">{linkedProduct.name}</span>
                </div>
              )}
              {idea.objective && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Target className="h-3 w-3 shrink-0" />
                  <span className="line-clamp-2">
                    {{ gerar_leads: '🎯 Gerar leads', vender_produto: '💰 Vender produto', reativar_clientes: '🔄 Reativar clientes', engajamento: '💬 Engajamento' }[idea.objective] || idea.objective}
                  </span>
                </div>
              )}
              {idea.target_audience && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3 w-3 shrink-0" />
                  <span className="line-clamp-1">Público: {idea.target_audience}</span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
