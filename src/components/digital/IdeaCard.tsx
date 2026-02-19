import { DigitalIdea, DIGITAL_STATUS } from '@/hooks/useDigital';
import { Platform } from '@/hooks/usePlatforms';
import { ProductListItem } from '@/hooks/useProductsList';
import { IdeaType } from '@/hooks/useIdeaTypes';
import { PlatformIcon } from './PlatformsManager';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Calendar, ChevronRight, LinkIcon, Package } from 'lucide-react';

// Fallback for unknown types
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
  const statusConfig = DIGITAL_STATUS[idea.status];
  const variations = idea.variations || [];
  
  const getPlatform = (platformId: string) => platforms.find(p => p.id === platformId);
  
  const completedVariations = variations.filter(v => v.status === 'concluido').length;
  const progress = variations.length > 0 ? (completedVariations / variations.length) * 100 : 0;

  const nextScheduled = variations
    .filter(v => v.scheduled_date)
    .sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))[0];

  const dynamicType = ideaTypes.find(t => t.key === idea.idea_type);
  const ideaType = dynamicType
    ? { label: dynamicType.label, icon: dynamicType.icon, color: dynamicType.color }
    : DEFAULT_TYPE;
  const linkedNode = idea.node_id ? nodes.find(n => n.id === idea.node_id) : null;
  const linkedProduct = idea.product_id ? products.find(p => p.id === idea.product_id) : null;

  // Group platform icons by unique platform (deduplicate)
  const uniquePlatforms = new Map<string, Platform>();
  variations.forEach(v => {
    const p = getPlatform(v.platform);
    if (p && !uniquePlatforms.has(p.id)) {
      uniquePlatforms.set(p.id, p);
    }
  });

  return (
    <Card
      className={cn(
        'cursor-pointer hover:bg-muted/50 transition-all touch-manipulation active:scale-[0.99]',
        'border-l-4',
        statusConfig.color.replace('bg-', 'border-l-')
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        {/* Row 1: Type badge + Status badge */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <Badge variant="outline" className={cn('text-[10px] gap-1 font-medium border', ideaType.color)}>
            <span>{ideaType.icon}</span>
            {ideaType.label}
          </Badge>
          <Badge className={cn('text-[10px] text-white shrink-0', statusConfig.color)}>
            {statusConfig.label}
          </Badge>
          {linkedNode && (
            <Badge variant="outline" className="text-[10px] gap-1 font-normal text-muted-foreground">
              <LinkIcon className="h-2.5 w-2.5" />
              <span className="truncate max-w-[100px]">{linkedNode.title}</span>
            </Badge>
          )}
          {linkedProduct && (
            <Badge variant="outline" className="text-[10px] gap-1 font-normal text-muted-foreground border-emerald-500/30">
              <Package className="h-2.5 w-2.5" />
              <span className="truncate max-w-[100px]">{linkedProduct.name}</span>
            </Badge>
          )}
        </div>

        {/* Row 2: Title */}
        <h3 className="font-medium text-sm leading-snug line-clamp-2 mb-1.5">{idea.title}</h3>

        {/* Row 3: Objective (condensed) */}
        {idea.objective && (
          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
            {idea.objective}
          </p>
        )}

        {/* Row 4: Platforms + Progress + Date */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Platform icons with tooltips */}
            {uniquePlatforms.size > 0 && (
              <div className="flex items-center gap-0.5">
                {Array.from(uniquePlatforms.values()).slice(0, 6).map(p => (
                  <Tooltip key={p.id}>
                    <TooltipTrigger asChild>
                      <PlatformIcon icon={p.icon} size="sm" className="cursor-default" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {p.name}
                    </TooltipContent>
                  </Tooltip>
                ))}
                {uniquePlatforms.size > 6 && (
                  <span className="text-[10px] text-muted-foreground font-medium ml-0.5">
                    +{uniquePlatforms.size - 6}
                  </span>
                )}
              </div>
            )}

            {/* Progress bar */}
            {variations.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Progress value={progress} className="w-10 h-1.5" />
                <span className="tabular-nums whitespace-nowrap">
                  {completedVariations}/{variations.length}
                </span>
              </div>
            )}
          </div>

          {/* Right: Date + Arrow */}
          <div className="flex items-center gap-1.5 shrink-0">
            {nextScheduled && (
              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span className="tabular-nums">
                  {nextScheduled.scheduled_date?.slice(5).replace('-', '/')}
                </span>
              </div>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
