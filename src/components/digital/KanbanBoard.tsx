import { useState, useMemo } from 'react';
import { DndContext, DragOverlay, closestCorners, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DigitalIdea, DigitalVariation, DIGITAL_STATUS } from '@/hooks/useDigital';
import { Platform } from '@/hooks/usePlatforms';
import { ProductListItem } from '@/hooks/useProductsList';
import { IdeaType } from '@/hooks/useIdeaTypes';
import { PlatformIcon } from './PlatformsManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Calendar, ChevronDown, ChevronUp, GripVertical, LinkIcon, Package, Target, Users } from 'lucide-react';

interface Node {
  id: string;
  title: string;
  color: string;
}

interface KanbanBoardProps {
  ideas: DigitalIdea[];
  onUpdateIdea: (id: string, updates: Partial<DigitalIdea>) => void;
  onUpdateVariation: (id: string, updates: Partial<DigitalVariation>) => void;
  onSelectIdea: (id: string) => void;
  viewMode: 'ideas' | 'variations';
  platforms?: Platform[];
  nodes?: Node[];
  products?: ProductListItem[];
  ideaTypes?: IdeaType[];
}

const DEFAULT_TYPE = { label: 'Outro', icon: '📄', color: 'bg-muted text-muted-foreground border-border' };

