import { DigitalIdea, DIGITAL_STATUS } from '@/hooks/useDigital';
import { Platform } from '@/hooks/usePlatforms';
import { ProductListItem } from '@/hooks/useProductsList';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Calendar, ChevronRight, FileText, Megaphone, PackagePlus, Rocket, LinkIcon, Package } from 'lucide-react';

export const IDEA_TYPES: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  conteudo: { label: 'Conteúdo', icon: <FileText className="h-3 w-3" />, color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  anuncio: { label: 'Anúncio', icon: <Megaphone className="h-3 w-3" />, color: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30' },
  cadastro: { label: 'Cadastro', icon: <PackagePlus className="h-3 w-3" />, color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  campanha: { label: 'Campanha', icon: <Rocket className="h-3 w-3" />, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30' },
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
}

export function IdeaCard({ idea, onClick, platforms = [], nodes = [], products = [] }: IdeaCardProps) {
  const statusConfig = DIGITAL_STATUS[idea.status];
  const variations = idea.variations || [];
  
  const getPlatform = (platformId: string) => platforms.find(p => p.id === platformId);
  
  const completedVariations = variations.filter(v => v.status === 'concluido').length;
  const progress = variations.length > 0 ? (completedVariations / variations.length) * 100 : 0;

  const nextScheduled = variations
    .filter(v => v.scheduled_date)
    .sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))[0];

  const ideaType = IDEA_TYPES[idea.idea_type || 'conteudo'] || IDEA_TYPES.conteudo;
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
            {ideaType.icon}
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
                      <span className="text-base leading-none cursor-default">{p.icon}</span>
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