const formatDate = (d: string) => {
  const parts = d.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]}`;
};

// Sortable Idea Card
function SortableIdeaCard({
  idea,
  onClick,
  platforms = [],
  nodes = [],
  products = [],
  ideaTypes = [],
}: {
  idea: DigitalIdea;
  onClick: () => void;
  platforms?: Platform[];
  nodes?: Node[];
  products?: ProductListItem[];
  ideaTypes?: IdeaType[];
}) {
  const [expanded, setExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: idea.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusConfig = DIGITAL_STATUS[idea.status];
  const variations = idea.variations || [];
  const completedVariations = variations.filter(v => v.status === 'concluido').length;
  const progress = variations.length > 0 ? (completedVariations / variations.length) * 100 : 0;

  const getPlatform = (platformId: string) => platforms.find(p => p.id === platformId);

  const uniquePlatforms = new Map<string, Platform>();
  variations.forEach(v => {
    const p = getPlatform(v.platform);
    if (p && !uniquePlatforms.has(p.id)) uniquePlatforms.set(p.id, p);
  });

  const dynamicType = ideaTypes.find(t => t.key === idea.idea_type);
  const ideaType = dynamicType
    ? { label: dynamicType.label, icon: dynamicType.icon, color: dynamicType.color }
    : DEFAULT_TYPE;

  const linkedNode = idea.node_id ? nodes.find(n => n.id === idea.node_id) : null;
  const linkedProduct = idea.product_id ? products.find(p => p.id === idea.product_id) : null;

  const scheduledDates = variations.filter(v => v.scheduled_date).map(v => v.scheduled_date!).sort();
  const firstDate = scheduledDates[0];
  const lastDate = scheduledDates[scheduledDates.length - 1];

  // First media thumbnail from idea or first variation
  const firstMedia = (() => {
    const ideaMedia = idea.media_urls as string[] | null;
    if (ideaMedia && ideaMedia.length > 0) return ideaMedia[0];
    for (const v of variations) {
      const vMedia = v.media_urls as string[] | null;
      if (vMedia && vMedia.length > 0) return vMedia[0];
    }
    return null;
  })();

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => !prev);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'cursor-pointer hover:bg-muted/50 transition-all touch-manipulation',
        'border-l-4',
        statusConfig.color.replace('bg-', 'border-l-')
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex gap-2.5">
          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Grip + Platform icons (no names) */}
            <div className="flex items-center gap-1.5">
              <button {...attributes} {...listeners} className="touch-none shrink-0">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </button>
              {uniquePlatforms.size > 0 ? (
                <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
                  {Array.from(uniquePlatforms.values()).map(p => (
                    <Badge
                      key={p.id}
                      variant="secondary"
                      className="gap-1 px-1.5 py-0 h-5 text-[10px] font-medium"
                    >
                      <PlatformIcon icon={p.icon} size="sm" />
                      <span className="truncate max-w-[80px]">{p.name}</span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Sem plataforma</span>
              )}
              {/* Expand toggle */}
              <button
                onClick={toggleExpand}
                className="shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Title */}
            <h4 className="font-semibold text-sm leading-snug line-clamp-2">{idea.title}</h4>

            {/* Type badge */}
            <div className="flex items-center gap-1 flex-wrap">
              <Badge variant="outline" className={cn('text-[10px] gap-0.5 font-medium border py-0 h-5', ideaType.color)}>
                <span>{ideaType.icon}</span>
                {ideaType.label}
              </Badge>
            </div>
          </div>

          {/* Thumbnail */}
          {firstMedia && (
            <div className="shrink-0 w-14 h-14 rounded-md overflow-hidden bg-muted/50 self-center">
              <img
                src={firstMedia}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}
        </div>

        {/* Expandable details */}
        {expanded && (
          <div className="space-y-1.5 pt-1.5 mt-1.5 border-t border-border/50 animate-in fade-in-0 slide-in-from-top-1 duration-200">
            {idea.kpi && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-medium uppercase">{idea.kpi}</span>
              </div>
            )}
            {linkedNode && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <LinkIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{linkedNode.title}</span>
              </div>
            )}
            {linkedProduct && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Package className="h-3 w-3 shrink-0" />
                <span className="truncate">{linkedProduct.name}</span>
              </div>
            )}
            {idea.objective && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Target className="h-3 w-3 shrink-0" />
                <span className="line-clamp-2">{idea.objective}</span>
              </div>
            )}
            {idea.target_audience && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3 shrink-0" />
                <span className="line-clamp-1">{idea.target_audience}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer: date + progress */}
        <div className="flex items-center justify-between gap-2 pt-1.5 mt-1.5 border-t border-border/50">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
            {firstDate && (
              <>
                <Calendar className="h-3 w-3 shrink-0" />
                <span className="tabular-nums truncate">
                  {formatDate(firstDate)}
                  {lastDate && lastDate !== firstDate && ` → ${formatDate(lastDate)}`}
                </span>
              </>
            )}
          </div>
          {variations.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-muted-foreground tabular-nums">{completedVariations}/{variations.length}</span>
              <Progress value={progress} className="w-10 h-1.5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Sortable Variation Card
function SortableVariationCard({
  variation,
  ideaTitle,
  onClick,
  platforms = [],
  ideaTypes = [],
  ideaType: ideaTypeKey,
}: {
  variation: DigitalVariation & { ideaTitle: string };
  ideaTitle: string;
  onClick: () => void;
  platforms?: Platform[];
  ideaTypes?: IdeaType[];
  ideaType?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: variation.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusConfig = DIGITAL_STATUS[variation.status];
  const platform = platforms.find(p => p.id === variation.platform);
  const checklistProgress = variation.checklist?.length
    ? (variation.checklist.filter(c => c.done).length / variation.checklist.length) * 100
    : 0;

  const dynamicType = ideaTypes.find(t => t.key === ideaTypeKey);
  const typeInfo = dynamicType
    ? { label: dynamicType.label, icon: dynamicType.icon, color: dynamicType.color }
    : DEFAULT_TYPE;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'cursor-pointer hover:bg-muted/50 transition-all touch-manipulation',
        'border-l-4',
        statusConfig.color.replace('bg-', 'border-l-')
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-1.5">
        {/* Grip + Platform */}
        <div className="flex items-center gap-1.5">
          <button {...attributes} {...listeners} className="touch-none shrink-0">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          {platform ? (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <PlatformIcon icon={platform.icon} size="sm" />
              <span className="text-xs font-medium text-foreground truncate">{platform.name}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Plataforma</span>
          )}
        </div>

        {/* Idea title */}
        <h4 className="font-semibold text-sm leading-snug">{ideaTitle}</h4>

        {/* Type badge */}
        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant="outline" className={cn('text-[10px] gap-0.5 font-medium border py-0 h-5', typeInfo.color)}>
            <span>{typeInfo.icon}</span>
            {typeInfo.label}
          </Badge>
        </div>

        {/* Date */}
        {variation.scheduled_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 shrink-0" />
            <span className="tabular-nums">{formatDate(variation.scheduled_date)}</span>
          </div>
        )}

        {/* Checklist progress */}
        {variation.checklist && variation.checklist.length > 0 && (
          <div className="flex items-center gap-2 pt-1 border-t border-border/50">
            <Progress value={checklistProgress} className="w-14 h-1.5" />
            <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(checklistProgress)}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KanbanBoard({ ideas, onUpdateIdea, onUpdateVariation, onSelectIdea, viewMode, platforms = [], nodes = [], products = [], ideaTypes = [] }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const columns = useMemo(() => {
    if (viewMode === 'ideas') {
      return Object.entries(DIGITAL_STATUS).map(([status, config]) => ({
        status,
        config,
        items: ideas.filter(i => i.status === status),
      }));
    } else {
      const allVariations = ideas.flatMap(idea =>
        (idea.variations || []).map(v => ({ ...v, ideaTitle: idea.title, ideaType: idea.idea_type }))
      );

      return Object.entries(DIGITAL_STATUS).map(([status, config]) => ({
        status,
        config,
        items: allVariations.filter(v => v.status === status),
      }));
    }
  }, [ideas, viewMode]);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const overColumn = columns.find(col =>
      col.items.some(item => item.id === over.id) || col.status === over.id
    );
    if (!overColumn) return;

    const newStatus = overColumn.status as keyof typeof DIGITAL_STATUS;

    if (viewMode === 'ideas') {
      const activeIdea = ideas.find(i => i.id === active.id);
      if (activeIdea && activeIdea.status !== newStatus) {
        onUpdateIdea(active.id, { status: newStatus });
      }
    } else {
      const activeVariation = ideas.flatMap(i => i.variations || []).find(v => v.id === active.id);
      if (activeVariation && activeVariation.status !== newStatus) {
        onUpdateVariation(active.id, { status: newStatus });
      }
    }
  };

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    if (viewMode === 'ideas') {
      return ideas.find(i => i.id === activeId);
    } else {
      for (const idea of ideas) {
        const variation = idea.variations?.find(v => v.id === activeId);
        if (variation) return { ...variation, ideaTitle: idea.title, ideaType: idea.idea_type };
      }
    }
    return null;
  }, [activeId, ideas, viewMode]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
        {columns.map(({ status, config, items }) => (
          <div key={status} className="flex-shrink-0 w-72 md:w-80">
            <Card className="h-full">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full', config.color)} />
                    {config.label}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {items.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-2 space-y-2 min-h-[200px]">
                <SortableContext
                  items={items.map(i => i.id)}
                  strategy={verticalListSortingStrategy}
                  id={status}
                >
                  {items.map(item =>
                    viewMode === 'ideas' ? (
                      <SortableIdeaCard
                        key={item.id}
                        idea={item as DigitalIdea}
                        onClick={() => onSelectIdea((item as DigitalIdea).id)}
                        platforms={platforms}
                        nodes={nodes}
                        products={products}
                        ideaTypes={ideaTypes}
                      />
                    ) : (
                      <SortableVariationCard
                        key={item.id}
                        variation={item as DigitalVariation & { ideaTitle: string }}
                        ideaTitle={(item as any).ideaTitle}
                        ideaType={(item as any).ideaType}
                        onClick={() => {
                          const idea = ideas.find(i => i.variations?.some(v => v.id === item.id));
                          if (idea) onSelectIdea(idea.id);
                        }}
                        platforms={platforms}
                        ideaTypes={ideaTypes}
                      />
                    )
                  )}
                </SortableContext>

                {items.length === 0 && (
                  <div className="text-center text-muted-foreground text-xs py-8">
                    Arraste itens aqui
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <DragOverlay>
        {activeItem && viewMode === 'ideas' ? (
          <Card className="shadow-lg rotate-3 cursor-grabbing opacity-90">
            <CardContent className="p-3">
              <h4 className="font-medium text-sm">{(activeItem as DigitalIdea).title}</h4>
            </CardContent>
          </Card>
        ) : activeItem ? (
          <Card className="shadow-lg rotate-3 cursor-grabbing opacity-90">
            <CardContent className="p-3">
              <span className="text-xs">{(activeItem as any).ideaTitle}</span>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
